/**
 * Stock Check Monitor Pipeline & Business Workflow Orchestration
 * Enforces the core invariant: A stock snapshot may only be replaced after a complete,
 * validated catalog scan has succeeded and the new snapshot has been successfully persisted.
 */

import { fetchFullCatalog } from "./scraper.js";
import {
  loadSnapshot,
  saveSnapshot,
  loadMeta,
  saveMeta,
  acquireLock,
  releaseLock,
  diffCatalog,
  KV_KEY_LOCK
} from "./store.js";
import {
  sendTelegram,
  sendChunkedMessages,
  escapeHtml,
  buildDailyUpdateChunks,
  buildRestockAlertChunks
} from "./telegram.js";

/**
 * Shared helper to load current catalog products from KV snapshot (cached) or live catalog fallback.
 */
export async function getProductList(kv, customFetch = fetch) {
  try {
    const snapshot = await loadSnapshot(kv);
    if (snapshot && Object.keys(snapshot).length > 0) {
      return Object.values(snapshot).filter(p => p.status !== "missing");
    }
  } catch (err) {
    console.warn("Could not read snapshot from KV, falling back to live fetch:", err.message);
  }

  const catalog = await fetchFullCatalog({ customFetch });
  return catalog.products;
}

/**
 * Performs a full, verified stock check pipeline run.
 * @param {object} env - Cloudflare Worker environment bindings
 * @param {object} options - Execution options ({ isScheduled, isManual, isPeriodic, chatId, customFetch })
 * @returns {Promise<object>} Structured result telemetry
 */
