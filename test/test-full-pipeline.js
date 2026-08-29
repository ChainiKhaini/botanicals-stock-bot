import { fetchFullCatalog } from "../src/scraper.js";
import { diffCatalog } from "../src/store.js";
import {
  buildDailyUpdateMessage,
  buildRestockAlertMessage,
  buildInStockListChunks,
  buildSearchResultsMessage,
  buildStatusMessage,
  buildHelpMessage
} from "../src/telegram.js";

async function runTests() {
  console.log("=== 1. Testing Catalog Scraper across all pages ===");
  const catalog = await fetchFullCatalog();
  console.log(`Fetched ${catalog.totalCount} total products across ${catalog.totalPages} pages.`);
  console.log(`In Stock: ${catalog.inStockCount} | Out of Stock: ${catalog.outOfStockCount}`);

  if (catalog.totalCount === 0) {
    throw new Error("Scraper returned 0 products!");
  }
  if (catalog.inStockCount === 0) {
    console.warn("Warning: 0 products reported in stock. Verify stock parsing.");
  }

  console.log("\n=== 2. Testing Diff Detection Simulation ===");
  // Baseline initial snapshot
  const initialDiff = diffCatalog(null, catalog.products);
  console.log(`Initial baseline: isFirstRun = ${initialDiff.isFirstRun}, snapshot items = ${Object.keys(initialDiff.nextSnapshot).length}`);

  // Simulate an item coming back in stock
  const sampleOutOfStock = catalog.outOfStockProducts[0] || { id: "999", name: "Sample Out of Stock Product", price: "₹500", slug: "sample-prod", inStock: false };
  const mockPrevSnapshot = {
    ...initialDiff.nextSnapshot,
    [sampleOutOfStock.id]: {
      ...sampleOutOfStock,
      inStock: false
    }
  };

  // Current run: mark that product as inStock = true
  const simulatedProducts = catalog.products.map(p => {
    if (p.id === sampleOutOfStock.id) {
      return { ...p, inStock: true };
    }
    return p;
  });

  const restockDiff = diffCatalog(mockPrevSnapshot, simulatedProducts);
  console.log(`Diff simulation detected: ${restockDiff.restocked.length} restocked items!`);
  if (restockDiff.restocked.length > 0) {
    console.log(`Restocked item: ${restockDiff.restocked[0].name} (${restockDiff.restocked[0].price})`);
  }

  console.log("\n=== 3. Testing Telegram Message Builders ===");
  
  // Test Restock Alert
  const alertMsg = buildRestockAlertMessage(restockDiff.restocked, []);
  console.log("Restock Alert preview:\n" + alertMsg.slice(0, 300) + "...\n");

  // Test Daily 6 PM IST Update
  const dailyMsg = buildDailyUpdateMessage({
    inStockCount: catalog.inStockCount,
    totalCount: catalog.totalCount,
    restocked: restockDiff.restocked,
    newlyAdded: [],
    inStockProducts: catalog.inStockProducts
  });
  console.log("Daily Update preview:\n" + dailyMsg.slice(0, 350) + "...\n");

  // Test In-Stock Chunks
  const inStockChunks = buildInStockListChunks(catalog.inStockProducts, 1, 15);
  console.log(`In-Stock Chunks: Total items = ${inStockChunks.totalItems}, Page = ${inStockChunks.currentPage}/${inStockChunks.totalPages}`);
  console.log("Header preview:\n" + inStockChunks.header);

  // Test Search Results
  const searchMsg = buildSearchResultsMessage("kefir", catalog.products.filter(p => p.name.toLowerCase().includes("kefir")));
  console.log("Search Result preview:\n" + searchMsg.slice(0, 300) + "...\n");

  // Test Status
  const statusMsg = buildStatusMessage({
    lastCheck: new Date().toISOString(),
    totalCount: catalog.totalCount,
    inStockCount: catalog.inStockCount,
    outOfStockCount: catalog.outOfStockCount,
    consecutiveErrors: 0
  });
  console.log("Status message preview:\n" + statusMsg + "\n");

  console.log("✅ All tests passed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
