/**
 * Authentication and Security Helpers
 * Uses Web Crypto API for constant-time comparisons
 */

/**
 * Constant-time string comparison using Web Crypto API to prevent timing attacks.
 * Uses SHA-256 digests so both inputs always have equal buffer lengths (32 bytes).
 */
export async function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  if (!a || !b) {
    return false;
  }

  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  // Hash both inputs with SHA-256 to ensure identical buffer length
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", aBuf),
    crypto.subtle.digest("SHA-256", bBuf)
  ]);

  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);

  // Constant-time XOR accumulation
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i] ^ viewB[i];
  }

  return diff === 0;
}

/**
 * Validates Telegram webhook request secret.
 * FAILS CLOSED: Returns false if TELEGRAM_WEBHOOK_SECRET is not configured or mismatch.
 */
export async function validateWebhookSecret(request, env) {
  const configuredSecret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!configuredSecret) {
    console.error("Security Error: TELEGRAM_WEBHOOK_SECRET is not configured in environment");
    return { valid: false, error: "Server misconfiguration: Webhook secret missing" };
  }

  const incomingSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  const isValid = await timingSafeCompare(incomingSecret, configuredSecret);

  if (!isValid) {
    return { valid: false, error: "Unauthorized: Invalid webhook secret token" };
  }

  return { valid: true };
}

/**
 * Validates Admin token for protected endpoints (/check).
 * FAILS CLOSED: Returns false if ADMIN_TOKEN is not configured or mismatch.
 */
export async function validateAdminAuth(request, env) {
  const configuredToken = env.ADMIN_TOKEN;
  if (!configuredToken) {
    console.error("Security Error: ADMIN_TOKEN is not configured in environment");
    return { valid: false, error: "Server misconfiguration: Admin token missing" };
  }

  const authHeader = request.headers.get("Authorization") || "";
  const prefix = "Bearer ";

  if (!authHeader.startsWith(prefix)) {
    return { valid: false, error: "Unauthorized: Missing Bearer token" };
  }

  const token = authHeader.substring(prefix.length).trim();
  const isValid = await timingSafeCompare(token, configuredToken);

  if (!isValid) {
    return { valid: false, error: "Unauthorized: Invalid admin token" };
  }

  return { valid: true };
}

/**
 * Lightweight rate-limiter using KV to prevent abuse of expensive /check endpoints.
 * @param {KVNamespace} kv
 * @param {string} key
 * @param {number} cooldownSeconds - Minimum seconds between allowed calls (default 60s)
 * @returns {Promise<{ allowed: boolean, remainingSeconds?: number }>}
 */
export async function checkRateLimit(kv, key = "rate_limit_check", cooldownSeconds = 60) {
  if (!kv) {
    return { allowed: true };
  }

  try {
    const lastRunStr = await kv.get(key);
    const now = Date.now();

    if (lastRunStr) {
      const lastRun = parseInt(lastRunStr, 10);
      const elapsedSeconds = Math.floor((now - lastRun) / 1000);
      if (elapsedSeconds < cooldownSeconds) {
        return {
          allowed: false,
          remainingSeconds: cooldownSeconds - elapsedSeconds
        };
      }
    }

    // Set new timestamp with expiration
    await kv.put(key, String(now), { expirationTtl: cooldownSeconds + 30 });
    return { allowed: true };
  } catch (err) {
    console.warn("Rate limiter KV error, allowing request:", err.message);
    return { allowed: true };
  }
}
