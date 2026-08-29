/**
 * 100% Pure Botanicals Stock Monitor — Cloudflare Worker
 * ========================================================
 * Main Worker Router & Scheduled Cron Entrypoint
 */

import { performStockCheck, getProductList } from "./monitor.js";
import { loadMeta } from "./store.js";
import {
  sendTelegram,
  sendChunkedMessages,
  escapeHtml,
  buildInStockListChunks,
  buildSearchResultsMessage,
  buildRecentRestocksMessage,
  buildStatusMessage,
  buildHelpMessage,
  buildPsychedelicListMessage
} from "./telegram.js";
import { renderDashboardHtml } from "./dashboard.js";
import { classifyProduct } from "./classifier.js";
import {
  validateWebhookSecret,
  validateAdminAuth,
  checkRateLimit
} from "./auth.js";

export { performStockCheck, classifyProduct };

// ─── Webhook Command Processing ─────────────────────────────

async function handleTelegramUpdate(update, env, ctx) {
  const msg = update?.message;
  if (!msg || !msg.text || !msg.chat) return;

  const chatIdStr = String(msg.chat.id);
  const configuredChatId = String(env.TELEGRAM_CHAT_ID || "");
  const botToken = env.TELEGRAM_BOT_TOKEN;

  // Fail closed: require TELEGRAM_CHAT_ID to be configured
  if (!configuredChatId) {
    console.error("Security Error: TELEGRAM_CHAT_ID is not configured in environment");
    return;
  }

  if (chatIdStr !== configuredChatId) {
    console.warn(`Unauthorized message from chat ID: ${chatIdStr}`);
    return;
  }

  const rawText = msg.text.trim();
  const parts = rawText.split(/\s+/);
  const command = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ").trim();

  // /start and /help
  if (command === "/start" || command === "/help") {
    ctx.waitUntil(sendTelegram(botToken, chatIdStr, buildHelpMessage()));
    return;
  }

  // /status
  if (command === "/status") {
    ctx.waitUntil((async () => {
      const meta = await loadMeta(env.BOTANICALS_STORE).catch(() => null);
      await sendTelegram(botToken, chatIdStr, buildStatusMessage(meta));
    })());
    return;
  }

  // /recent and /restocked
  if (command === "/recent" || command === "/restocked") {
    ctx.waitUntil((async () => {
      const meta = await loadMeta(env.BOTANICALS_STORE).catch(() => null);
      await sendTelegram(botToken, chatIdStr, buildRecentRestocksMessage(meta?.recentRestocks));
    })());
    return;
  }

  // /check - manual refresh
  if (command === "/check") {
    ctx.waitUntil((async () => {
      await sendTelegram(botToken, chatIdStr, "🔍 <b>Checking 100% Pure Botanicals catalog for latest stock...</b>");
      await performStockCheck(env, { isManual: true, chatId: chatIdStr });
    })());
    return;
  }

  // /instock and /stock
  if (command === "/instock" || command === "/stock") {
    ctx.waitUntil((async () => {
      try {
        const pageNum = parseInt(arg, 10) || 1;
        const allProducts = await getProductList(env.BOTANICALS_STORE);
        const inStockList = allProducts.filter(p => p.inStock);

        if (inStockList.length === 0) {
          await sendTelegram(botToken, chatIdStr, "ℹ️ No in-stock products found in the catalog.");
          return;
        }

        const chunkData = buildInStockListChunks(inStockList, pageNum, 15);
        await sendChunkedMessages(botToken, chatIdStr, chunkData.header, chunkData.lines, chunkData.footer);
      } catch (err) {
        console.error("Instock command error:", err.message);
        await sendTelegram(botToken, chatIdStr, `❌ Failed to retrieve in-stock list: ${escapeHtml(err.message)}`);
      }
    })());
    return;
  }

  // /psychedelic, /psychadelic, /psycadelic, /entheogen
  const isPsychedelicCmd = [
    "/psychedelic", "/psychedelics",
    "/psychadelic", "/psychadelics",
    "/psycadelic", "/psycadelics",
    "/psychoactive", "/psychoactives",
    "/entheogen", "/entheogens"
  ].includes(command);

  if (isPsychedelicCmd) {
    ctx.waitUntil((async () => {
      try {
        const pageNum = parseInt(arg, 10) || 1;
        const allProducts = await getProductList(env.BOTANICALS_STORE);

        // Filter and hydrate classification (supports both pre-computed records & legacy snapshots)
        const psychedelicInStock = allProducts
          .filter(p => p.inStock)
          .map(p => {
            if (p.isPsychedelic !== undefined && p.categoryLabel && p.potency !== undefined) {
              return p;
            }
            const info = classifyProduct(p);
            return {
              ...p,
              isPsychedelic: info.isPsychedelic,
              categoryLabel: info.categoryLabel || null,
              potency: info.potency || null,
              description: info.description || null
            };
          })
          .filter(p => p.isPsychedelic === true)
          .sort((a, b) => (b.potency || 0) - (a.potency || 0));

        const msg = buildPsychedelicListMessage(psychedelicInStock, pageNum, 15);
        await sendChunkedMessages(botToken, chatIdStr, msg.header, msg.lines, msg.footer);
      } catch (err) {
        console.error("Psychedelic command error:", err.message);
        await sendTelegram(botToken, chatIdStr, `❌ Failed to retrieve psychedelic products: ${escapeHtml(err.message)}`);
      }
    })());
    return;
  }

  // /search and /find
  if (command === "/search" || command === "/find") {
    if (!arg) {
      ctx.waitUntil(sendTelegram(botToken, chatIdStr, "⚠️ Please specify a search term. Example: <code>/search kefir</code> or <code>/search caapi</code>"));
      return;
    }

    ctx.waitUntil((async () => {
      try {
        const allProducts = await getProductList(env.BOTANICALS_STORE);
        const queryLower = arg.toLowerCase();
        const matches = allProducts.filter(p => 
          p.name.toLowerCase().includes(queryLower) || 
          p.slug.toLowerCase().includes(queryLower)
        );

        const searchMsg = buildSearchResultsMessage(arg, matches);
        await sendTelegram(botToken, chatIdStr, searchMsg);
      } catch (err) {
        console.error("Search error:", err.message);
        await sendTelegram(botToken, chatIdStr, `❌ Search failed: ${escapeHtml(err.message)}`);
      }
    })());
    return;
  }
}

