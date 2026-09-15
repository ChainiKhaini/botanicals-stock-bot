/**
 * Unboxify Multi-Product Price & Stock Tracker Module
 * Tracks:
 * 1. Sony WH-1000XM6 Headphones
 * 2. Samsung Galaxy Watch 8 (40mm)
 * 3. Fitbit Charge 6 Fitness Tracker
 */

import { sendTelegram, escapeHtml } from "./telegram.js";

export const TRACKED_PRODUCTS = [
  {
    key: "sony_xm6",
    id: 9460530118933,
    shortName: "Sony WH-1000XM6",
    icon: "🎧",
    baselinePrice: 29900,
    url: "https://www.unboxify.in/products/sony-wh-1000xm6-the-best-wireless-noise-canceling-headphones-hd-nc-processor-qn3-12-microphones-adaptive-nc-optimizer-mastered-by-engineers-studio-quality-black",
    apiUrl: "https://www.unboxify.in/products/sony-wh-1000xm6-the-best-wireless-noise-canceling-headphones-hd-nc-processor-qn3-12-microphones-adaptive-nc-optimizer-mastered-by-engineers-studio-quality-black.js",
    kvKey: "price_tracker_sony_xm6"
  },
  {
    key: "samsung_watch8",
    id: 9447737262357,
    shortName: "Samsung Galaxy Watch 8 (40mm)",
    icon: "⌚",
    baselinePrice: 20999,
    url: "https://www.unboxify.in/products/samsung-galaxy-watch-8-2025-40mm-bluetooth-smartwatch-cushion-design-fitness-tracker-sleep-coaching-running-coach-energy-score-heart-rate-tracking-copy",
    apiUrl: "https://www.unboxify.in/products/samsung-galaxy-watch-8-2025-40mm-bluetooth-smartwatch-cushion-design-fitness-tracker-sleep-coaching-running-coach-energy-score-heart-rate-tracking-copy.js",
    kvKey: "price_tracker_samsung_watch8"
  },
  {
    key: "fitbit_charge6",
    id: 9361106632981,
    shortName: "Fitbit Charge 6",
    icon: "🏃",
    baselinePrice: 10499,
    url: "https://www.unboxify.in/products/fitbit-charge-6-fitness-tracker-with-google-apps-heart-rate-on-exercise-equipment-6-months-premium-membership-included-gps-health-tools-and-more-gold-coral-one-size-s-l-bands-included",
    apiUrl: "https://www.unboxify.in/products/fitbit-charge-6-fitness-tracker-with-google-apps-heart-rate-on-exercise-equipment-6-months-premium-membership-included-gps-health-tools-and-more-gold-coral-one-size-s-l-bands-included.js",
    kvKey: "price_tracker_fitbit_charge6"
  }
];

// Backwards-compatible constants for Sony XM6
export const SONY_XM6_URL = TRACKED_PRODUCTS[0].url;
export const SONY_XM6_API_URL = TRACKED_PRODUCTS[0].apiUrl;
export const KV_KEY_PRICE_SONY_XM6 = TRACKED_PRODUCTS[0].kvKey;
export const BASELINE_PRICE = TRACKED_PRODUCTS[0].baselinePrice;

/**
 * Normalizes raw Shopify product data from Unboxify
 */
export function normalizeProductData(data, productDef = TRACKED_PRODUCTS[0]) {
  if (!data || typeof data !== "object") {
    throw new Error(`Invalid product data for ${productDef.shortName} from Unboxify API`);
  }

  const baseline = productDef.baselinePrice || 0;
  const price = typeof data.price === "number" ? data.price / 100 : baseline;
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
    key: productDef.key,
    id: data.id,
    shortName: productDef.shortName,
    icon: productDef.icon || "📦",
    title: data.title || productDef.shortName,
    price,
    priceFormatted: `₹${price.toLocaleString("en-IN")}`,
    compareAtPrice,
    compareAtPriceFormatted: compareAtPrice ? `₹${compareAtPrice.toLocaleString("en-IN")}` : null,
    discountPercent: compareAtPrice && compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : null,
    available,
    variants,
    url: productDef.url,
    checkedAt: new Date().toISOString()
  };
}

/**
 * Fetches a single tracked product by its definition
 */
