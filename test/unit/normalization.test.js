import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProduct } from "../../src/scraper.js";

test("normalizeProduct parses raw API product into structured format", () => {
  const raw = {
    id: 123,
    slug: "san-pedro-seeds",
    name: "San Pedro Seeds",
    price: { display: "₹649.00", numeric: 649 },
    in_stock: true,
    total_on_hand: 5,
    relative_url: "/shop/ols/products/san-pedro-seeds",
    default_asset_url: "https://example.com/img.jpg",
    updated_at: "2026-08-20T10:00:00Z"
  };

  const norm = normalizeProduct(raw, "2026-08-30T00:00:00Z");
  assert.equal(norm.id, "123");
  assert.equal(norm.name, "San Pedro Seeds");
  assert.equal(norm.price, "₹649.00");
  assert.equal(norm.priceNumeric, 649);
  assert.equal(norm.inStock, true);
  assert.equal(norm.totalOnHand, 5);
  assert.equal(norm.sourceUpdatedAt, "2026-08-20T10:00:00Z");
  assert.equal(norm.lastObservedAt, "2026-08-30T00:00:00Z");
  assert.equal(norm.status, "active");
});

test("normalizeProduct handles missing/edge-case fields cleanly", () => {
  const raw = {
    id: 456,
    title: "  Raw Item  ",
    price: 999,
    in_stock: false
  };

  const norm = normalizeProduct(raw);
  assert.equal(norm.id, "456");
  assert.equal(norm.name, "Raw Item");
  assert.equal(norm.price, "₹999");
  assert.equal(norm.priceNumeric, 999);
  assert.equal(norm.inStock, false);
  assert.equal(norm.sourceUpdatedAt, null);
  assert.equal(norm.status, "out_of_stock");
});