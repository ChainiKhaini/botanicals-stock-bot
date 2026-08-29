/**
 * 100% Pure Botanicals Stock Monitor — Cloudflare Worker
 * ========================================================
 * Monitors https://100percentpurebotanicals.com/shop for stock changes,
 * alerts on restocked products, provides interactive Telegram commands,
 * and sends daily stock summaries at 6:00 PM IST.
 */

import { fetchFullCatalog } from "./scraper.js";
import {
  loadSnapshot,
  saveSnapshot,
  loadMeta,
  saveMeta,
  diffCatalog,
  KV_KEY_SNAPSHOT,
  KV_KEY_META
} from "./store.js";
import {
  sendTelegram,
  sendChunkedMessages,
  escapeHtml,
  secureCompare,
  buildDailyUpdateMessage,
  buildRestockAlertMessage,
  buildInStockListChunks,
  buildSearchResultsMessage,
  buildRecentRestocksMessage,
  buildStatusMessage,
  buildHelpMessage,
  buildPsychedelicListMessage
} from "./telegram.js";

// ─── Psychedelic Product Categories with Potency Ratings ────────
// Ratings reflect the psychoactive / entheogenic potency (1-10).
// Non-psychedelic functional & edible mushrooms are explicitly excluded.

const PSYCHEDELIC_CATEGORIES = [
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
const EXCLUDE_KEYWORDS = [
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
 * Check if a product matches psychedelic categories.
 * Evaluates against product name with explicit non-psychedelic exclusions.
 */
export function getPsychedelicCategory(product) {
  if (!product || !product.name) return null;
  const nameLower = product.name.toLowerCase();

  // Exclude non-psychedelic / culinary / medicinal items
  for (const exc of EXCLUDE_KEYWORDS) {
    if (nameLower.includes(exc)) {
      return null;
    }
  }

  for (const cat of PSYCHEDELIC_CATEGORIES) {
    if (cat.keywords.some(kw => nameLower.includes(kw.toLowerCase()))) {
      return cat;
    }
  }
  return null;
}

/**
 * Check if a product is psychedelic (boolean shorthand)
 */
export function isPsychedelicProduct(product) {
  return getPsychedelicCategory(product) !== null;
}

// ─── Main Pipeline ──────────────────────────────────────────

/**
 * Executes a full catalog stock check and diff analysis
 */
export async function performStockCheck(env, options = {}) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || env.TELEGRAM_CHAT_ID;
  const kv = env.BOTANICALS_STORE;
  const isScheduled = options.isScheduled === true;
  const isManual = options.isManual === true;

  const meta = (await loadMeta(kv)) || {};
  const consecutiveErrors = meta.consecutiveErrors || 0;

  try {
    // 1. Fetch full catalog from store API
    const catalog = await fetchFullCatalog();
    console.log(`Fetched ${catalog.totalCount} products (${catalog.inStockCount} in stock, ${catalog.outOfStockCount} out of stock)`);

    // 2. Load previous KV snapshot & compare
    const prevSnapshot = await loadSnapshot(kv);
    const diff = diffCatalog(prevSnapshot, catalog.products);

    const nowIso = new Date().toISOString();
    const existingRecent = meta.recentRestocks || [];
    
    // Combine newly restocked & newly added in-stock items
    const newlyAvailable = [...diff.restocked, ...diff.newlyAdded];
    let updatedRecent = existingRecent;

    if (newlyAvailable.length > 0) {
      const newEntries = newlyAvailable.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        url: p.url,
        price: p.price,
        restockedAt: nowIso
      }));
      // Keep up to 25 recent restocked items
      updatedRecent = [...newEntries, ...existingRecent].slice(0, 25);
    }

    // 3. Save updated snapshot and metadata to KV
    await saveSnapshot(kv, diff.nextSnapshot);

    const nextMeta = {
      lastCheck: nowIso,
      totalCount: catalog.totalCount,
      inStockCount: catalog.inStockCount,
      outOfStockCount: catalog.outOfStockCount,
      recentRestocks: updatedRecent,
      consecutiveErrors: 0,
      lastError: "",
      lastRestockCount: newlyAvailable.length
    };
    await saveMeta(kv, nextMeta);

    // 4. Handle notifications
    if (diff.isFirstRun) {
      // First baseline run
      if (botToken && chatId) {
        const initMsg = [
          `🌿 <b>100% Pure Botanicals Monitor Initialized!</b>`,
          ``,
          `• Total Products Tracked: <b>${catalog.totalCount}</b>`,
          `• In Stock: <b>${catalog.inStockCount}</b> ✅`,
          `• Out of Stock: <b>${catalog.outOfStockCount}</b> ❌`,
          `• Schedule: Daily update at <b>6:00 PM IST</b>`,
          ``,
          `You will receive immediate alerts whenever out-of-stock products become available.`,
          `Type <code>/help</code> for available commands.`
        ].join("\n");
        await sendTelegram(botToken, chatId, initMsg);
      }
      return { success: true, firstRun: true, catalog };
    }

    // Proactive restock alert (if restocked items detected)
    if (diff.hasRestocks && botToken && chatId) {
      const restockMsg = buildRestockAlertMessage(diff.restocked, diff.newlyAdded);
      await sendTelegram(botToken, chatId, restockMsg);
    }

    // Daily scheduled update (at 6:00 PM IST)
    if (isScheduled && botToken && chatId) {
      const dailyMsg = buildDailyUpdateMessage({
        inStockCount: catalog.inStockCount,
        totalCount: catalog.totalCount,
        restocked: diff.restocked,
        newlyAdded: diff.newlyAdded,
        inStockProducts: catalog.inStockProducts
      });
      await sendTelegram(botToken, chatId, dailyMsg);
    } else if (isManual && botToken && chatId && !diff.hasRestocks) {
      // If manual check triggered and nothing new restocked, notify user of current summary
      const manualMsg = [
        `✅ <b>Check Complete:</b> Catalog is up to date.`,
        ``,
        `• <b>${catalog.inStockCount}</b> of <b>${catalog.totalCount}</b> products are In Stock.`,
        `• No new restocks detected since last check.`,
        ``,
        `Type <code>/instock</code> to browse available products.`
      ].join("\n");
      await sendTelegram(botToken, chatId, manualMsg);
    }

    return {
      success: true,
      totalCount: catalog.totalCount,
      inStockCount: catalog.inStockCount,
      outOfStockCount: catalog.outOfStockCount,
      restockedCount: diff.restocked.length,
      newlyAddedCount: diff.newlyAdded.length
    };

  } catch (err) {
    console.error("Stock check error:", err.message);

    const errorCount = consecutiveErrors + 1;
    await saveMeta(kv, {
      ...meta,
      lastCheck: new Date().toISOString(),
      consecutiveErrors: errorCount,
      lastError: err.message
    });

    if (errorCount >= 5 && errorCount % 5 === 0 && botToken && chatId) {
      const alertMsg = `⚠️ <b>Botanicals Monitor Alert:</b> ${errorCount} consecutive check failures.\nError: ${escapeHtml(err.message)}`;
      await sendTelegram(botToken, chatId, alertMsg);
    }

    return { success: false, error: err.message };
  }
}