export async function fetchProductPrice(productDef, customFetch = fetch) {
  const res = await customFetch(productDef.apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${productDef.shortName} from Unboxify: HTTP ${res.status} (${res.statusText})`);
  }

  const data = await res.json();
  return normalizeProductData(data, productDef);
}

/**
 * Backwards-compatible Sony fetcher
 */
export async function fetchSonyXM6(customFetch = fetch) {
  return fetchProductPrice(TRACKED_PRODUCTS[0], customFetch);
}

/**
 * Fetch Samsung Galaxy Watch 8
 */
export async function fetchSamsungWatch8(customFetch = fetch) {
  return fetchProductPrice(TRACKED_PRODUCTS[1], customFetch);
}

/**
 * Fetch Fitbit Charge 6
 */
export async function fetchFitbitCharge6(customFetch = fetch) {
  return fetchProductPrice(TRACKED_PRODUCTS[2], customFetch);
}

/**
 * Fetches all tracked electronics from Unboxify in parallel
 */
export async function fetchAllTrackedProducts(customFetch = fetch) {
  return Promise.all(TRACKED_PRODUCTS.map(p => fetchProductPrice(p, customFetch)));
}

/**
 * Builds price change alert message for Telegram
 */
export function buildPriceChangeAlert(current, previous) {
  const oldPrice = previous?.price ?? current.price;
  const newPrice = current.price;
  const diff = newPrice - oldPrice;
  const diffAbs = Math.abs(diff);
  const diffPercent = oldPrice > 0 ? Math.round((diffAbs / oldPrice) * 100) : 0;

  const isDrop = diff < 0;
  const icon = isDrop ? "📉" : "📈";
  const directionText = isDrop ? "PRICE DROP ALERT! 🎉" : "PRICE INCREASE ALERT! ⚠️";

  const variantsText = current.variants && current.variants.length > 0 && current.variants[0].title !== "Default Title"
    ? current.variants.map(v => `• ${escapeHtml(v.title)}: <code>₹${v.price.toLocaleString("en-IN")}</code> ${v.available ? "✅" : "❌"}`).join("\n")
    : "";

  return [
    `🚨 <b>${directionText}</b>`,
    `${current.icon || "📦"} <b>${escapeHtml(current.shortName)}</b>`,
    ``,
    `${icon} <b>New Price:</b> <code>₹${newPrice.toLocaleString("en-IN")}</code>`,
    `⏱ <b>Previous Price:</b> <s>₹${oldPrice.toLocaleString("en-IN")}</s>`,
    `📊 <b>Difference:</b> ${isDrop ? "-" : "+"}₹${diffAbs.toLocaleString("en-IN")} (${diffPercent}%)`,
    current.compareAtPrice ? `🏷 <b>MRP / Compare At:</b> <s>₹${current.compareAtPrice.toLocaleString("en-IN")}</s>` : "",
    current.discountPercent ? `🔥 <b>Discount:</b> <b>${current.discountPercent}% OFF</b>` : "",
    ``,
    `📦 <b>Stock Status:</b> <b>${current.available ? "In Stock ✅" : "Out of Stock ❌"}</b>`,
    variantsText ? `\n🎨 <b>Available Colors / Variants:</b>\n${variantsText}\n` : "",
    `🛒 <a href="${escapeHtml(current.url)}">View / Buy on Unboxify</a>`
  ].filter(Boolean).join("\n");
}

/**
 * Builds on-demand status message for a single product (/sony, /samsung, /fitbit)
 */
export function buildProductStatusMessage(product) {
  const variantsText = product.variants && product.variants.length > 0 && product.variants[0].title !== "Default Title"
    ? product.variants.map(v => `• ${escapeHtml(v.title)}: <code>₹${v.price.toLocaleString("en-IN")}</code> ${v.available ? "✅ In Stock" : "❌ Sold Out"}`).join("\n")
    : "";

  return [
    `${product.icon || "📦"} <b>${escapeHtml(product.shortName)}</b>`,
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
 * Backwards-compatible Sony status message builder
 */
export function buildSonyStatusMessage(product) {
  return buildProductStatusMessage(product);
}

/**
 * Builds multi-product summary message for Telegram (/gadgets or /deals)
 */
export function buildAllProductsSummaryMessage(products) {
  const lines = products.map((p, idx) => {
    const discount = p.discountPercent ? ` (🔥 ${p.discountPercent}% OFF)` : "";
    return [
      `${idx + 1}. ${p.icon} <a href="${escapeHtml(p.url)}"><b>${escapeHtml(p.shortName)}</b></a>`,
      `   💰 <code>₹${p.price.toLocaleString("en-IN")}</code>${discount}`,
      `   🏷 MRP: <s>₹${(p.compareAtPrice || 0).toLocaleString("en-IN")}</s> | ${p.available ? "✅ In Stock" : "❌ Out of Stock"}`
    ].join("\n");
  });

  return [
    `🛍 <b>Unboxify Tracked Gadgets & Electronics</b>`,
    `<i>Live Prices & Discounts</i>\n`,
    lines.join("\n\n"),
    `\n⏰ <b>Automated Monitoring:</b> Daily at <b>10:00 AM IST</b>`,
    `💡 <i>Use /sony, /samsung, or /fitbit for detailed color variants</i>`
  ].join("\n");
}

/**
 * Checks a single tracked product against KV, alerts on price change, updates KV
 */
export async function checkSingleProductPrice(env, productDef, options = {}) {
  const customFetch = options.customFetch || fetch;
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || env.TELEGRAM_CHAT_ID;
  const kv = env.BOTANICALS_STORE;

  const current = await fetchProductPrice(productDef, customFetch);
  let previous = null;

  if (kv) {
    try {
      previous = await kv.get(productDef.kvKey, { type: "json" });
    } catch (err) {
      console.warn(`Could not load previous price state for ${productDef.shortName}:`, err.message);
    }
  }

  // Default to baseline price if no state in KV yet
  if (!previous) {
    previous = {
      price: productDef.baselinePrice,
      available: true,
      lastCheckedAt: null
    };
  }

  const oldPrice = previous.price ?? productDef.baselinePrice;
  const priceChanged = current.price !== oldPrice;
  const stockChanged = previous.available !== undefined && current.available !== previous.available;

  // Send Telegram alert if price changed
  if (priceChanged && botToken && chatId) {
    const alertMsg = buildPriceChangeAlert(current, previous);
    await sendTelegram(botToken, chatId, alertMsg, { customFetch });
  }

  // Update KV state
  const nextState = {
    key: productDef.key,
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
      await kv.put(productDef.kvKey, JSON.stringify(nextState));
    } catch (err) {
      console.error(`Failed to save price state for ${productDef.shortName} to KV:`, err.message);
    }
  }

  return {
    key: productDef.key,
    shortName: productDef.shortName,
    success: true,
    priceChanged,
    stockChanged,
    currentPrice: current.price,
    previousPrice: oldPrice,
    available: current.available,
    checkedAt: current.checkedAt
  };
}

/**
 * Checks Sony XM6 price (backwards compatibility)
 */
export async function checkSonyXM6Price(env, options = {}) {
  return checkSingleProductPrice(env, TRACKED_PRODUCTS[0], options);
}

/**
 * Checks Samsung Galaxy Watch 8 price
 */
export async function checkSamsungWatchPrice(env, options = {}) {
  return checkSingleProductPrice(env, TRACKED_PRODUCTS[1], options);
}

/**
 * Checks Fitbit Charge 6 price
 */
export async function checkFitbitPrice(env, options = {}) {
  return checkSingleProductPrice(env, TRACKED_PRODUCTS[2], options);
}

/**
 * Core Orchestrator: Checks ALL tracked products on Unboxify, diffs with stored KV state,
 * alerts Telegram on any price changes, and updates KV state.
 */
export async function checkAllTrackedPrices(env, options = {}) {
  const results = [];
  for (const productDef of TRACKED_PRODUCTS) {
    try {
      const result = await checkSingleProductPrice(env, productDef, options);
      results.push(result);
    } catch (err) {
      console.error(`Error tracking ${productDef.shortName}:`, err.message);
      results.push({
        key: productDef.key,
        shortName: productDef.shortName,
        success: false,
        error: err.message
      });
    }
  }

  return {
    success: results.every(r => r.success),
    checkedCount: results.length,
    results
  };
}
