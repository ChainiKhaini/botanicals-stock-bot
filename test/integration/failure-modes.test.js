import test from "node:test";
import assert from "node:assert/strict";
import { performStockCheck } from "../../src/monitor.js";
import { KV_KEY_SNAPSHOT } from "../../src/store.js";

test("performStockCheck fails closed on page fetch failure without corrupting KV snapshot", async () => {
  const kvStore = new Map();
  const initialSnapshot = {
    "1": { id: "1", name: "Initial Product", inStock: true, price: "₹500" }
  };
  kvStore.set(KV_KEY_SNAPSHOT, JSON.stringify(initialSnapshot));

  const mockKv = {
    async get(k) { return kvStore.get(k) || null; },
    async put(k, v) { kvStore.set(k, v); },
    async delete(k) { kvStore.delete(k); }
  };

  const mockFetch = async (rawUrl) => {
    const urlObj = new URL(rawUrl);
    const page = urlObj.searchParams.get("page");
    if (page === "1") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            total_count: 200,
            pages: 2,
            products: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}`, in_stock: true }))
          };
        }
      };
    }
    // Page 2 network/server failure
    return {
      ok: false,
      status: 500,
      statusText: "Internal Server Error"
    };
  };

  const result = await performStockCheck(
    { BOTANICALS_STORE: mockKv },
    { customFetch: mockFetch }
  );

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
  assert.match(result.error, /HTTP 500/);

  // CORE INVARIANT: Snapshot in KV MUST remain completely untouched
  const snapshotAfterFailure = JSON.parse(kvStore.get(KV_KEY_SNAPSHOT));
  assert.deepEqual(snapshotAfterFailure, initialSnapshot);
});

test("performStockCheck prevents duplicate daily digest on the same day", async () => {
  const kvStore = new Map();
  const initialSnapshot = {
    "1": { id: "1", name: "Product 1", inStock: true, price: "₹500" }
  };
  kvStore.set(KV_KEY_SNAPSHOT, JSON.stringify(initialSnapshot));

  const mockKv = {
    async get(k, opts) {
      const val = kvStore.get(k);
      if (!val) return null;
      if (opts && opts.type === "json") return JSON.parse(val);
      return val;
    },
    async put(k, v) { kvStore.set(k, v); },
    async delete(k) { kvStore.delete(k); }
  };

  let sentMessages = [];
  const mockFetch = async (rawUrl, opts) => {
    if (rawUrl.includes("api.telegram.org")) {
      sentMessages.push(opts?.body);
      return { ok: true, async json() { return { ok: true }; } };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          total_count: 1,
          pages: 1,
          products: [{ id: 1, name: "Product 1", in_stock: true, price: "₹500" }]
        };
      }
    };
  };

  const env = {
    BOTANICALS_STORE: mockKv,
    TELEGRAM_BOT_TOKEN: "mock_token",
    TELEGRAM_CHAT_ID: "mock_chat"
  };

  // Run 1: First 6:00 PM IST daily digest of the day
  const res1 = await performStockCheck(env, { isScheduled: true, customFetch: mockFetch });
  assert.equal(res1.success, true);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /Daily Stock Update/);

  // Run 2: Duplicate 6:00 PM IST trigger (e.g. cloudflare cron + cron-job.org)
  const res2 = await performStockCheck(env, { isScheduled: true, customFetch: mockFetch });
  assert.equal(res2.success, true);
  // Still exactly 1 message - duplicate was blocked!
  assert.equal(sentMessages.length, 1);
});