export async function performStockCheck(env, options = {}) {
  const startTime = Date.now();
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || env.TELEGRAM_CHAT_ID;
  const kv = env.BOTANICALS_STORE;
  const isScheduled = options.isScheduled === true;
  const isManual = options.isManual === true;
  const isPeriodic = options.isPeriodic === true;
  const customFetch = options.customFetch || fetch;

  // 1. Acquire execution lock to prevent overlapping runs
  const lock = await acquireLock(kv, KV_KEY_LOCK, 90);
  if (!lock.acquired) {
    console.warn("Stock check skipped: another stock check is already in progress.");
    return {
      success: false,
      status: "locked",
      message: "Another stock check is currently executing. Concurrent runs prevented.",
      durationMs: Date.now() - startTime
    };
  }

  let meta = {};
  try {
    meta = (await loadMeta(kv)) || {};
  } catch (err) {
    console.warn("Warning: Could not read prior metadata, starting fresh:", err.message);
  }

  const consecutiveErrors = meta.consecutiveErrors || 0;

  try {
    // 2. Fetch full catalog from store API with strict completeness & integrity verification
    // (Fails closed: throws if any page fails, count mismatch, or duplicate ID)
    const catalog = await fetchFullCatalog({ customFetch });
    console.log(`Verified full catalog: ${catalog.totalCount} products (${catalog.inStockCount} in stock, ${catalog.outOfStockCount} out of stock)`);

    // 3. Load previous KV snapshot (fails closed on KV errors)
    const prevSnapshot = await loadSnapshot(kv);

    // 4. Compute diff (restocks, new items, out-of-stock transitions, missing items)
    const diff = diffCatalog(prevSnapshot, catalog.products);
    const nowIso = new Date().toISOString();
    const existingRecent = meta.recentRestocks || [];
    
    // Combine newly restocked & newly added in-stock items
    const newlyAvailable = [...diff.restocked, ...diff.newlyAdded];
    let updatedRecent = existingRecent;

    if (newlyAvailable.length > 0) {
      const newEntries = newlyAvailable.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        url: p.url,
        price: p.price,
        restockedAt: nowIso
      }));
      // Keep up to 25 recent restocked items
      updatedRecent = [...newEntries, ...existingRecent].slice(0, 25);
    }

    // 5. Persist updated snapshot & verified metadata to KV
    // Only executed if the entire scrape succeeded and diff completed
    await saveSnapshot(kv, diff.nextSnapshot);

    const nextMeta = {
      lastCheck: nowIso,
      totalCount: catalog.totalCount,
      inStockCount: catalog.inStockCount,
      outOfStockCount: catalog.outOfStockCount,
      missingCount: diff.missing ? diff.missing.length : 0,
      recentRestocks: updatedRecent,
      consecutiveErrors: 0,
      lastError: "",
      lastRestockCount: newlyAvailable.length,
      lastScanDurationMs: Date.now() - startTime
    };
    await saveMeta(kv, nextMeta);

    // 6. Handle Telegram notifications (with mutual exclusion to prevent duplicate alerts)
    if (diff.isFirstRun) {
      // First baseline run notification
      if (botToken && chatId) {
        const initMsg = [
          `🌿 <b>100% Pure Botanicals Monitor Initialized!</b>`,
          ``,
          `• Total Products Tracked: <b>${catalog.totalCount}</b>`,
          `• In Stock: <b>${catalog.inStockCount}</b> ✅`,
          `• Out of Stock: <b>${catalog.outOfStockCount}</b> ❌`,
          `• Schedule: Active monitoring every 30m (Daily digest at <b>6:00 PM IST</b>)`,
          ``,
          `You will receive immediate alerts whenever out-of-stock products become available.`,
          `Type <code>/help</code> for available commands.`
        ].join("\n");
        await sendTelegram(botToken, chatId, initMsg, { customFetch });
      }

      await releaseLock(kv, KV_KEY_LOCK);
      return {
        success: true,
        status: "first_run_initialized",
        counts: {
          total: catalog.totalCount,
          inStock: catalog.inStockCount,
          outOfStock: catalog.outOfStockCount,
          restocked: 0,
          newlyAdded: 0,
          missing: 0
        },
        durationMs: Date.now() - startTime
      };
    }

    // Notification routing:
    // Case A: 6:00 PM IST Scheduled Daily Digest -> Sends unified daily update (with restocks if any)
    if (isScheduled && botToken && chatId) {
      const dailyData = buildDailyUpdateChunks({
        inStockCount: catalog.inStockCount,
        totalCount: catalog.totalCount,
        restocked: diff.restocked,
        newlyAdded: diff.newlyAdded,
        inStockProducts: catalog.inStockProducts
      });
      await sendChunkedMessages(botToken, chatId, dailyData.header, dailyData.items, dailyData.footer, { customFetch });
    }
    // Case B: Periodic 30m check or manual check with restocks -> Sends instant restock alert
    else if (diff.hasRestocks && botToken && chatId) {
      const restockData = buildRestockAlertChunks(diff.restocked, diff.newlyAdded);
      await sendChunkedMessages(botToken, chatId, restockData.header, restockData.items, restockData.footer, { customFetch });
    }
    // Case C: Manual check with no restocks -> Confirmation message
    else if (isManual && botToken && chatId && !diff.hasRestocks) {
      const manualMsg = [
        `✅ <b>Check Complete:</b> Catalog is up to date.`,
        ``,
        `• <b>${catalog.inStockCount}</b> of <b>${catalog.totalCount}</b> products are In Stock.`,
        `• No new restocks detected since last check.`,
        ``,
        `Type <code>/instock</code> or <code>/psychedelic</code> to browse available products.`
      ].join("\n");
      await sendTelegram(botToken, chatId, manualMsg, { customFetch });
    }
    // Case D: Periodic 30m check with no restocks -> Stays silent

    // Release execution lock
    await releaseLock(kv, KV_KEY_LOCK);

    return {
      success: true,
      status: "complete",
      counts: {
        total: catalog.totalCount,
        inStock: catalog.inStockCount,
        outOfStock: catalog.outOfStockCount,
        restocked: diff.restocked.length,
        newlyAdded: diff.newlyAdded.length,
        missing: diff.missing ? diff.missing.length : 0,
        priceChanged: diff.priceChanged ? diff.priceChanged.length : 0
      },
      durationMs: Date.now() - startTime
    };

  } catch (err) {
    console.error("Stock check pipeline failure:", err.message);

    // Release lock on failure
    await releaseLock(kv, KV_KEY_LOCK);

    const errorCount = consecutiveErrors + 1;
    try {
      await saveMeta(kv, {
        ...meta,
        lastFailedCheck: new Date().toISOString(),
        consecutiveErrors: errorCount,
        lastError: err.message
      });
    } catch (saveErr) {
      console.error("Failed to save error metadata:", saveErr.message);
    }

    // Alert admin if multiple consecutive check failures
    if (errorCount >= 5 && errorCount % 5 === 0 && botToken && chatId) {
      const alertMsg = `⚠️ <b>Botanicals Monitor Alert:</b> ${errorCount} consecutive check failures.\nError: ${escapeHtml(err.message)}`;
      await sendTelegram(botToken, chatId, alertMsg, { customFetch });
    }

    return {
      success: false,
      status: "failed",
      error: err.message,
      consecutiveErrors: errorCount,
      durationMs: Date.now() - startTime
    };
  }
}
