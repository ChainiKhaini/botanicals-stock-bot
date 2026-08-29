/**
 * Scraper module for 100% Pure Botanicals
 * Endpoint: GoDaddy Online Store API v2
 */

const STORE_API_BASE = "https://79b5e8ea-9db5-4e7f-bbf4-ba7bbf739236.onlinestore.godaddy.com/api/v2";
const STORE_FRONTEND_BASE = "https://100percentpurebotanicals.com";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetch a single page of products
 */
export async function fetchProductPage(page = 1, perPage = 100) {
  const url = `${STORE_API_BASE}/products?page=${page}&per_page=${perPage}&sort=featured`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`API returned HTTP ${res.status} (${res.statusText})`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Normalizes raw API product object into a clean structured format
 */
export function normalizeProduct(raw) {
  const id = String(raw.id);
  const slug = raw.slug || "";
  const name = (raw.name || raw.title || "Unknown Product").replace(/\s+/g, " ").trim();
  
  let relativeUrl = raw.relative_url;
  if (!relativeUrl) {
    relativeUrl = slug ? `/shop/ols/products/${slug}` : "/shop";
  }
  const fullUrl = `${STORE_FRONTEND_BASE}${relativeUrl}`;

  // Price formatting
  let priceDisplay = "N/A";
  let priceNumeric = null;
  if (raw.price && typeof raw.price === "object") {
    priceDisplay = raw.price.display || `₹${raw.price.numeric || 0}`;
    priceNumeric = raw.price.numeric;
  } else if (typeof raw.price === "number") {
    priceDisplay = `₹${raw.price}`;
    priceNumeric = raw.price;
  }

  // Stock status determination
  const inStock = raw.in_stock === true;
  const totalOnHand = typeof raw.total_on_hand === "number" ? raw.total_on_hand : null;
  const imageUrl = raw.default_asset_url || (raw.image_list && raw.image_list[0]?.url) || "";

  return {
    id,
    name,
    slug,
    url: fullUrl,
    relativeUrl,
    price: priceDisplay,
    priceNumeric,
    inStock,
    totalOnHand,
    imageUrl,
    updatedAt: raw.updated_at || new Date().toISOString()
  };
}

/**
 * Fetches the entire catalog across all pages
 * Returns normalized product list and stock statistics
 */
export async function fetchFullCatalog(options = {}) {
  const perPage = options.perPage || 100;
  const maxPagesLimit = options.maxPagesLimit || 20;

  // 1. Fetch first page to obtain pagination metadata
  const firstPageData = await fetchProductPage(1, perPage);
  const totalPages = Math.min(firstPageData.pages || 1, maxPagesLimit);
  const totalCount = firstPageData.total_count || firstPageData.products?.length || 0;

  const rawProducts = [...(firstPageData.products || [])];

  // 2. Concurrently fetch remaining pages
  if (totalPages > 1) {
    const remainingPagePromises = [];
    for (let p = 2; p <= totalPages; p++) {
      remainingPagePromises.push(
        fetchProductPage(p, perPage).then(data => data.products || []).catch(err => {
          console.error(`Error on page ${p}:`, err.message);
          return [];
        })
      );
    }

    const remainingResults = await Promise.all(remainingPagePromises);
    for (const pageItems of remainingResults) {
      rawProducts.push(...pageItems);
    }
  }

  // 3. Normalize all products
  const products = rawProducts.map(normalizeProduct);

  const inStockProducts = products.filter(p => p.inStock);
  const outOfStockProducts = products.filter(p => !p.inStock);

  return {
    products,
    totalCount: products.length,
    catalogReportedTotal: totalCount,
    totalPages,
    inStockCount: inStockProducts.length,
    outOfStockCount: outOfStockProducts.length,
    inStockProducts,
    outOfStockProducts,
    fetchedAt: new Date().toISOString()
  };
}
