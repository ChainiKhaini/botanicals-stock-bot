import test from "node:test";
import assert from "node:assert/strict";
import { validateCatalogCompleteness, ScraperError } from "../../src/scraper.js";

test("validateCatalogCompleteness succeeds when counts match and IDs are unique", () => {
  const products = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(validateCatalogCompleteness(products, 3, 1), true);
});

test("validateCatalogCompleteness throws ScraperError when counts mismatch", () => {
  const products = [{ id: 1 }, { id: 2 }];
  assert.throws(
    () => validateCatalogCompleteness(products, 3, 1),
    (err) => err instanceof ScraperError && err.message.includes("completeness validation failed")
  );
});

test("validateCatalogCompleteness throws ScraperError on duplicate IDs", () => {
  const products = [{ id: 1 }, { id: 2 }, { id: 1 }];
  assert.throws(
    () => validateCatalogCompleteness(products, 3, 1),
    (err) => err instanceof ScraperError && err.message.includes("duplicate product ID")
  );
});