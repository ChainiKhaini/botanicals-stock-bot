import test from "node:test";
import assert from "node:assert/strict";
import worker from "../../src/index.js";

test("/cron endpoint rejects unauthorized requests without token", async () => {
  const req = new Request("http://localhost/cron");
  const env = { ADMIN_TOKEN: "valid_admin_token_123" };
  const ctx = { waitUntil() {} };

  const res = await worker.fetch(req, env, ctx);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Unauthorized/);
});

test("/cron endpoint rejects invalid admin token", async () => {
  const req = new Request("http://localhost/cron?token=invalid_token");
  const env = { ADMIN_TOKEN: "valid_admin_token_123" };
  const ctx = { waitUntil() {} };

  const res = await worker.fetch(req, env, ctx);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Invalid admin token/);
});

test("/cron endpoint accepts valid token via query parameter (?token=)", async () => {
  let backgroundPromise = null;
  const req = new Request("http://localhost/cron?token=valid_admin_token_123&type=daily");
  const env = { ADMIN_TOKEN: "valid_admin_token_123" };
  const ctx = {
    waitUntil(promise) {
      backgroundPromise = promise;
    }
  };

  const res = await worker.fetch(req, env, ctx);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.mode, "daily_digest");
  assert.match(data.message, /Daily stock digest/);
  assert.ok(backgroundPromise);
});

test("/cron endpoint accepts valid token via Bearer header", async () => {
  let backgroundPromise = null;
  const req = new Request("http://localhost/cron", {
    headers: { "Authorization": "Bearer valid_admin_token_123" }
  });
  const env = { ADMIN_TOKEN: "valid_admin_token_123" };
  const ctx = {
    waitUntil(promise) {
      backgroundPromise = promise;
    }
  };

  const res = await worker.fetch(req, env, ctx);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.mode, "periodic_check");
  assert.match(data.message, /Stock check/);
  assert.ok(backgroundPromise);
});

test("/cron endpoint accepts ?type=sony for 10 AM IST Sony XM6 price tracking", async () => {
  let backgroundPromise = null;
  const req = new Request("http://localhost/cron?token=valid_admin_token_123&type=sony");
  const env = { ADMIN_TOKEN: "valid_admin_token_123" };
  const ctx = {
    waitUntil(promise) {
      backgroundPromise = promise;
    }
  };

  const res = await worker.fetch(req, env, ctx);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.mode, "sony_price_check");
  assert.match(data.message, /Sony WH-1000XM6 price check/);
  assert.ok(backgroundPromise);
});
