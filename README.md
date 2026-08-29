# 🌿 100% Pure Botanicals Stock Monitor — Telegram Bot & Cloudflare Worker

A production-grade, serverless Cloudflare Worker that monitors product availability on [100% Pure Botanicals](https://100percentpurebotanicals.com/shop), provides interactive Telegram commands to browse in-stock products and the curated psychedelic catalog, sends daily summaries at **6:00 PM IST**, and instantly alerts when out-of-stock items come back into stock.

---

## 🚀 Key Features

- 🔄 **Atomic Full-Catalog Tracking**: Scrapes all 450+ products across all pages with strict completeness verification (`products.length === total_count`) and duplicate ID detection.
- 🍄 **Psychedelic & Entheogenic Taxonomy**: Dedicated `/psychedelic` command classifying entheogens on a 1–10 potency scale with 1-line traditional descriptions (while strictly excluding culinary and medicinal mushrooms).
- ⏰ **Daily Automated 6:00 PM IST Updates**: Scheduled via Cloudflare Worker Cron Trigger (`30 12 * * *` UTC = 18:00 IST).
- 🚨 **Instant Safe Restock Alerts**: Detects `OUT_OF_STOCK -> IN_STOCK` transitions and sends safely chunked alerts (<3900 chars) that never exceed Telegram limits.
- 🔒 **Fail-Closed Security**: Web Crypto API constant-time comparisons (`crypto.subtle.digest`) for token validation; endpoints fail closed with HTTP 500/401 if secrets are missing or invalid.
- 🛡️ **Distributed Concurrency Lock**: KV-backed execution lock prevents overlapping cron and manual `/check` runs.
- ⏱️ **Abuse Prevention**: Built-in 60-second rate limiter on manual `/check` requests.
- 💾 **Persistent KV State**: Cloudflare KV (`BOTANICALS_STORE`) maintains product snapshots, metadata, and missing-product status tracking.
- 📊 **Web Dashboard**: Responsive dark-mode dashboard with verified status metrics at `/`.

---

## 💬 Available Telegram Bot Commands

| Command | Description |
|---|---|
| `/psychedelic` (or `/psychadelic`) | In-stock psychedelic & entheogenic products sorted by potency (1–10/10) with descriptions 🍄 |
| `/instock` or `/stock` | Paginated list of all products currently in stock with clean titles |
| `/instock <page>` | View specific page (e.g. `/instock 2`) |
| `/search <keyword>` | Search product catalog by name or keyword |
| `/recent` or `/restocked` | View items that recently came back into stock |
| `/check` | Trigger an immediate live catalog scan |
| `/status` | View monitor health, total tracked items, in-stock ratio, and last check time |
| `/help` | Overview of all commands |

---

## 📁 Modular Architecture

```
botanicals-stock-bot/
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated GitHub Actions CI workflow
├── src/
│   ├── index.js                 # Worker router & cron entrypoint
│   ├── monitor.js               # Stock check pipeline orchestration & locking
│   ├── scraper.js               # Bounded concurrency scraper & completeness validator
│   ├── store.js                 # Cloudflare KV state, lock lease & diff engine
│   ├── telegram.js              # Telegram Bot API client & safe message chunking
│   ├── classifier.js            # Psychedelic taxonomy, 1-10 potency scale & title cleaning
│   ├── dashboard.js             # HTML dashboard generation
│   └── auth.js                  # Timing-safe crypto verification & rate limiting
├── test/
│   ├── unit/                    # Deterministic offline unit tests
│   │   ├── auth.test.js
│   │   ├── classifier.test.js
│   │   ├── diff.test.js
│   │   ├── normalization.test.js
│   │   ├── pagination-validator.test.js
│   │   └── telegram-chunking.test.js
│   └── integration/             # Pipeline & failure mode tests
│       └── failure-modes.test.js
├── wrangler.toml                # Worker configuration, KV bindings & Cron triggers
├── package.json                 # Dependencies & test scripts
└── .dev.vars.example            # Local secrets template
```

---

## 🔒 Security Architecture

- **Timing-Safe Auth**: Token comparisons hash inputs with SHA-256 via `crypto.subtle.digest` before evaluating in constant-time, preventing side-channel timing attacks and length leakage.
- **Fail-Closed Design**: If `TELEGRAM_WEBHOOK_SECRET` or `ADMIN_TOKEN` is not configured in the environment, requests are rejected immediately with HTTP 500 / 401.
- **Credential Separation**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `ADMIN_TOKEN` operate independently without fallback.
- **Rate Limiting**: KV-based sliding window cooldown protects the `/check` endpoint from rapid repeated execution.

---

## 🧪 Testing

Run the 100% offline, deterministic test suite:

```bash
npm test
```

Run live smoke tests against the store API:

```bash
npm run test:live
```
