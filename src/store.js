/**
 * Storage and Diff Management using Cloudflare KV
 */

export const KV_KEY_SNAPSHOT = "products_snapshot";
export const KV_KEY_META = "meta";

/**
 * Load the previous product snapshot map from KV
 * @returns {Promise<Record<string, { id: string, name: string, url: string, price: string, inStock: boolean, restockedAt?: string }> | null>}
 */
export async function loadSnapshot(kv) {
  if (!kv) return null;
  try {
    return await kv.get(KV_KEY_SNAPSHOT, { type: "json" });
  } catch (err) {
    console.error("Failed to load snapshot from KV:", err.message);
    return null;
  }
}

/**
 * Save current snapshot map to KV
 */
export async function saveSnapshot(kv, snapshot) {
  if (!kv) return;
  try {
    await kv.put(KV_KEY_SNAPSHOT, JSON.stringify(snapshot));
  } catch (err) {
    console.error("Failed to save snapshot to KV:", err.message);
  }
}

/**
 * Load metadata from KV
 */
export async function loadMeta(kv) {
  if (!kv) return null;
  try {
    return await kv.get(KV_KEY_META, { type: "json", cacheTtl: 60 });
  } catch (err) {
    console.error("Failed to load meta from KV:", err.message);
    return null;
  }
}

/**
 * Save metadata to KV
 */
export async function saveMeta(kv, meta) {
  if (!kv) return;
  try {
    await kv.put(KV_KEY_META, JSON.stringify(meta));
  } catch (err) {
    console.error("Failed to save meta to KV:", err.message);
  }
}

/**
 * Compare current catalog products against previous KV snapshot
 * to identify stock changes (restocks, newly added, newly out of stock)
 */
export function diffCatalog(prevSnapshot, currentProducts) {
  const isFirstRun = !prevSnapshot || Object.keys(prevSnapshot).length === 0;
  const nowIso = new Date().toISOString();

  const nextSnapshot = {};
  const restocked = [];
  const newlyAdded = [];
  const wentOutOfStock = [];

  for (const prod of currentProducts) {
    const prev = prevSnapshot ? prevSnapshot[prod.id] : null;

    let restockedAt = prev?.restockedAt || null;

    if (!isFirstRun) {
      if (prev) {
        // Product was known previously
        if (!prev.inStock && prod.inStock) {
          // Transition: OUT_OF_STOCK -> IN_STOCK
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
      lastSeen: nowIso,
      restockedAt
    };
  }

  return {
    isFirstRun,
    restocked,
    newlyAdded,
    wentOutOfStock,
    hasRestocks: restocked.length > 0 || newlyAdded.length > 0,
    nextSnapshot
  };
}
