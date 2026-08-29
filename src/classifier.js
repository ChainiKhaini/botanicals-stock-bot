/**
 * Product Classification and Categorization Engine
 * Maintains psychoactive & entheogenic taxonomy, potency ratings (1-10), and descriptions.
 */

export const PSYCHEDELIC_CATEGORIES = [
  // 5-MeO & DMT
  { keywords: ["5-meo", "5 meo"], rating: 10, label: "5-MeO Tryptamine", desc: "Ultra-potent visionary tryptamine inducing rapid, profound non-dual transcendental states." },
  { keywords: ["dmt", "dimethyltryptamine"], rating: 9, label: "DMT Source", desc: "Direct natural source of N,N-Dimethyltryptamine, the quintessential spirit molecule." },
  { keywords: ["chacruna", "psychotria viridis", "chaliponga", "diplopterys cabrerana"], rating: 8, label: "DMT Plant (Chacruna / Chaliponga)", desc: "Traditional Amazonian DMT-rich admixture plant used in visionary Ayahuasca brews." },
  { keywords: ["mimosa hostilis", "mhrb", "jurema", "mimosa tenuiflora"], rating: 8, label: "Mimosa Hostilis (DMT Bark)", desc: "Sacred Brazilian Jurema inner root bark, exceptionally rich in N,N-DMT and tannins." },
  { keywords: ["acacia confusa", "acacia maidenii"], rating: 8, label: "Acacia (DMT)", desc: "DMT & NMT-containing botanical used as a traditional Ayahuasca-analogue admixture." },

  // Ayahuasca & MAOIs
  { keywords: ["banisteriopsis caapi", "caapi", "ayahuasca", "yagé", "yage"], rating: 9, label: "Ayahuasca Vine (Banisteriopsis)", desc: "Sacred Amazonian vine containing MAOI harmala alkaloids that enable oral DMT." },
  { keywords: ["harmaline", "peganum harmala", "syrian rue", "harmine"], rating: 6, label: "Syrian Rue / Harmala (MAOI)", desc: "Potent reversible MAO-A inhibitor (RIMA) containing harmine & harmaline alkaloids." },

  // Iboga
  { keywords: ["tabernanthe iboga", "iboga", "ibogaine"], rating: 9, label: "Iboga (Tabernanthe)", desc: "Sacred West African root bark containing Ibogaine for deep spiritual introspection." },

  // Salvia
  { keywords: ["salvia divinorum"], rating: 8, label: "Salvia Divinorum", desc: "Potent Mazatec visionary sage containing Salvinorin A, a selective kappa-opioid agonist." },

  // Mescaline Cacti
  { keywords: ["trichocereus", "san pedro", "pachanoi", "peruvianus", "bridgesii", "lophophora", "peyote", "mescaline"], rating: 8, label: "Mescaline Cactus (San Pedro / Peyote)", desc: "Sacred entheogenic cactus containing Mescaline, revered for heart-opening spiritual journeys." },

  // Psilocybin Mushrooms (Active species only — Psilocybe / Cubensis)
  { keywords: ["p. cubensis", "p.cubensis", "psilocybe", "psilocybin", "cubensis"], rating: 9, label: "Psilocybin Spore Print (P. Cubensis)", desc: "Microscopy spore genetics of active psilocybin-producing sacred mushroom strains." },

  // Amanita Muscaria (Ibotenic acid / Muscimol — GABAergic entheogen, distinct from psilocybin)
  { keywords: ["amanita muscaria", "fly agaric"], rating: 5, label: "Amanita Muscaria (Fly Agaric)", desc: "Ancient shamanic entheogen containing Muscimol, inducing oneiric dream-state experiences." },

  // LSA Seeds
  { keywords: ["argyreia nervosa", "hawaiian baby woodrose", "hbwr"], rating: 7, label: "HBWR Seeds (LSA)", desc: "Natural seeds rich in Lysergic Acid Amide (LSA), causing colorful psychedelic visions." },
  { keywords: ["ipomoea tricolor", "morning glory"], rating: 6, label: "Morning Glory (LSA)", desc: "Sacred Aztec visionary seeds containing LSA and clavine alkaloids for spiritual divination." },
  { keywords: ["rivea corymbosa", "turbina corymbosa", "ololiuqui"], rating: 6, label: "Ololiuqui (LSA)", desc: "Historic Aztec entheogenic seeds used by shamans for divination and divine communication." },

  // Other Entheogens & Psychoactives
  { keywords: ["mitragyna speciosa", "kratom"], rating: 5, label: "Kratom (Mitragyna)", desc: "Traditional Southeast Asian botanical offering stimulating, mood-lifting, and soothing effects." },
  { keywords: ["kanna", "sceletium tortuosum", "mt55", "mt-55"], rating: 4, label: "Kanna (Sceletium)", desc: "South African mood-elevating entheogen acting as a natural serotonin-reuptake promoter." },
  { keywords: ["bobinsana", "calliandra angustifolia"], rating: 4, label: "Bobinsana", desc: "Gentle Amazonian master plant teacher known for opening the heart and enhancing dream lucidity." },
  { keywords: ["blue lotus", "nymphaea caerulea"], rating: 4, label: "Blue Lotus (Nymphaea)", desc: "Sacred Egyptian water lily containing Nuciferine, offering mild euphoria and relaxed dream states." },
  { keywords: ["lagochilus inebrians", "intoxicating mint"], rating: 4, label: "Lagochilus Inebrians", desc: "Central Asian intoxicating mint traditionally brewed for calming euphoria and mild sedation." },

  // Dream Herbs / Oneirogens (Mild entheogens)
  { keywords: ["calea zacatechichi", "calea ternifolia"], rating: 3, label: "Calea Zacatechichi (Dream Herb)", desc: "Chontal dream herb (Leaf of God) renowned for producing vivid, memorable lucid dreams." },
  { keywords: ["silene capensis", "silene undulata", "african dream root"], rating: 3, label: "Silene Capensis (African Dream Root)", desc: "Xhosa sacred Ubulawu root traditionally used to invoke clear prophetic dream visions." },
  { keywords: ["synaptolepis kirkii", "uvuma omhlope"], rating: 3, label: "Synaptolepis Kirkii (Dream Herb)", desc: "South African Uvuma-omhlope root prized for lucid dreaming and mental clarity." },
  { keywords: ["entada rheedii", "african dream herb"], rating: 3, label: "Entada Rheedii (Dream Bean)", desc: "African sacred dream bean used by traditional healers to communicate with ancestors." }
];

