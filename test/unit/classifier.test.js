import test from "node:test";
import assert from "node:assert/strict";
import { classifyProduct, isPsychedelicProduct, cleanProductName } from "../../src/classifier.js";

test("cleanProductName strips store branding prefixes and suffixes", () => {
  assert.equal(
    cleanProductName("100% PURE BOTANICALS® || BANISTERIOPSIS CAAPI || YAGÉ || DRIED LEAVES || PERU || INDIA || 20GRAMS || 100% PURE BOTANICALS®"),
    "BANISTERIOPSIS CAAPI || YAGÉ || DRIED LEAVES || PERU || INDIA || 20GRAMS"
  );
  assert.equal(
    cleanProductName("100% Pure Acacia confusa Seeds India - 25 Seeds"),
    "Acacia confusa Seeds India - 25 Seeds"
  );
});

test("classifyProduct accurately classifies psychoactive & entheogenic botanicals", () => {
  const p1 = classifyProduct({ name: "100% PURE BOTANICALS® || BANISTERIOPSIS CAAPI || DRIED LEAVES" });
  assert.equal(p1.isPsychedelic, true);
  assert.equal(p1.potency, 9);
  assert.equal(p1.categoryLabel, "Ayahuasca Vine (Banisteriopsis)");

  const p2 = classifyProduct({ name: "100% PURE BOTANICALS® || TRICHOCEREUS PACHANOI || SAN PEDRO CACTUS" });
  assert.equal(p2.isPsychedelic, true);
  assert.equal(p2.potency, 8);

  const p3 = classifyProduct({ name: "100% PURE BOTANICALS® || TABERNANTHE IBOGA || ROOT BARK POWDER" });
  assert.equal(p3.isPsychedelic, true);
  assert.equal(p3.potency, 9);

  const p4 = classifyProduct({ name: "100% Pure P. cubensis SPORE SYRINGE" });
  assert.equal(p4.isPsychedelic, true);
  assert.equal(p4.potency, 9);

  const p5 = classifyProduct({ name: "100% Pure Amanita Muscaria Mushroom" });
  assert.equal(p5.isPsychedelic, true);
  assert.equal(p5.potency, 5);
});

test("classifyProduct strictly excludes culinary & functional non-psychedelic mushrooms", () => {
  const nonPsychedelics = [
    "100% PURE BOTANICALS® || HERICIUM ERINACEUS || LIONS MANE",
    "100% PURE BOTANICALS® || INONOTUS OBLIQUUS || CHAGA CHUNKS",
    "100% PURE BOTANICALS® || TRAMETES VERSICOLOR || TURKEY TAIL MUSHROOMS",
    "100% PURE BOTANICALS® || CORDYCEPS MILITARIS",
    "100% PURE BOTANICALS® || GRIFOLA FRONDOSA || MAITAKE MUSHROOMS",
    "100% Pure Boletus edulis PORCINI SPORE PRINT",
    "100% Pure Cantharellus cibarius CHANTERELLE SPORE PRINT",
    "100% Pure Lentinula edodes SHIITAKE SPORE PRINT",
    "100% Pure Laetiporus sulphureus CHICKEN OF THE WOODS SPORE PRINT"
  ];

  for (const name of nonPsychedelics) {
    const res = classifyProduct({ name });
    assert.equal(res.isPsychedelic, false, `Should not classify as psychedelic: ${name}`);
  }
});