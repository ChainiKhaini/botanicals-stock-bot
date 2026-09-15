import test from "node:test";
import assert from "node:assert/strict";
import { timingSafeCompare, validateWebhookSecret, validateAdminAuth, checkRateLimit } from "../../src/auth.js";

test("timingSafeCompare validates matching and non-matching tokens", async () => {
  assert.equal(await timingSafeCompare("secret_token_123", "secret_token_123"), true);
  assert.equal(await timingSafeCompare("secret_token_123", "wrong_token"), false);
  assert.equal(await timingSafeCompare("short", "much_longer_token_value"), false);
  assert.equal(await timingSafeCompare("", "secret"), false);
  assert.equal(await timingSafeCompare(null, "secret"), false);
});

test("validateWebhookSecret fails closed when secret is missing or invalid", async () => {
  // Missing secret in env
  const req1 = new Request("http://localhost/webhook", {
    headers: { "X-Telegram-Bot-Api-Secret-Token": "test" }
  });
  const res1 = await validateWebhookSecret(req1, {});
  assert.equal(res1.valid, false);
  assert.match(res1.error, /Server misconfiguration/);

  // Mismatched token
  const req2 = new Request("http://localhost/webhook", {
    headers: { "X-Telegram-Bot-Api-Secret-Token": "bad_token" }
  });
  const res2 = await validateWebhookSecret(req2, { TELEGRAM_WEBHOOK_SECRET: "good_token" });
  assert.equal(res2.valid, false);
  assert.match(res2.error, /Unauthorized/);

  // Valid token
  const req3 = new Request("http://localhost/webhook", {
    headers: { "X-Telegram-Bot-Api-Secret-Token": "good_token" }
  });
  const res3 = await validateWebhookSecret(req3, { TELEGRAM_WEBHOOK_SECRET: "good_token" });
  assert.equal(res3.valid, true);
});

test("validateAdminAuth fails closed when admin token is missing or invalid", async () => {
  // Missing ADMIN_TOKEN in env
  const req1 = new Request("http://localhost/check", {
    headers: { "Authorization": "Bearer test" }
  });
  const res1 = await validateAdminAuth(req1, {});
  assert.equal(res1.valid, false);
  assert.match(res1.error, /Server misconfiguration/);

  // Missing Authorization header
  const req2 = new Request("http://localhost/check");
  const res2 = await validateAdminAuth(req2, { ADMIN_TOKEN: "admin_pass" });
  assert.equal(res2.valid, false);
  assert.match(res2.error, /Missing Bearer token/);

  // Valid token via Bearer header
  const req3 = new Request("http://localhost/check", {
    headers: { "Authorization": "Bearer admin_pass" }
  });
  const res3 = await validateAdminAuth(req3, { ADMIN_TOKEN: "admin_pass" });
  assert.equal(res3.valid, true);

  // Valid token via URL query parameter (?token=...)
  const req4 = new Request("http://localhost/cron?token=admin_pass");
  const res4 = await validateAdminAuth(req4, { ADMIN_TOKEN: "admin_pass" });
  assert.equal(res4.valid, true);

  // Invalid token via URL query parameter
  const req5 = new Request("http://localhost/cron?token=wrong_pass");
  const res5 = await validateAdminAuth(req5, { ADMIN_TOKEN: "admin_pass" });
  assert.equal(res5.valid, false);
  assert.match(res5.error, /Invalid admin token/);
});

test("checkRateLimit prevents rapid repeated calls", async () => {
  const store = new Map();
  const mockKv = {
    async get(k) { return store.get(k) || null; },
    async put(k, v) { store.set(k, v); }
  };

  const r1 = await checkRateLimit(mockKv, "test_check", 60);
  assert.equal(r1.allowed, true);

  const r2 = await checkRateLimit(mockKv, "test_check", 60);
  assert.equal(r2.allowed, false);
  assert.equal(r2.remainingSeconds > 0, true);
});