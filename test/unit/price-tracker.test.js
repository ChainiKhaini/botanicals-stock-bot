import test from "node:test";
import assert from "node:assert/strict";
import {
  TRACKED_PRODUCTS,
  normalizeProductData,
  buildPriceChangeAlert,
  buildSonyStatusMessage,
  buildProductStatusMessage,
  buildAllProductsSummaryMessage,
  checkSonyXM6Price,
  checkSingleProductPrice,
  checkAllTrackedPrices,
  fetchSonyXM6,
  fetchSamsungWatch8,
  fetchFitbitCharge6,
  fetchAllTrackedProducts,
  BASELINE_PRICE,
  KV_KEY_PRICE_SONY_XM6
} from "../../src/priceTracker.js";

test("TRACKED_PRODUCTS contains Sony, Samsung Watch, and Fitbit definitions", () => {
  assert.equal(TRACKED_PRODUCTS.length, 3);
  const keys = TRACKED_PRODUCTS.map(p => p.key);
  assert.deepEqual(keys, ["sony_xm6", "samsung_watch8", "fitbit_charge6"]);

  const samsung = TRACKED_PRODUCTS.find(p => p.key === "samsung_watch8");
  assert.equal(samsung.baselinePrice, 20999);
  assert.equal(samsung.id, 9447737262357);

  const fitbit = TRACKED_PRODUCTS.find(p => p.key === "fitbit_charge6");
  assert.equal(fitbit.baselinePrice, 10499);
  assert.equal(fitbit.id, 9361106632981);
});

test("normalizeProductData parses raw Unboxify Shopify data accurately", () => {
  const rawData = {
    id: 9460530118933,
    title: "Sony WH-1000XM6 The Best Wireless Noise Canceling Headphones",
    price: 2990000,
    compare_at_price: 4999000,
    available: true,
    variants: [
      { id: 1, title: "Black", price: 2990000, available: true },
      { id: 2, title: "Silver", price: 2990000, available: false }
    ]
  };

  const product = normalizeProductData(rawData, TRACKED_PRODUCTS[0]);
  assert.equal(product.id, 9460530118933);
  assert.equal(product.shortName, "Sony WH-1000XM6");
  assert.equal(product.price, 29900);
  assert.equal(product.compareAtPrice, 49990);
  assert.equal(product.discountPercent, 40);
  assert.equal(product.available, true);
  assert.equal(product.variants.length, 2);
  assert.equal(product.variants[0].available, true);
  assert.equal(product.variants[1].available, false);
});

test("normalizeProductData handles Samsung Watch 8 with multiple variants", () => {
  const rawSamsung = {
    id: 9447737262357,
    title: "Samsung Galaxy Watch 8 (2025) 40mm Bluetooth Smartwatch",
    price: 2099900,
    compare_at_price: 4599900,
    available: true,
    variants: [
      { id: 101, title: "Graphite", price: 2099900, available: true },
      { id: 102, title: "Silver", price: 2099900, available: true }
    ]
  };

  const product = normalizeProductData(rawSamsung, TRACKED_PRODUCTS[1]);
  assert.equal(product.shortName, "Samsung Galaxy Watch 8 (40mm)");
  assert.equal(product.price, 20999);
  assert.equal(product.compareAtPrice, 45999);
  assert.equal(product.discountPercent, 54);
  assert.equal(product.variants.length, 2);
  assert.equal(product.variants[0].title, "Graphite");
  assert.equal(product.variants[1].title, "Silver");
});

test("buildPriceChangeAlert formats price drop and price increase alerts", () => {
  const current = {
    shortName: "Sony WH-1000XM6",
    price: 27900,
    compareAtPrice: 49990,
    available: true,
    variants: [{ title: "Black", price: 27900, available: true }],
    url: "https://www.unboxify.in/products/sony-wh-1000xm6"
  };

  const dropAlert = buildPriceChangeAlert(current, { price: 29900 });
  assert.match(dropAlert, /PRICE DROP ALERT!/);
  assert.match(dropAlert, /New Price.*27,900/);
  assert.match(dropAlert, /Previous Price.*29,900/);
  assert.match(dropAlert, /-₹2,000/);

  const increaseAlert = buildPriceChangeAlert({ ...current, price: 31900 }, { price: 29900 });
  assert.match(increaseAlert, /PRICE INCREASE ALERT!/);
  assert.match(increaseAlert, /\+₹2,000/);
});

