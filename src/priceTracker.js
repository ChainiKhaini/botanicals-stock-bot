/**
 * Unboxify Price Tracker Module — Sony WH-1000XM6
 * Monitors price changes and stock availability on unboxify.in
 */

import { sendTelegram, escapeHtml } from "./telegram.js";

export const SONY_XM6_URL = "https://www.unboxify.in/products/sony-wh-1000xm6-the-best-wireless-noise-canceling-headphones-hd-nc-processor-qn3-12-microphones-adaptive-nc-optimizer-mastered-by-engineers-studio-quality-black";
export const SONY_XM6_API_URL = "https://www.unboxify.in/products/sony-wh-1000xm6-the-best-wireless-noise-canceling-headphones-hd-nc-processor-qn3-12-microphones-adaptive-nc-optimizer-mastered-by-engineers-studio-quality-black.js";
export const KV_KEY_PRICE_SONY_XM6 = "price_tracker_sony_xm6";
export const BASELINE_PRICE = 29900;

/**
 * Normalizes raw Shopify product data from Unboxify
 */
export function normalizeProductData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid product data from Unboxify API");
  }

  const price = typeof data.price === "number" ? data.price / 100 : BASELINE_PRICE;
  const compareAtPrice = typeof data.compare_at_price === "number" ? data.compare_at_price / 100 : null;
  const available = Boolean(data.available);

  const variants = Array.isArray(data.variants)
    ? data.variants.map(v => ({
        id: v.id,
        title: v.title,
        price: typeof v.price === "number" ? v.price / 100 : price,
        compareAtPrice: typeof v.compare_at_price === "number" ? v.compare_at_price / 100 : null,
        available: Boolean(v.available)
      }))
    : [];

  return {
    id: data.id,
    shortName: "Sony WH-1000XM6",
    title: data.title || "Sony WH-1000XM6 The Best Wireless Noise Canceling Headphones",
    price,
    priceFormatted: `₹${price.toLocaleString("en-IN")}`,
    compareAtPrice,
    compareAtPriceFormatted: compareAtPrice ? `₹${compareAtPrice.toLocaleString("en-IN")}` : null,
    discountPercent: compareAtPrice ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : null,
    available,
    variants,
    url: SONY_XM6_URL,
    checkedAt: new Date().toISOString()
  };
}

/**
 * Fetches current Sony WH-1000XM6 product details from Unboxify
 */
