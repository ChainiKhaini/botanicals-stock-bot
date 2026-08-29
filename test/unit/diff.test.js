import test from "node:test";
import assert from "node:assert/strict";
import { diffCatalog } from "../../src/store.js";

test("diffCatalog identifies first run", () => {
  const current = [
    { id: "1", name: "Product A", inStock: true, price: "₹100", priceNumeric: 100 },
    { id: "2", name: "Product B", inStock: false, price: "₹200", priceNumeric: 200 }
  ];

  const diff = diffCatalog(null, current);
  assert.equal(diff.isFirstRun, true);
  assert.equal(diff.hasRestocks, false);
  assert.equal(Object.keys(diff.nextSnapshot).length, 2);
});

test("diffCatalog identifies restocks (OUT -> IN) and newly added items", () => {
  const prevSnapshot = {
    "1": { id: "1", name: "Product A", inStock: false, price: "₹100", priceNumeric: 100 },
    "2": { id: "2", name: "Product B", inStock: true, price: "₹200", priceNumeric: 200 }
  };

  const current = [
    { id: "1", name: "Product A", inStock: true, price: "₹100", priceNumeric: 100 },
    { id: "2", name: "Product B", inStock: false, price: "₹200", priceNumeric: 200 },
    { id: "3", name: "Product C", inStock: true, price: "₹300", priceNumeric: 300 }
  ];

  const diff = diffCatalog(prevSnapshot, current);
  assert.equal(diff.isFirstRun, false);
  assert.equal(diff.hasRestocks, true);
  assert.equal(diff.restocked.length, 1);
  assert.equal(diff.restocked[0].id, "1");
  assert.equal(diff.wentOutOfStock.length, 1);
  assert.equal(diff.wentOutOfStock[0].id, "2");
  assert.equal(diff.newlyAdded.length, 1);
  assert.equal(diff.newlyAdded[0].id, "3");
});

test("diffCatalog preserves missing products with status: missing", () => {
  const prevSnapshot = {
    "1": { id: "1", name: "Product A", inStock: true, price: "₹100", status: "active" },
    "2": { id: "2", name: "Product B (delisted)", inStock: true, price: "₹200", status: "active" }
  };

  const current = [
    { id: "1", name: "Product A", inStock: true, price: "₹100" }
  ];

  const diff = diffCatalog(prevSnapshot, current);
  assert.equal(diff.missing.length, 1);
  assert.equal(diff.missing[0].id, "2");
  assert.equal(diff.nextSnapshot["2"].status, "missing");
  assert.equal(diff.nextSnapshot["2"].inStock, false);
});