test("buildProductStatusMessage and buildSonyStatusMessage include price, discount and variants", () => {
  const product = {
    shortName: "Samsung Galaxy Watch 8 (40mm)",
    icon: "⌚",
    price: 20999,
    compareAtPrice: 45999,
    discountPercent: 54,
    available: true,
    variants: [
      { title: "Graphite", price: 20999, available: true },
      { title: "Silver", price: 20999, available: true }
    ],
    url: "https://www.unboxify.in/products/samsung-watch-8"
  };

  const msg = buildProductStatusMessage(product);
  assert.match(msg, /Samsung Galaxy Watch 8/);
  assert.match(msg, /₹20,999/);
  assert.match(msg, /54% OFF/);
  assert.match(msg, /Graphite/);
  assert.match(msg, /Silver/);

  // Backward compatibility test for buildSonyStatusMessage
  const sonyMsg = buildSonyStatusMessage(product);
  assert.equal(sonyMsg, msg);
});

test("buildAllProductsSummaryMessage formats multi-product overview", () => {
  const products = [
    {
      shortName: "Sony WH-1000XM6",
      icon: "🎧",
      price: 29900,
      compareAtPrice: 49990,
      discountPercent: 40,
      available: true,
      url: "https://example.com/sony"
    },
    {
      shortName: "Samsung Galaxy Watch 8 (40mm)",
      icon: "⌚",
      price: 20999,
      compareAtPrice: 45999,
      discountPercent: 54,
      available: true,
      url: "https://example.com/samsung"
    },
    {
      shortName: "Fitbit Charge 6",
      icon: "🏃",
      price: 10499,
      compareAtPrice: 14999,
      discountPercent: 30,
      available: true,
      url: "https://example.com/fitbit"
    }
  ];

  const summary = buildAllProductsSummaryMessage(products);
  assert.match(summary, /Unboxify Tracked Gadgets/);
  assert.match(summary, /Sony WH-1000XM6/);
  assert.match(summary, /₹29,900/);
  assert.match(summary, /Samsung Galaxy Watch 8/);
  assert.match(summary, /₹20,999/);
  assert.match(summary, /Fitbit Charge 6/);
  assert.match(summary, /₹10,499/);
  assert.match(summary, /10:00 AM IST/);
});

