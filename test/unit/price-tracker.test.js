import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProductData,
  buildPriceChangeAlert,
  buildSonyStatusMessage,
  checkSonyXM6Price,
  BASELINE_PRICE,
  KV_KEY_PRICE_SONY_XM6
} from "../../src/priceTracker.js";

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

  const product = normalizeProductData(rawData);
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

test("buildSonyStatusMessage includes price, discount and variants", () => {
  const product = {
    shortName: "Sony WH-1000XM6",
    price: 29900,
    compareAtPrice: 49990,
    discountPercent: 40,
    available: true,
    variants: [
      { title: "Black", price: 29900, available: true },
      { title: "Midnight Blue", price: 29900, available: true }
    ],
    url: "https://www.unboxify.in/products/sony-wh-1000xm6"
  };

  const msg = buildSonyStatusMessage(product);
  assert.match(msg, /Sony WH-1000XM6/);
  assert.match(msg, /₹29,900/);
  assert.match(msg, /40% OFF/);
  assert.match(msg, /Black/);
  assert.match(msg, /Midnight Blue/);
});

test("checkSonyXM6Price detects price change and updates KV state", async () => {
  const kvStore = new Map();
  const mockKv = {
    async get(k) { return kvStore.get(k) || null; },
    async put(k, v) { kvStore.set(k, v); }
  };

  let sentMessages = [];
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

test("checkSonyXM6Price does not flag price change when price remains at baseline 29900", async () => {
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
        price: 2990000, // Unchanged at 29900
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
  assert.equal(res.priceChanged, false);
  assert.equal(res.currentPrice, 29900);
});
