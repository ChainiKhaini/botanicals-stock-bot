/**
 * Telegram Bot API Client and Message Formatters
 * Enforces safe chunking (<3900 chars), HTML escaping, and clean output formatting.
 */

import { cleanProductName } from "./classifier.js";

export { cleanProductName };

export const MAX_MESSAGE_LENGTH = 3900;

/**
 * Escapes characters for safe interpolation into Telegram HTML parse_mode
 */
export function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Reusable product line formatter for Telegram messages.
 */
export function formatProductLine(num, p, options = {}) {
  const cleanName = cleanProductName(p.name);
  const prefix = num ? `${num}. ` : "• ";
  let text = `${prefix}<a href="${escapeHtml(p.url)}"><b>${escapeHtml(cleanName)}</b></a>\n`;

  if (options.showCategory && p.categoryLabel) {
    text += `   🏷 <i>${escapeHtml(p.categoryLabel)}</i>`;
    if (options.showPotency && p.potency) {
      text += ` • ⚡ Potency: <b>${p.potency}/10</b>`;
    }
    text += `\n`;
  } else if (options.showPotency && p.potency) {
    text += `   ⚡ Potency: <b>${p.potency}/10</b>\n`;
  }

  if (options.showDescription && p.description) {
    text += `   📝 <i>${escapeHtml(p.description)}</i>\n`;
  }

  text += `   💰 <code>${escapeHtml(p.price)}</code>`;
  if (options.showTimestamp && p.restockedAt) {
    const timeStr = new Date(p.restockedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    text += ` | 🕒 <i>${escapeHtml(timeStr)}</i>`;
  }
  if (options.showBuyLink !== false) {
    text += ` | <a href="${escapeHtml(p.url)}">Buy Now</a>`;
  }
  text += `\n\n`;

  return text;
}

/**
 * Sends a message via Telegram Bot API with retry and abort signal
 */
export async function sendTelegram(botToken, chatId, message, options = {}) {
  if (!botToken || !chatId) {
    console.warn("Telegram credentials missing");
    return false;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const maxAttempts = 3;
  const customFetch = options.customFetch || fetch;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const resp = await customFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: options.disablePreview !== false,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (resp.ok) {
        return true;
      }

      const status = resp.status;
      let bodyText = "";
      try {
        bodyText = await resp.text();
      } catch (_) {}

      console.error(`Telegram API error status=${status} body=${bodyText.substring(0, 200)}`);

      if (status === 429 && attempt < maxAttempts) {
        let retryAfter = 5;
        try {
          const resJson = JSON.parse(bodyText);
          if (resJson?.parameters?.retry_after) {
            retryAfter = Math.min(resJson.parameters.retry_after, 10);
          }
        } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (status >= 500 && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      }

      return false;
    } catch (err) {
      console.error(`Telegram attempt ${attempt} failed:`, err.message);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  return false;
}

/**
 * Split large content into safe chunks for Telegram
 */
export async function sendChunkedMessages(botToken, chatId, header, items, footer, options = {}) {
  const messages = [];
  let currentLines = [];
  let currentLen = header.length + (footer ? footer.length : 0);

  for (const item of items) {
    if (currentLen + item.length > MAX_MESSAGE_LENGTH) {
      messages.push(header + currentLines.join("") + (footer || ""));
      currentLines = [item];
      currentLen = header.length + (footer ? footer.length : 0) + item.length;
    } else {
      currentLines.push(item);
      currentLen += item.length;
    }
  }

  if (currentLines.length > 0 || messages.length === 0) {
    messages.push(header + currentLines.join("") + (footer || ""));
  }

  for (const msg of messages) {
    const success = await sendTelegram(botToken, chatId, msg, options);
    if (!success) return false;
    if (messages.length > 1) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return true;
}

// ─── Message Builders ──────────────────────────────────────────

/**
 * Build Restock Alert chunks (safely handles many items without oversized message errors)
 */
export function buildRestockAlertChunks(restocked, newlyAdded) {
  const allItems = [...(restocked || []), ...(newlyAdded || [])];
  const count = allItems.length;

  const header = `🚨 <b>RESTOCK ALERT: ${count} Product${count > 1 ? "s" : ""} In Stock!</b>\n\n`;
  const items = allItems.map((p, idx) => formatProductLine(idx + 1, p, { showBuyLink: true }));
  const footer = `🌐 <a href="https://100percentpurebotanicals.com/shop">View Store</a>`;

  return { header, items, footer, count };
}

/**
 * Build daily 6:00 PM IST update message chunks
 */
export function buildDailyUpdateChunks({ inStockCount, totalCount, restocked, newlyAdded, inStockProducts }) {
  const hasRestocks = (restocked && restocked.length > 0) || (newlyAdded && newlyAdded.length > 0);
  
  let header = `🌿 <b>100% Pure Botanicals — Daily Stock Update (6:00 PM IST)</b>\n\n` +
               `📊 <b>Status:</b> <b>${inStockCount}</b> of <b>${totalCount}</b> products are currently <b>In Stock</b> ✅\n\n`;

  const items = [];

  if (hasRestocks) {
    items.push(`🔔 <b>Recently Restocked / Available Products:</b>\n`);
    const allNew = [...(restocked || []), ...(newlyAdded || [])];
    allNew.slice(0, 15).forEach((p, idx) => {
      const cleanName = cleanProductName(p.name);
      items.push(`${idx + 1}. <a href="${escapeHtml(p.url)}"><b>${escapeHtml(cleanName)}</b></a> — <code>${escapeHtml(p.price)}</code>\n`);
    });
    if (allNew.length > 15) {
      items.push(`<i>...and ${allNew.length - 15} more restocked items.</i>\n`);
    }
    items.push(`\n`);
  } else {
    items.push(`ℹ️ <i>No new restock transitions detected since the last check.</i>\n\n`);
  }

  // Highlight a few popular in-stock items
  if (inStockProducts && inStockProducts.length > 0) {
    items.push(`📦 <b>Sample In-Stock Items:</b>\n`);
    inStockProducts.slice(0, 5).forEach((p) => {
      const cleanName = cleanProductName(p.name);
      items.push(`• <a href="${escapeHtml(p.url)}">${escapeHtml(cleanName.slice(0, 70))}</a> (<code>${escapeHtml(p.price)}</code>)\n`);
    });
    items.push(`\n`);
  }

  let footer = `💡 <b>Commands:</b>\n` +
               `• /instock — View full list of in-stock items\n` +
               `• /psychedelic — View psychedelic catalog 🍄\n` +
               `• /search &lt;item&gt; — Search product availability\n` +
               `• /check — Trigger real-time catalog refresh\n` +
               `\n🌐 <a href="https://100percentpurebotanicals.com/shop">Visit Online Store</a>`;

  return { header, items, footer };
}

/**
 * Build In-Stock list messages (with pagination support)
 */
export function buildInStockListChunks(inStockProducts, page = 1, pageSize = 15) {
  const total = inStockProducts.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageItems = inStockProducts.slice(startIdx, endIdx);

  const header = `📦 <b>In Stock Products (${total} Available)</b>\n` +
                 `<i>Page ${currentPage} of ${totalPages}</i>\n\n`;

  const lines = pageItems.map((p, i) => formatProductLine(startIdx + i + 1, p, { showBuyLink: true }));

  let footer = `\n`;
  if (currentPage < totalPages) {
    footer += `➡️ To see more, type: <code>/instock ${currentPage + 1}</code>\n`;
  }
  if (currentPage > 1) {
    footer += `⬅️ Previous page: <code>/instock ${currentPage - 1}</code>\n`;
  }
  footer += `🔍 To search a specific item: <code>/search &lt;keyword&gt;</code>\n`;
  footer += `🌐 <a href="https://100percentpurebotanicals.com/shop">Visit Shop</a>`;

  return {
    header,
    lines,
    footer,
    currentPage,
    totalPages,
    totalItems: total
  };
}

/**
 * Build Psychedelic In-Stock list message (with pagination, descriptions, and potency ratings)
 */
export function buildPsychedelicListMessage(products, page = 1, pageSize = 15) {
  if (!products || products.length === 0) {
    return {
      header: `🍄 <b>Psychedelic & Entheogenic Products — In Stock</b>\n\n` +
              `❌ No psychedelic products are currently in stock.\n` +
              `Check back later or use <code>/check</code> to refresh the catalog.\n`,
      lines: [],
      footer: `\n🌐 <a href="https://100percentpurebotanicals.com/shop">Visit Shop</a>`
    };
  }

  const total = products.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageItems = products.slice(startIdx, endIdx);

  const header = `🍄 <b>Psychedelic & Entheogenic Products — In Stock (${total} Available)</b>\n` +
                 `<i>Page ${currentPage} of ${totalPages} • Sorted by potency ↓</i>\n\n`;

  const lines = pageItems.map((p, i) => 
    formatProductLine(startIdx + i + 1, p, {
      showCategory: true,
      showPotency: true,
      showDescription: true,
      showBuyLink: true
    })
  );

  let footer = `\n`;
  if (currentPage < totalPages) {
    footer += `➡️ Next page: <code>/psychedelic ${currentPage + 1}</code>\n`;
  }
  if (currentPage > 1) {
    footer += `⬅️ Previous page: <code>/psychedelic ${currentPage - 1}</code>\n`;
  }
  footer += `🔍 Search specific: <code>/search &lt;keyword&gt;</code>\n`;
  footer += `🌐 <a href="https://100percentpurebotanicals.com/shop">Visit Shop</a>`;

  return {
    header,
    lines,
    footer,
    currentPage,
    totalPages,
    totalItems: total
  };
}

/**
 * Build Search Results message
 */
export function buildSearchResultsMessage(query, matches) {
  const cleanQuery = escapeHtml(query);
  if (!matches || matches.length === 0) {
    return `🔍 <b>Search Results for &quot;${cleanQuery}&quot;</b>\n\n` +
           `❌ No matching products found.\n\n` +
           `💡 Try a shorter keyword or check /instock for all available products.`;
  }

  const inStockMatches = matches.filter(m => m.inStock);
  const outStockMatches = matches.filter(m => !m.inStock);

  let msg = `🔍 <b>Search Results for &quot;${cleanQuery}&quot; (${matches.length} found)</b>\n\n`;

  if (inStockMatches.length > 0) {
    msg += `✅ <b>In Stock (${inStockMatches.length}):</b>\n`;
    inStockMatches.slice(0, 10).forEach((p, idx) => {
      msg += formatProductLine(idx + 1, p, { showBuyLink: true });
    });
    if (inStockMatches.length > 10) {
      msg += `<i>...and ${inStockMatches.length - 10} more in-stock items.</i>\n\n`;
    }
  }

  if (outStockMatches.length > 0) {
    msg += `❌ <b>Out of Stock (${outStockMatches.length}):</b>\n`;
    outStockMatches.slice(0, 5).forEach((p) => {
      const cleanName = cleanProductName(p.name);
      msg += `• <a href="${escapeHtml(p.url)}">${escapeHtml(cleanName)}</a> (<code>${escapeHtml(p.price)}</code>)\n`;
    });
    if (outStockMatches.length > 5) {
      msg += `<i>...and ${outStockMatches.length - 5} more out-of-stock items.</i>\n`;
    }
    msg += `\n`;
  }

  msg += `🌐 <a href="https://100percentpurebotanicals.com/shop">Visit Shop</a>`;
  return msg;
}

/**
 * Build Recent Restocks message
 */
export function buildRecentRestocksMessage(recentRestocks) {
  if (!recentRestocks || recentRestocks.length === 0) {
    return `🔔 <b>Recent Restocks</b>\n\n` +
           `No restocks have been recorded yet. As soon as an out-of-stock item becomes available, it will be listed here.`;
  }

  let msg = `🔔 <b>Recently Restocked Items (${recentRestocks.length}):</b>\n\n`;
  recentRestocks.slice(0, 15).forEach((p, idx) => {
    msg += formatProductLine(idx + 1, p, { showTimestamp: true, showBuyLink: true });
  });

  return msg;
}

/**
 * Build Status message
 */
export function buildStatusMessage(meta) {
  const lastCheckStr = meta?.lastCheck 
    ? new Date(meta.lastCheck).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "Never";

  const total = meta?.totalCount ?? "—";
  const inStock = meta?.inStockCount ?? "—";
  const outOfStock = meta?.outOfStockCount ?? "—";
  const missingCount = meta?.missingCount || 0;
  const errors = meta?.consecutiveErrors || 0;
  const isHealthy = errors === 0;

  return [
    `📊 <b>100% Pure Botanicals Stock Monitor Status</b>`,
    ``,
    `• Health: <b>${isHealthy ? "Healthy ✅" : "Degraded ⚠️"}</b>`,
    `• Last Checked: <code>${escapeHtml(lastCheckStr)}</code> (IST)`,
    `• Total Tracked Products: <b>${total}</b>`,
    `• In Stock Products: <b>${inStock}</b> ✅`,
    `• Out of Stock Products: <b>${outOfStock}</b> ❌`,
    missingCount > 0 ? `• Missing / Delisted: <b>${missingCount}</b> ⚠️` : ``,
    `• Schedule: <b>Every 30m</b> (Daily Summary at <b>6:00 PM IST</b>)`,
    errors > 0 ? `• Consecutive Errors: <b>${errors}</b>` : ``,
    ``,
    `💡 Commands: /instock, /psychedelic, /search, /recent, /check, /help`
  ].filter(Boolean).join("\n");
}

/**
 * Build Help message
 */
export function buildHelpMessage() {
  return [
    `🌿 <b>100% Pure Botanicals Stock Bot</b>`,
    `Monitors product availability and alerts you when out-of-stock items come back into stock.`,
    ``,
    `📋 <b>Available Commands:</b>`,
    `• <code>/instock</code> or <code>/stock</code> — List all products currently in stock`,
    `• <code>/instock [page]</code> — View specific page (e.g. <code>/instock 2</code>)`,
    `• <code>/psychedelic</code> — List psychedelic & entheogenic products in stock 🍄`,
    `• <code>/search &lt;item&gt;</code> — Search for a product by name or keyword`,
    `• <code>/recent</code> or <code>/restocked</code> — View items that recently came in stock`,
    `• <code>/check</code> — Trigger an immediate live catalog check`,
    `• <code>/status</code> — View monitor statistics and last check time`,
    `• <code>/help</code> — Show this commands menu`,
    ``,
    `⏰ <b>Automated Checks:</b> Active monitoring every 30m (Daily digest at <b>6:00 PM IST</b>).`
  ].join("\n");
}