test("fetchSamsungWatch8, fetchFitbitCharge6, and fetchAllTrackedProducts fetch correctly", async () => {
  const mockFetch = async (url) => {
    if (url.includes("samsung")) {
      return {
        ok: true,
        async json() {
          return {
            id: 9447737262357,
            title: "Samsung Galaxy Watch 8",
            price: 2099900,
            compare_at_price: 4599900,
            available: true,
            variants: [{ id: 1, title: "Graphite", price: 2099900, available: true }]
          };
        }
      };
    }
    if (url.includes("fitbit")) {
      return {
        ok: true,
        async json() {
          return {
            id: 9361106632981,
            title: "Fitbit Charge 6",
            price: 1049900,
            compare_at_price: 1499900,
            available: true,
            variants: [{ id: 2, title: "Coral", price: 1049900, available: true }]
          };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return {
          id: 9460530118933,
          title: "Sony WH-1000XM6",
          price: 2990000,
          compare_at_price: 4999000,
          available: true,
          variants: [{ id: 3, title: "Black", price: 2990000, available: true }]
        };
      }
    };
  };

  const samsung = await fetchSamsungWatch8(mockFetch);
  assert.equal(samsung.price, 20999);
  assert.equal(samsung.shortName, "Samsung Galaxy Watch 8 (40mm)");

  const fitbit = await fetchFitbitCharge6(mockFetch);
  assert.equal(fitbit.price, 10499);
  assert.equal(fitbit.shortName, "Fitbit Charge 6");

  const all = await fetchAllTrackedProducts(mockFetch);
  assert.equal(all.length, 3);
  assert.equal(all[0].key, "sony_xm6");
  assert.equal(all[1].key, "samsung_watch8");
  assert.equal(all[2].key, "fitbit_charge6");
});

test("checkSonyXM6Price detects price change and updates KV state", async () => {
  const kvStore = new Map();
  const mockKv = {
    async get(k) { return kvStore.get(k) || null; },
    async put(k, v) { kvStore.set(k, v); }
  };

  const mockFetch = async () => ({
    ok: true,
    async json() {
      return {
        id: 9460530118933,
        title: "Sony WH-1000XM6",
        price: 2790000, // Dropped to 27900 from baseline 29900
        compare_at_price: 4999000,
        available: true,
        variants: []
      };
    }
  });

  const res = await checkSonyXM6Price(
    {
      TELEGRAM_BOT_TOKEN: "mock_token",
      TELEGRAM_CHAT_ID: "mock_chat",
      BOTANICALS_STORE: mockKv
    },
    {
      customFetch: mockFetch
    }
  );

  assert.equal(res.success, true);
  assert.equal(res.priceChanged, true);
  assert.equal(res.currentPrice, 27900);
  assert.equal(res.previousPrice, 29900);

  // Check KV was updated
  const stored = JSON.parse(kvStore.get(KV_KEY_PRICE_SONY_XM6));
  assert.equal(stored.price, 27900);
  assert.equal(stored.previousPrice, 29900);
});

test("checkAllTrackedPrices checks all 3 products and notifies on price change", async () => {
  const kvStore = new Map();
  const mockKv = {
    async get(k) { return kvStore.get(k) || null; },
    async put(k, v) { kvStore.set(k, v); }
  };

  let sentTelegramMessages = [];
  const mockFetch = async (url, opts) => {
    if (url.includes("api.telegram.org")) {
      sentTelegramMessages.push(opts?.body);
      return { ok: true, async json() { return { ok: true }; } };
    }
    if (url.includes("samsung")) {
      return {
        ok: true,
        async json() {
          return {
            id: 9447737262357,
            title: "Samsung Galaxy Watch 8",
            price: 1899900, // Price dropped from baseline 20999 to 18999!
            compare_at_price: 4599900,
            available: true,
            variants: [{ id: 1, title: "Graphite", price: 1899900, available: true }]
          };
        }
      };
    }
    if (url.includes("fitbit")) {
      return {
        ok: true,
        async json() {
          return {
            id: 9361106632981,
            title: "Fitbit Charge 6",
            price: 1049900, // Unchanged at baseline 10499
            compare_at_price: 1499900,
            available: true,
            variants: [{ id: 2, title: "Coral", price: 1049900, available: true }]
          };
        }
      };
    }
    // Sony
    return {
      ok: true,
      async json() {
        return {
          id: 9460530118933,
          title: "Sony WH-1000XM6",
          price: 2990000, // Unchanged at baseline 29900
          compare_at_price: 4999000,
          available: true,
          variants: []
        };
      }
    };
  };

  const res = await checkAllTrackedPrices(
    {
      TELEGRAM_BOT_TOKEN: "mock_token",
      TELEGRAM_CHAT_ID: "mock_chat",
      BOTANICALS_STORE: mockKv
    },
    {
      customFetch: mockFetch
    }
  );

  assert.equal(res.success, true);
  assert.equal(res.checkedCount, 3);
  assert.equal(res.results[0].priceChanged, false); // Sony unchanged
  assert.equal(res.results[1].priceChanged, true);  // Samsung changed!
  assert.equal(res.results[1].currentPrice, 18999);
  assert.equal(res.results[2].priceChanged, false); // Fitbit unchanged

  // Telegram alert was dispatched for Samsung Watch
  assert.equal(sentTelegramMessages.length, 1);
  assert.match(sentTelegramMessages[0], /Samsung Galaxy Watch 8/);
  assert.match(sentTelegramMessages[0], /18,999/);
});
