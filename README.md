# 🌿 100% Pure Botanicals Stock Monitor & Electronics Price Tracker — Telegram Bot

A production-grade, serverless Cloudflare Worker that:
1. Monitors product stock availability on [100% Pure Botanicals](https://100percentpurebotanicals.com/shop) with interactive Telegram commands, psychedelic entheogen taxonomy, and daily stock digests.
2. Tracks electronics & gadgets on [Unboxify](https://www.unboxify.in) daily at **10:00 AM IST** and immediately alerts Telegram if there is any change in price or stock:
   - 🎧 **Sony WH-1000XM6 Headphones** (baseline: ₹29,900)
   - ⌚ **Samsung Galaxy Watch 8 (40mm)** (baseline: ₹20,999)
   - 🏃 **Fitbit Charge 6 Fitness Tracker** (baseline: ₹10,499)
3. Uses external webcron ([cron-job.org](https://cron-job.org)) to trigger checks, freeing Cloudflare Worker cron slots.

---

## 🚀 Key Features

- 🛍️ **Unboxify Multi-Product Price & Stock Tracker**: Monitors live Shopify API data for price changes, drops, MRP discounts, and variant availability for Sony WH-1000XM6, Samsung Galaxy Watch 8, and Fitbit Charge 6.
- 🔄 **Atomic Botanicals Catalog Tracking**: Scrapes 450+ products across all pages with strict completeness verification (`products.length === total_count`) and duplicate ID detection.
- 🍄 **Psychedelic & Entheogenic Taxonomy**: Dedicated `/psychedelic` command classifying entheogens on a 1–10 potency scale with descriptions (strictly excluding culinary/medicinal mushrooms).
- 🚨 **Instant Price Change & Restock Alerts**: Sends rich Telegram alerts when out-of-stock items restock or when any tracked gadget's price drops or changes.
- 🌐 **External Webcron Ready (`/cron`)**: Frees Cloudflare account cron limits by supporting webcron services like `cron-job.org` with timing-safe token authentication.
- 🔒 **Fail-Closed Security**: Web Crypto API constant-time comparisons (`crypto.subtle.digest`) for token validation; endpoints fail closed with HTTP 500/401 if secrets are missing or invalid.
- 🛡️ **Distributed Concurrency Lock**: KV-backed execution lock prevents overlapping runs.
- 💾 **Persistent KV State**: Cloudflare KV (`BOTANICALS_STORE`) maintains product snapshots, gadget price states, metadata, and missing-product tracking.

---

## 💬 Available Telegram Bot Commands

| Command | Description |
|---|---|
| `/gadgets` (or `/deals`, `/prices`) | Live overview of all tracked Unboxify gadgets, prices, and discounts 🛍️ |
| `/sony` (or `/xm6`) | Check live price, discount, and variant stock of Sony WH-1000XM6 on Unboxify 🎧 |
| `/samsung` (or `/watch`) | Check live price, discount, and variant stock of Samsung Galaxy Watch 8 ⌚ |
| `/fitbit` (or `/charge6`) | Check live price, discount, and variant stock of Fitbit Charge 6 🏃 |
| `/psychedelic` (or `/psychadelic`) | In-stock psychedelic & entheogenic products sorted by potency (1–10/10) with descriptions 🍄 |
| `/instock` or `/stock` | Paginated list of all products currently in stock with clean titles |
| `/instock <page>` | View specific page (e.g. `/instock 2`) |
| `/search <keyword>` | Search product catalog by name or keyword |
| `/recent` or `/restocked` | View items that recently came back into stock |
| `/check` | Trigger an immediate live catalog scan |
| `/status` | View monitor health, total tracked items, in-stock ratio, and last check time |
| `/help` | Overview of all commands |

---

## ⏰ Cron-Job.org Setup Guide

To free Cloudflare Worker cron triggers and ensure timely daily alerts, set up jobs on [cron-job.org](https://cron-job.org):

### 1. Unboxify Gadgets Price Check (Daily 10:00 AM IST)
- **URL**: `https://botanicals-stock-bot.saini-gaurav2907.workers.dev/cron?type=sony&token=geon_botanicals_admin_2026`
  *(Note: `?type=sony`, `?type=samsung`, `?type=fitbit`, or `?type=gadgets` all automatically check and compare all tracked electronics)*
- **Schedule**: Daily at **10:00 AM IST** (`04:30 UTC`)
- **Request Method**: `GET` (or `POST`)
- **Behavior**: Evaluates Sony XM6, Samsung Watch 8, and Fitbit Charge 6 against baseline/KV prices. If any price changes, sends a rich Telegram alert.

### 2. Botanicals Daily Stock Digest (Daily 6:00 PM IST)
- **URL**: `https://botanicals-stock-bot.saini-gaurav2907.workers.dev/cron?type=daily&token=geon_botanicals_admin_2026`
- **Schedule**: Daily at **6:00 PM IST** (`12:30 UTC`)
- **Request Method**: `GET` (or `POST`)
- **Behavior**: Checks the full 100% Pure Botanicals catalog and sends the daily summary digest to Telegram.

---

## 📁 Modular Architecture

```
botanicals-stock-bot/
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated GitHub Actions CI workflow
├── src/
│   ├── index.js                 # Worker router, Telegram webhook, /cron & /check
│   ├── priceTracker.js          # Sony WH-1000XM6 Unboxify tracker & alert builder
│   ├── monitor.js               # Stock check pipeline orchestration & locking
│   ├── scraper.js               # Bounded concurrency scraper & completeness validator
│   ├── store.js                 # Cloudflare KV state, lock lease & diff engine
│   ├── telegram.js              # Telegram Bot API client & safe message chunking
│   ├── classifier.js            # Psychedelic taxonomy, 1-10 potency scale & title cleaning
│   ├── dashboard.js             # HTML dashboard generation
│   └── auth.js                  # Timing-safe crypto verification & rate limiting
├── test/
│   ├── unit/                    # 29 deterministic offline unit tests
│   │   ├── auth.test.js
│   │   ├── classifier.test.js
│   │   ├── cron-endpoint.test.js
│   │   ├── diff.test.js
│   │   ├── normalization.test.js
│   │   ├── pagination-validator.test.js
│   │   ├── price-tracker.test.js
│   │   └── telegram-chunking.test.js
│   └── integration/             # Pipeline & failure mode tests
│       └── failure-modes.test.js
├── wrangler.toml                # Worker configuration & KV bindings
├── package.json                 # Dependencies & test scripts
└── .dev.vars.example            # Local secrets template
```

---

## 🧪 Testing

Run all 29 deterministic offline tests:

```bash
npm test
```