// ─── Webhook Command Processing ─────────────────────────────

async function handleTelegramUpdate(update, env, ctx) {
  const msg = update?.message;
  if (!msg || !msg.text || !msg.chat) return;

  const chatIdStr = String(msg.chat.id);
  const configuredChatId = String(env.TELEGRAM_CHAT_ID || "");
  const botToken = env.TELEGRAM_BOT_TOKEN;

  // Authorization check (allow configured chat ID, or allow all if not set)
  if (configuredChatId && chatIdStr !== configuredChatId) {
    console.warn(`Unauthorized message from chat ID: ${chatIdStr}`);
    return;
  }

  const rawText = msg.text.trim();
  const parts = rawText.split(/\s+/);
  const command = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ").trim();

  if (command === "/start" || command === "/help") {
    ctx.waitUntil(sendTelegram(botToken, chatIdStr, buildHelpMessage()));
    return;
  }

  if (command === "/status") {
    const meta = await loadMeta(env.BOTANICALS_STORE);
    ctx.waitUntil(sendTelegram(botToken, chatIdStr, buildStatusMessage(meta)));
    return;
  }

  if (command === "/recent" || command === "/restocked") {
    const meta = await loadMeta(env.BOTANICALS_STORE);
    ctx.waitUntil(sendTelegram(botToken, chatIdStr, buildRecentRestocksMessage(meta?.recentRestocks)));
    return;
  }

  if (command === "/check") {
    ctx.waitUntil((async () => {
      await sendTelegram(botToken, chatIdStr, "🔍 <b>Checking 100% Pure Botanicals catalog for latest stock...</b>");
      await performStockCheck(env, { isManual: true, chatId: chatIdStr });
    })());
    return;
  }

  if (command === "/instock" || command === "/stock") {
    ctx.waitUntil((async () => {
      try {
        const pageNum = parseInt(arg, 10) || 1;
        
        // Try getting products from KV snapshot first for instant response
        let snapshot = await loadSnapshot(env.BOTANICALS_STORE);
        let inStockList = [];

        if (snapshot && Object.keys(snapshot).length > 0) {
          inStockList = Object.values(snapshot).filter(p => p.inStock);
        } else {
          // Fallback: fetch live catalog
          const catalog = await fetchFullCatalog();
          inStockList = catalog.inStockProducts;
        }

        if (inStockList.length === 0) {
          await sendTelegram(botToken, chatIdStr, "ℹ️ No in-stock products found in the catalog.");
          return;
        }

        const chunkData = buildInStockListChunks(inStockList, pageNum, 15);
        await sendChunkedMessages(botToken, chatIdStr, chunkData.header, chunkData.lines, chunkData.footer);
      } catch (err) {
        console.error("Instock command error:", err.message);
        await sendTelegram(botToken, chatIdStr, `❌ Failed to retrieve in-stock list: ${escapeHtml(err.message)}`);
      }
    })());
    return;
  }

  if (command === "/search" || command === "/find") {
    if (!arg) {
      ctx.waitUntil(sendTelegram(botToken, chatIdStr, "⚠️ Please specify a search term. Example: <code>/search kefir</code> or <code>/search calea</code>"));
      return;
    }

    ctx.waitUntil((async () => {
      try {
        const snapshot = await loadSnapshot(env.BOTANICALS_STORE);
        let allProducts = [];

        if (snapshot && Object.keys(snapshot).length > 0) {
          allProducts = Object.values(snapshot);
        } else {
          const catalog = await fetchFullCatalog();
          allProducts = catalog.products;
        }

        const queryLower = arg.toLowerCase();
        const matches = allProducts.filter(p => 
          p.name.toLowerCase().includes(queryLower) || 
          p.slug.toLowerCase().includes(queryLower)
        );

        const searchMsg = buildSearchResultsMessage(arg, matches);
        await sendTelegram(botToken, chatIdStr, searchMsg);
      } catch (err) {
        console.error("Search error:", err.message);
        await sendTelegram(botToken, chatIdStr, `❌ Search failed: ${escapeHtml(err.message)}`);
      }
    })());
    return;
  }

  const isPsychedelicCmd = [
    "/psychedelic", "/psychedelics",
    "/psychadelic", "/psychadelics",
    "/psycadelic", "/psycadelics",
    "/psychoactive", "/psychoactives",
    "/entheogen", "/entheogens"
  ].includes(command);

  if (isPsychedelicCmd) {
    ctx.waitUntil((async () => {
      try {
        const pageNum = parseInt(arg, 10) || 1;

        // Get products from KV snapshot or live catalog
        let allProducts = [];
        const snapshot = await loadSnapshot(env.BOTANICALS_STORE);

        if (snapshot && Object.keys(snapshot).length > 0) {
          allProducts = Object.values(snapshot);
        } else {
          const catalog = await fetchFullCatalog();
          allProducts = catalog.products;
        }

        // Filter: psychedelic + in stock, attach category info and 1-line description
        const psychedelicInStock = allProducts
          .filter(p => p.inStock && isPsychedelicProduct(p))
          .map(p => {
            const cat = getPsychedelicCategory(p);
            return {
              ...p,
              potency: cat.rating,
              categoryLabel: cat.label,
              description: cat.desc
            };
          })
          .sort((a, b) => b.potency - a.potency); // highest potency first

        const msg = buildPsychedelicListMessage(psychedelicInStock, pageNum, 15);
        await sendChunkedMessages(botToken, chatIdStr, msg.header, msg.lines, msg.footer);
      } catch (err) {
        console.error("Psychedelic command error:", err.message);
        await sendTelegram(botToken, chatIdStr, `❌ Failed to retrieve psychedelic products: ${escapeHtml(err.message)}`);
      }
    })());
    return;
  }
}