// ─── Worker Entry Points ────────────────────────────────────

export default {
  /**
   * Cloudflare Cron Trigger (Runs periodic 30m checks + 6:00 PM IST daily digest)
   */
  async scheduled(event, env, ctx) {
    console.log("Cron trigger fired:", event.cron);
    const isDailyDigest = event.cron === "30 12 * * *";
    ctx.waitUntil(
      performStockCheck(env, { isScheduled: isDailyDigest, isPeriodic: !isDailyDigest }).catch(err => {
        console.error("Scheduled execution error:", err);
      })
    );
  },

  /**
   * HTTP Request Router
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Telegram Webhook Endpoint (Fails closed)
    if (url.pathname === "/webhook" || url.pathname === "/telegram-webhook") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
      }

      // Mandatory Webhook Secret Verification (timing-safe)
      const auth = await validateWebhookSecret(request, env);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.error.startsWith("Server misconfiguration") ? 500 : 401,
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        const update = await request.json();
        await handleTelegramUpdate(update, env, ctx);
      } catch (err) {
        console.error("Webhook processing error:", err.message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Manual Check Endpoint (Fails closed, authenticated & rate-limited)
    if (url.pathname === "/check") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed. Use POST" }), {
          status: 405,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Mandatory Admin Token Verification (timing-safe)
      const auth = await validateAdminAuth(request, env);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.error.startsWith("Server misconfiguration") ? 500 : 401,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Rate limit check (60s cooldown)
      const rateLimit = await checkRateLimit(env.BOTANICALS_STORE, "rate_limit_admin_check", 60);
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          error: "Too Many Requests",
          message: `Rate limit reached. Please wait ${rateLimit.remainingSeconds}s before checking again.`
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        });
      }

      ctx.waitUntil(performStockCheck(env, { isManual: true }));

      return new Response(JSON.stringify({ status: "Accepted", message: "Stock check initiated in background" }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. JSON Status Endpoint (Reports verified state)
    if (url.pathname === "/status") {
      const meta = (await loadMeta(env.BOTANICALS_STORE).catch(() => null)) || { status: "No data recorded yet" };
      return new Response(JSON.stringify(meta, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "max-age=30"
        }
      });
    }

    // 4. HTML Dashboard (Default)
    const meta = await loadMeta(env.BOTANICALS_STORE).catch(() => null);
    return new Response(renderDashboardHtml(meta), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "max-age=30"
      }
    });
  }
};
