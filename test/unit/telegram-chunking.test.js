import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, buildRestockAlertChunks, buildPsychedelicListMessage } from "../../src/telegram.js";

test("escapeHtml safely escapes HTML special characters", () => {
  assert.equal(escapeHtml('<script>alert("XSS") & \'test\'</script>'), '&lt;script&gt;alert(&quot;XSS&quot;) &amp; &#039;test&#039;&lt;/script&gt;');
});

test("buildRestockAlertChunks handles multiple restocked items safely", () => {
  const items = Array.from({ length: 30 }, (_, i) => ({
    id: String(i + 1),
    name: `Product Item ${i + 1}`,
    url: `https://example.com/item-${i + 1}`,
    price: "₹999.00"
  }));

  const chunks = buildRestockAlertChunks(items, []);
  assert.equal(chunks.count, 30);
  assert.equal(chunks.items.length, 30);
  assert.match(chunks.header, /RESTOCK ALERT: 30 Products In Stock!/);
});

test("buildPsychedelicListMessage formats clean potency ratings and descriptions", () => {
  const products = [
    {
      id: "1",
      name: "100% PURE BOTANICALS® || BANISTERIOPSIS CAAPI || YAGÉ",
      url: "https://example.com/caapi",
      price: "₹1,249.00",
      potency: 9,
      categoryLabel: "Ayahuasca Vine (Banisteriopsis)",
      description: "Sacred Amazonian vine containing MAOI harmala alkaloids."
    }
  ];

  const msg = buildPsychedelicListMessage(products, 1, 15);
  assert.equal(msg.lines.length, 1);
  assert.match(msg.lines[0], /BANISTERIOPSIS CAAPI/);
  assert.doesNotMatch(msg.lines[0], /100% PURE BOTANICALS/);
  assert.match(msg.lines[0], /⚡ Potency: <b>9\/10<\/b>/);
  assert.match(msg.lines[0], /Sacred Amazonian vine/);
  assert.doesNotMatch(msg.header, /🟢/);
});