// Non-psychedelic exclusion keywords (medicinal mushrooms, culinary mushrooms, general outdoor items)
export const EXCLUDE_KEYWORDS = [
  "knife", "knives", "camping", "cookware", "utensil", "chair", "table", "fan",
  "lions mane", "lion's mane", "hericium", "chaga", "inonotus", "turkey tail", "trametes",
  "cordyceps", "maitake", "grifola", "snow fungus", "tremella", "shiitake", "lentinula",
  "chanterelle", "cantharellus", "porcini", "boletus", "chicken of the woods", "laetiporus",
  "parasol", "macrolepiota", "caesar's mushroom", "amanita caesarea", "giant puffball", "calvatia",
  "tiger sawhill", "lentinus tigrinus", "shaggy mane", "coprinus", "brown birch bolete", "leccinum",
  "saffron milk cap", "lactarius deliciosus", "reishi", "ganoderma", "oyster mushroom", "pleurotus",
  "bee venom", "stag antler", "deer antler", "elk antler", "ghee", "honey", "wine yeast"
];

/**
 * Strips '100% Pure Botanicals' branding boilerplate from product titles
 */
export function cleanProductName(name) {
  if (!name) return "";
  return name
    .replace(/100%\s*PURE\s*BOTANICALS[®™]?\s*\|\|/gi, "")
    .replace(/\|\|\s*100%\s*PURE\s*BOTANICALS[®™]?/gi, "")
    .replace(/100%\s*PURE\s*BOTANICALS[®™]?/gi, "")
    .replace(/^100%\s*Pure\s+/i, "")
    .replace(/^100%\s*PURE\s+/i, "")
    .replace(/^100\s*Percent\s*Pure\s+/i, "")
    .replace(/^\|\|\s*/, "")
    .replace(/\s*\|\|\s*$/, "")
    .trim();
}

/**
 * Classifies a product against the entheogenic / psychedelic taxonomy.
 * Evaluates against product name with explicit non-psychedelic exclusions.
 * @param {{ name: string, slug?: string }} product
 * @returns {{ isPsychedelic: boolean, categoryLabel?: string, potency?: number, description?: string }}
 */
export function classifyProduct(product) {
  if (!product || !product.name) {
    return { isPsychedelic: false };
  }

  const nameLower = product.name.toLowerCase();

  // Exclude non-psychedelic / culinary / medicinal items
  for (const exc of EXCLUDE_KEYWORDS) {
    if (nameLower.includes(exc)) {
      return { isPsychedelic: false };
    }
  }

  for (const cat of PSYCHEDELIC_CATEGORIES) {
    if (cat.keywords.some(kw => nameLower.includes(kw.toLowerCase()))) {
      return {
        isPsychedelic: true,
        categoryLabel: cat.label,
        potency: cat.rating,
        description: cat.desc
      };
    }
  }

  return { isPsychedelic: false };
}

/**
 * Boolean shorthand to check if a product is in the psychedelic catalog.
 */
export function isPsychedelicProduct(product) {
  return classifyProduct(product).isPsychedelic;
}
