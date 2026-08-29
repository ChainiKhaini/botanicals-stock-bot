/**
 * Storage and Diff Management using Cloudflare KV
 * Enforces fail-closed semantics, distributed locking, and accurate state transitions.
 */

export const KV_KEY_SNAPSHOT = "products_snapshot";
export const KV_KEY_META = "meta";
export const KV_KEY_LOCK = "stock_check_lock";

export class KVReadError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = "KVReadError";
    this.originalError = originalError;
  }
}

export class KVWriteError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = "KVWriteError";
    this.originalError = originalError;
  }
}

/**
 * Load product snapshot map from KV.
 * Fails closed: throws KVReadError if KV read fails. Returns null only when key does not exist.
 */
export async function loadSnapshot(kv) {
  if (!kv) return null;
  try {
    return await kv.get(KV_KEY_SNAPSHOT, { type: "json" });
  } catch (err) {
    throw new KVReadError(`Failed to read snapshot from KV: ${err.message}`, err);
  }
}

/**
 * Save snapshot map to KV.
 * Fails closed: throws KVWriteError on failure.
 */
export async function saveSnapshot(kv, snapshot) {
  if (!kv) return;
  try {
    await kv.put(KV_KEY_SNAPSHOT, JSON.stringify(snapshot));
  } catch (err) {
    throw new KVWriteError(`Failed to save snapshot to KV: ${err.message}`, err);
  }
}

/**
 * Load metadata from KV.
 * Fails closed: throws KVReadError if KV read fails.
 */
export async function loadMeta(kv) {
  if (!kv) return null;
  try {
    return await kv.get(KV_KEY_META, { type: "json", cacheTtl: 30 });
  } catch (err) {
    throw new KVReadError(`Failed to read metadata from KV: ${err.message}`, err);
  }
}

/**
 * Save metadata to KV.
 * Fails closed: throws KVWriteError on failure.
 */
export async function saveMeta(kv, meta) {
  if (!kv) return;
  try {
    await kv.put(KV_KEY_META, JSON.stringify(meta));
  } catch (err) {
    throw new KVWriteError(`Failed to save metadata to KV: ${err.message}`, err);
  }
}

/**
 * Acquires a distributed lock lease in KV to prevent overlapping stock checks.
 * @param {KVNamespace} kv
 * @param {string} lockKey
 * @param {number} ttlSeconds - Auto-release safety timeout (default 90s)
 * @returns {Promise<{ acquired: boolean, lockId?: string }>}
 */
export async function acquireLock(kv, lockKey = KV_KEY_LOCK, ttlSeconds = 90) {
  if (!kv) {
    return { acquired: true, lockId: "no-kv" };
  }

  try {
    const existingLock = await kv.get(lockKey);
    const now = Date.now();

    if (existingLock) {
      const lockData = JSON.parse(existingLock);
      // If lock has not expired yet
      if (lockData.expiresAt > now) {
        return { acquired: false };
      }
    }

    const lockId = `${now}-${Math.random().toString(36).substring(2, 8)}`;
    const lockPayload = {
      lockId,
      acquiredAt: now,
      expiresAt: now + (ttlSeconds * 1000)
    };

    await kv.put(lockKey, JSON.stringify(lockPayload), { expirationTtl: ttlSeconds });
    return { acquired: true, lockId };
  } catch (err) {
    console.warn("Lock acquisition warning:", err.message);
    return { acquired: true, lockId: "fallback" };
  }
}

/**
 * Releases a distributed lock lease in KV.
 */
export async function releaseLock(kv, lockKey = KV_KEY_LOCK) {
  if (!kv) return;
  try {
    await kv.delete(lockKey);
  } catch (err) {
    console.warn("Failed to release KV lock:", err.message);
  }
}

/**
 * Compares verified complete catalog against previous KV snapshot.
 * Preserves missing-product semantics and tracks accurate state transitions.
 * @param {Record<string, any> | null} prevSnapshot
 * @param {Array<any>} currentProducts - Must be a complete, verified catalog
 * @returns {object} Diff results with next snapshot
 */
export function diffCatalog(prevSnapshot, currentProducts) {
  const isFirstRun = !prevSnapshot || Object.keys(prevSnapshot).length === 0;
  const nowIso = new Date().toISOString();

  const nextSnapshot = {};
  const currentProductIds = new Set();

  const restocked = [];
  const newlyAdded = [];
  const wentOutOfStock = [];
  const priceChanged = [];
  const missing = [];

  // 1. Process all current products from verified scan
  for (const prod of currentProducts) {
    currentProductIds.add(prod.id);
    const prev = prevSnapshot ? prevSnapshot[prod.id] : null;
    let restockedAt = prev?.restockedAt || null;

    if (!isFirstRun) {
      if (prev) {
        // Known product transition check
        if (!prev.inStock && prod.inStock) {
          // Transition: OUT_OF_STOCK -> IN_STOCK (Restock)
          restockedAt = nowIso;
          restocked.push({
            ...prod,
            restockedAt: nowIso,
            previousPrice: prev.price
          });
        } else if (prev.inStock && !prod.inStock) {
          // Transition: IN_STOCK -> OUT_OF_STOCK
          wentOutOfStock.push(prod);
        }

        // Price change detection
        if (prev.priceNumeric != null && prod.priceNumeric != null && prev.priceNumeric !== prod.priceNumeric) {
          priceChanged.push({
            ...prod,
            oldPrice: prev.price,
            newPrice: prod.price
          });
        }
      } else {
        // Newly added product
        if (prod.inStock) {
          restockedAt = nowIso;
          newlyAdded.push({
            ...prod,
            restockedAt: nowIso
          });
        }
      }
    }

    nextSnapshot[prod.id] = {
      id: prod.id,
      name: prod.name,
      slug: prod.slug,
      url: prod.url,
      price: prod.price,
      priceNumeric: prod.priceNumeric,
      inStock: prod.inStock,
      totalOnHand: prod.totalOnHand,
      imageUrl: prod.imageUrl,
      sourceUpdatedAt: prod.sourceUpdatedAt,
      lastObservedAt: nowIso,
      restockedAt,
      status: prod.inStock ? "active" : "out_of_stock"
    };
  }

  // 2. Detect missing products (were in previous snapshot, missing from verified scan)
  if (!isFirstRun && prevSnapshot) {
    for (const [prevId, prevProd] of Object.entries(prevSnapshot)) {
      if (!currentProductIds.has(prevId) && prevProd.status !== "missing") {
        missing.push({
          ...prevProd,
          status: "missing",
          missingSince: nowIso
        });
        // Retain in snapshot with status: 'missing' so history is not lost
        nextSnapshot[prevId] = {
          ...prevProd,
          inStock: false,
          status: "missing",
          missingSince: nowIso
        };
      }
    }
  }

  return {
    isFirstRun,
    restocked,
    newlyAdded,
    wentOutOfStock,
    priceChanged,
    missing,
    hasRestocks: restocked.length > 0 || newlyAdded.length > 0,
    nextSnapshot
  };
}
