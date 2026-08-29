/**
 * Scraper module for 100% Pure Botanicals
 * Endpoint: GoDaddy Online Store API v2
 * Enforces fail-closed completeness validation, bounded concurrency, and pre-computed classification.
 */

import { classifyProduct } from "./classifier.js";

export const STORE_API_BASE = "https://79b5e8ea-9db5-4e7f-bbf4-ba7bbf739236.onlinestore.godaddy.com/api/v2";
export const STORE_FRONTEND_BASE = "https://100percentpurebotanicals.com";
export const MAX_SAFE_PAGES = 50;
export const DEFAULT_CONCURRENCY = 4;

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class ScraperError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ScraperError";
    this.details = details;
  }
}

/**
 * Fetch a single page of products from GoDaddy API.
 * Fails closed: any non-200 or timeout throws ScraperError.
 */
export async function fetchProductPage(page = 1, perPage = 100, customFetch = fetch) {
  const url = `${STORE_API_BASE}/products?page=${page}&per_page=${perPage}&sort=featured`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await customFetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new ScraperError(`Failed to fetch page ${page}: HTTP ${res.status} (${res.statusText})`, { page, status: res.status });
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.products)) {
      throw new ScraperError(`Invalid page payload on page ${page}: missing products array`, { page });
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof ScraperError) throw err;
    throw new ScraperError(`Network/Fetch error on page ${page}: ${err.message}`, { page, originalError: err.message });
  }
}

/**
 * Normalizes raw API product object into clean structured format.
 * Pre-computes classification once at ingest time so Telegram commands run in O(1).
 */
export function normalizeProduct(raw, observedAt = new Date().toISOString()) {
  const id = String(raw.id);
  const slug = raw.slug || "";
  const name = (raw.name || raw.title || "Unknown Product").replace(/\s+/g, " ").trim();
  
  let relativeUrl = raw.relative_url;
  if (!relativeUrl) {
    relativeUrl = slug ? `/shop/ols/products/${slug}` : "/shop";
  }
  const fullUrl = `${STORE_FRONTEND_BASE}${relativeUrl}`;

  // Price parsing
  let priceDisplay = "N/A";
  let priceNumeric = null;
  if (raw.price && typeof raw.price === "object") {
    priceDisplay = raw.price.display || `₹${raw.price.numeric || 0}`;
    priceNumeric = typeof raw.price.numeric === "number" ? raw.price.numeric : null;
  } else if (typeof raw.price === "number") {
    priceDisplay = `₹${raw.price}`;
    priceNumeric = raw.price;
  }

  // Stock status
  const inStock = raw.in_stock === true;
  const totalOnHand = typeof raw.total_on_hand === "number" ? raw.total_on_hand : null;
  const imageUrl = raw.default_asset_url || (raw.image_list && raw.image_list[0]?.url) || "";

  // Timestamp semantics
  const sourceUpdatedAt = raw.updated_at || null;

  // Pre-computed classification (done once per product on ingestion)
  const classification = classifyProduct({ name });

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
    sourceUpdatedAt,
    lastObservedAt: observedAt,
    status: inStock ? "active" : "out_of_stock",
    isPsychedelic: classification.isPsychedelic,
    categoryLabel: classification.categoryLabel || null,
    potency: classification.potency || null,
    description: classification.description || null
  };
}

/**
 * Validates scraped catalog completeness and integrity.
 * Throws ScraperError if incomplete or corrupt.
 */
export function validateCatalogCompleteness(rawProducts, expectedTotalCount, expectedTotalPages) {
  if (!Array.isArray(rawProducts)) {
    throw new ScraperError("Validation failed: products is not an array");
  }

  if (rawProducts.length !== expectedTotalCount) {
    throw new ScraperError(
      `Catalog completeness validation failed: fetched ${rawProducts.length} products, but API reported ${expectedTotalCount} total_count`,
      { fetchedCount: rawProducts.length, expectedTotalCount, expectedTotalPages }
    );
  }

  // Duplicate ID detection
  const seenIds = new Set();
  const duplicateIds = [];

  for (const item of rawProducts) {
    const id = String(item.id);
    if (seenIds.has(id)) {
      duplicateIds.push(id);
    }
    seenIds.add(id);
  }

  if (duplicateIds.length > 0) {
    throw new ScraperError(
      `Catalog integrity validation failed: detected ${duplicateIds.length} duplicate product ID(s): ${duplicateIds.slice(0, 5).join(", ")}`,
      { duplicateIds }
    );
  }

  return true;
}

/**
 * Bounded concurrency runner for parallel page fetches.
 */
async function fetchPagesWithConcurrency(pageNumbers, perPage, concurrency = DEFAULT_CONCURRENCY, customFetch = fetch) {
  const results = new Map();
  const queue = [...pageNumbers];

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const page = queue.shift();
      const pageData = await fetchProductPage(page, perPage, customFetch);
      results.set(page, pageData.products || []);
    }
  });

  await Promise.all(workers);

  // Return in original page order
  const allProducts = [];
  for (const page of pageNumbers) {
    const pageItems = results.get(page) || [];
    allProducts.push(...pageItems);
  }

  return allProducts;
}

/**
 * Fetches the entire catalog across all pages with strict completeness verification.
 * Fails closed: any page error, count mismatch, or duplicate ID aborts the scan.
 */
export async function fetchFullCatalog(options = {}) {
  const perPage = options.perPage || 100;
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
  const customFetch = options.customFetch || fetch;

  const startTime = Date.now();
  const observedAt = new Date().toISOString();

  // 1. Fetch first page to obtain pagination metadata
  const firstPageData = await fetchProductPage(1, perPage, customFetch);
  const totalPages = firstPageData.pages || 1;
  const totalExpectedCount = firstPageData.total_count ?? (firstPageData.products ? firstPageData.products.length : 0);

  // Safety guard: throw error if totalPages exceeds safety bound instead of silent truncation
  if (totalPages > MAX_SAFE_PAGES) {
    throw new ScraperError(
      `Store reported ${totalPages} pages, exceeding safety limit of ${MAX_SAFE_PAGES}. Manual review required.`,
      { totalPages, MAX_SAFE_PAGES }
    );
  }

  const rawProducts = [...(firstPageData.products || [])];

  // 2. Concurrently fetch remaining pages with bounded concurrency
  if (totalPages > 1) {
    const remainingPages = [];
    for (let p = 2; p <= totalPages; p++) {
      remainingPages.push(p);
    }

    const remainingItems = await fetchPagesWithConcurrency(remainingPages, perPage, concurrency, customFetch);
    rawProducts.push(...remainingItems);
  }

  // 3. Strict completeness & integrity validation
  validateCatalogCompleteness(rawProducts, totalExpectedCount, totalPages);

  // 4. Normalize products with pre-computed classification
  const products = rawProducts.map(raw => normalizeProduct(raw, observedAt));
  const inStockProducts = products.filter(p => p.inStock);
  const outOfStockProducts = products.filter(p => !p.inStock);

  return {
    success: true,
    products,
    totalCount: products.length,
    catalogReportedTotal: totalExpectedCount,
    totalPages,
    inStockCount: inStockProducts.length,
    outOfStockCount: outOfStockProducts.length,
    inStockProducts,
    outOfStockProducts,
    fetchedAt: observedAt,
    durationMs: Date.now() - startTime
  };
}