// ─── Dashboard HTML ─────────────────────────────────────────

const DASHBOARD_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #090d16;
    color: #f1f5f9;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .card {
    background: #131b2e;
    border: 1px solid #1e293b;
    border-radius: 16px;
    padding: 2.25rem;
    max-width: 520px;
    width: 100%;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .brand-icon {
    font-size: 2rem;
  }
  h1 {
    font-size: 1.35rem;
    font-weight: 700;
    color: #f8fafc;
    line-height: 1.2;
  }
  h1 span {
    color: #10b981;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .stat-card {
    background: #1a233a;
    border: 1px solid #283553;
    padding: 1rem;
    border-radius: 10px;
  }
  .stat-card.full {
    grid-column: span 2;
  }
  .stat-label {
    font-size: 0.75rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }
  .stat-val {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
  }
  .stat-val.success { color: #10b981; }
  .stat-val.danger { color: #f43f5e; }
  .stat-val.warning { color: #fbbf24; }
  
  .recent-box {
    border-top: 1px solid #1e293b;
    padding-top: 1.25rem;
    margin-bottom: 1.5rem;
  }
  .recent-box h2 {
    font-size: 0.9rem;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .recent-list {
    list-style: none;
    max-height: 180px;
    overflow-y: auto;
  }
  .recent-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid #1a233a;
    font-size: 0.85rem;
  }
  .recent-item:last-child { border-bottom: none; }
  .recent-item a {
    color: #38bdf8;
    text-decoration: none;
    font-weight: 500;
  }
  .recent-item a:hover { text-decoration: underline; }
  .recent-time {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 2px;
  }
  
  .actions {
    display: flex;
    gap: 0.75rem;
  }
  .btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.7rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    cursor: pointer;
    border: none;
  }
  .btn-primary {
    background: #059669;
    color: #ffffff;
  }
  .btn-primary:hover { background: #047857; }
  .btn-secondary {
    background: transparent;
    color: #38bdf8;
    border: 1px solid #283553;
  }
  .btn-secondary:hover { background: #1a233a; }
  .footer {
    text-align: center;
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 1.5rem;
  }
`;

function renderDashboardHtml(meta) {
  const lastCheckStr = meta?.lastCheck
    ? new Date(meta.lastCheck).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "Never";

  const total = meta?.totalCount || 0;
  const inStock = meta?.inStockCount || 0;
  const outOfStock = meta?.outOfStockCount || 0;
  const errors = meta?.consecutiveErrors || 0;
  const isHealthy = errors < 5;

  const recentRestocks = meta?.recentRestocks || [];
  let recentHtml = "";

  if (recentRestocks.length > 0) {
    const items = recentRestocks.slice(0, 5).map(r => {
      const t = r.restockedAt ? new Date(r.restockedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "";
      return `<li class="recent-item">
        <a href="${escapeHtml(r.url)}" target="_blank">${escapeHtml(r.name.slice(0, 55))}...</a> (${escapeHtml(r.price)})
        ${t ? `<div class="recent-time">Restocked: ${escapeHtml(t)}</div>` : ""}
      </li>`;
    }).join("");
    recentHtml = `<ul class="recent-list">${items}</ul>`;
  } else {
    recentHtml = `<p style="font-size:0.85rem;color:#64748b;">No recent restock events recorded yet.</p>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>100% Pure Botanicals Stock Monitor</title>
  <style>${DASHBOARD_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="brand-icon">🌿</div>
      <div>
        <h1>100% Pure Botanicals <span>Monitor</span></h1>
        <p style="font-size: 0.8rem; color: #94a3b8;">Cloudflare Workers Stock Tracker</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">In Stock</div>
        <div class="stat-val success">${inStock}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Out of Stock</div>
        <div class="stat-val danger">${outOfStock}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Catalog</div>
        <div class="stat-val">${total}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Monitor Status</div>
        <div class="stat-val ${isHealthy ? "success" : "danger"}">${isHealthy ? "Healthy" : "Degraded"}</div>
      </div>
      <div class="stat-card full">
        <div class="stat-label">Last Checked (IST)</div>
        <div class="stat-val" style="font-size: 0.95rem; font-family: monospace;">${escapeHtml(lastCheckStr)}</div>
      </div>
    </div>

    <div class="recent-box">
      <h2>🔔 Recently Restocked</h2>
      ${recentHtml}
    </div>

    <div class="actions">
      <button class="btn btn-primary" id="runCheckBtn">▶ Run Check Now</button>
      <a class="btn btn-secondary" href="/status">📊 JSON Status</a>
    </div>

    <div class="footer">
      Daily Schedule: 6:00 PM IST (12:30 UTC) • Cloudflare Workers
    </div>
  </div>

  <script>
    document.getElementById('runCheckBtn').addEventListener('click', async () => {
      const pwd = prompt("Enter Admin Token to trigger check:");
      if (!pwd) return;

      try {
        const resp = await fetch('/check', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + pwd }
        });
        if (resp.status === 202) {
          alert("✅ Stock check triggered in background!");
          setTimeout(() => location.reload(), 2500);
        } else if (resp.status === 401) {
          alert("❌ Unauthorized: Invalid Admin Token");
        } else {
          alert("❌ Status: " + resp.status);
        }
      } catch (err) {
        alert("❌ Request error: " + err.message);
      }
    });
  </script>
</body>
</html>`;
}

// ─── Worker Entry Points ────────────────────────────────────

export default {
  /**
   * Cloudflare Cron Trigger (Runs daily at 6:00 PM IST = 12:30 UTC)
   */
  async scheduled(event, env, ctx) {
    console.log("Cron trigger fired:", event.cron);
    ctx.waitUntil(
      performStockCheck(env, { isScheduled: true }).catch(err => {
        console.error("Scheduled execution error:", err);
      })
    );
  },

  /**
   * HTTP Request Router
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Telegram Webhook Endpoint
    if (url.pathname === "/webhook" || url.pathname === "/telegram-webhook") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
      }

      // Verify webhook secret token if configured
      const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
      const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET || env.ADMIN_TOKEN;
      if (expectedSecret && !secureCompare(secretHeader, expectedSecret)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      try {
        const update = await request.json();
        await handleTelegramUpdate(update, env, ctx);
      } catch (err) {
        console.error("Webhook error:", err.message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Manual Check Endpoint
    if (url.pathname === "/check") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed. Use POST" }), {
          status: 405,
          headers: { "Content-Type": "application/json" }
        });
      }

      const authHeader = request.headers.get("Authorization") || "";
      const expectedToken = env.ADMIN_TOKEN;
      if (expectedToken) {
        const tokenPrefix = "Bearer ";
        if (!authHeader.startsWith(tokenPrefix) || !secureCompare(authHeader.substring(tokenPrefix.length), expectedToken)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      ctx.waitUntil(performStockCheck(env, { isManual: true }));

      return new Response(JSON.stringify({ status: "Accepted", message: "Check initiated in background" }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. JSON Status Endpoint
    if (url.pathname === "/status") {
      const meta = (await loadMeta(env.BOTANICALS_STORE)) || { status: "No data yet" };
      return new Response(JSON.stringify(meta, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "max-age=30"
        }
      });
    }

    // 4. HTML Dashboard (Default)
    const meta = await loadMeta(env.BOTANICALS_STORE);
    return new Response(renderDashboardHtml(meta), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "max-age=30"
      }
    });
  }
};