export async function fetchSonyXM6(customFetch = fetch) {
  const res = await customFetch(SONY_XM6_API_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Unboxify product: HTTP ${res.status} (${res.statusText})`);
  }

  const data = await res.json();
  return normalizeProductData(data);
}

/**
 * Builds price change alert message for Telegram
 */
export function buildPriceChangeAlert(current, previous) {
  const oldPrice = previous?.price ?? BASELINE_PRICE;
  const newPrice = current.price;
  const diff = newPrice - oldPrice;
  const diffAbs = Math.abs(diff);
  const diffPercent = Math.round((diffAbs / oldPrice) * 100);

  const isDrop = diff < 0;
  const icon = isDrop ? "📉" : "📈";
  const directionText = isDrop ? "PRICE DROP ALERT! 🎉" : "PRICE INCREASE ALERT! ⚠️";

  const variantsText = current.variants && current.variants.length > 0
    ? current.variants.map(v => `• ${escapeHtml(v.title)}: <code>₹${v.price.toLocaleString("en-IN")}</code> ${v.available ? "✅" : "❌"}`).join("\n")
    : "";

  return [
    `🚨 <b>${directionText}</b>`,
    `🎧 <b>Sony WH-1000XM6 (UNBOXED)</b>`,
    ``,
    `${icon} <b>New Price:</b> <code>₹${newPrice.toLocaleString("en-IN")}</code>`,
    `⏱ <b>Previous Price:</b> <s>₹${oldPrice.toLocaleString("en-IN")}</s>`,
    `📊 <b>Difference:</b> ${isDrop ? "-" : "+"}₹${diffAbs.toLocaleString("en-IN")} (${diffPercent}%)`,
    current.compareAtPrice ? `🏷 <b>MRP / Compare At:</b> <s>₹${current.compareAtPrice.toLocaleString("en-IN")}</s>` : "",
    ``,
    `📦 <b>Stock Status:</b> <b>${current.available ? "In Stock ✅" : "Out of Stock ❌"}</b>`,
    variantsText ? `\n🎨 <b>Available Colors / Variants:</b>\n${variantsText}\n` : "",
    `🛒 <a href="${escapeHtml(current.url)}">View / Buy on Unboxify</a>`
  ].filter(Boolean).join("\n");
}

/**
 * Builds on-demand status message for Telegram (/sony command)
 */
export function buildSonyStatusMessage(product) {
  const variantsText = product.variants && product.variants.length > 0
    ? product.variants.map(v => `• ${escapeHtml(v.title)}: <code>₹${v.price.toLocaleString("en-IN")}</code> ${v.available ? "✅ In Stock" : "❌ Sold Out"}`).join("\n")
    : "";

  return [
    `🎧 <b>Sony WH-1000XM6 Wireless Noise Canceling Headphones</b>`,
    `<i>Unboxify Price & Stock Tracker</i>`,
    ``,
    `💰 <b>Current Price:</b> <code>₹${product.price.toLocaleString("en-IN")}</code>`,
    product.compareAtPrice ? `🏷 <b>Original MRP:</b> <s>₹${product.compareAtPrice.toLocaleString("en-IN")}</s>` : "",
    product.discountPercent ? `🔥 <b>Discount:</b> <b>${product.discountPercent}% OFF</b>` : "",
    `📦 <b>Availability:</b> <b>${product.available ? "In Stock ✅" : "Out of Stock ❌"}</b>`,
    ``,
    variantsText ? `🎨 <b>Color Variants:</b>\n${variantsText}\n` : "",
    `⏰ <i>Tracking Schedule: Daily at 10:00 AM IST</i>`,
    `🛒 <a href="${escapeHtml(product.url)}">Open Product on Unboxify</a>`
  ].filter(Boolean).join("\n");
}

/**
 * Core Orchestrator: Checks price and stock on Unboxify, diffs with stored KV state,
 * alerts Telegram if price changed, and updates KV state.
 */
export async function checkSonyXM6Price(env, options = {}) {
  const customFetch = options.customFetch || fetch;
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || env.TELEGRAM_CHAT_ID;
  const kv = env.BOTANICALS_STORE;

  const current = await fetchSonyXM6(customFetch);
  let previous = null;

  if (kv) {
    try {
      previous = await kv.get(KV_KEY_PRICE_SONY_XM6, { type: "json" });
    } catch (err) {
      console.warn("Could not load previous Sony price state:", err.message);
    }
  }

  // If no previous state in KV, use baseline of 29900 as specified by user
  if (!previous) {
    previous = {
      price: BASELINE_PRICE,
      available: true,
      lastCheckedAt: null
    };
  }

  const oldPrice = previous.price ?? BASELINE_PRICE;
  const priceChanged = current.price !== oldPrice;
  const stockChanged = previous.available !== undefined && current.available !== previous.available;

  // Telegram Notification on price change
  if (priceChanged && botToken && chatId) {
    const alertMsg = buildPriceChangeAlert(current, previous);
    await sendTelegram(botToken, chatId, alertMsg, { customFetch });
  }

  // Update KV state
  const nextState = {
    id: current.id,
    name: current.shortName,
    title: current.title,
    price: current.price,
    previousPrice: oldPrice,
    compareAtPrice: current.compareAtPrice,
    available: current.available,
    variants: current.variants,
    url: current.url,
    lastCheckedAt: current.checkedAt,
    lastPriceChangeAt: priceChanged ? current.checkedAt : (previous.lastPriceChangeAt || null)
  };

  if (kv) {
    try {
      await kv.put(KV_KEY_PRICE_SONY_XM6, JSON.stringify(nextState));
    } catch (err) {
      console.error("Failed to save Sony price state to KV:", err.message);
    }
  }

  return {
    success: true,
    priceChanged,
    stockChanged,
    currentPrice: current.price,
    previousPrice: oldPrice,
    available: current.available,
    checkedAt: current.checkedAt
  };
}
