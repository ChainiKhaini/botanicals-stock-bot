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