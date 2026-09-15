# 🌿 100% Pure Botanicals Stock Monitor & Price Tracker — Telegram Bot

A production-grade, serverless Cloudflare Worker that:
1. Monitors product stock availability on [100% Pure Botanicals](https://100percentpurebotanicals.com/shop) with interactive Telegram commands, psychedelic entheogen taxonomy, and daily stock digests.
2. Tracks [Sony WH-1000XM6](https://www.unboxify.in/products/sony-wh-1000xm6-the-best-wireless-noise-canceling-headphones-hd-nc-processor-qn3-12-microphones-adaptive-nc-optimizer-mastered-by-engineers-studio-quality-black) on Unboxify daily at **10:00 AM IST** and immediately alerts Telegram if there is any change in its price (baseline: ₹29,900).
3. Uses external webcron ([cron-job.org](https://cron-job.org)) to trigger checks, freeing Cloudflare Worker cron slots.

---

## 🚀 Key Features

- 🎧 **Sony WH-1000XM6 Price Tracker (Unboxify)**: Monitors live Shopify API data for price changes, drops, MRP discounts, and variant availability (Black, Midnight Blue, Silver, Sand Pink).
- 🔄 **Atomic Botanicals Catalog Tracking**: Scrapes 450+ products across all pages with strict completeness verification (`products.length === total_count`) and duplicate ID detection.
- 🍄 **Psychedelic & Entheogenic Taxonomy**: Dedicated `/psychedelic` command classifying entheogens on a 1–10 potency scale with descriptions (strictly excluding culinary/medicinal mushrooms).
- 🚨 **Instant Price Change & Restock Alerts**: Sends rich Telegram alerts when out-of-stock items restock or when the Sony XM6 price changes.
- 🌐 **External Webcron Ready (`/cron`)**: Frees Cloudflare account cron limits by supporting webcron services like `cron-job.org` with timing-safe token authentication.
- 🔒 **Fail-Closed Security**: Web Crypto API constant-time comparisons (`crypto.subtle.digest`) for token validation; endpoints fail closed with HTTP 500/401 if secrets are missing or invalid.
- 🛡️ **Distributed Concurrency Lock**: KV-backed execution lock prevents overlapping runs.
- 💾 **Persistent KV State**: Cloudflare KV (`BOTANICALS_STORE`) maintains product snapshots, headphone price state, metadata, and missing-product tracking.

---

## 💬 Available Telegram Bot Commands

| Command | Description |
|---|---|
| `/sony` (or `/xm6`) | Check live price, discount, and variant stock of Sony WH-1000XM6 on Unboxify 🎧 |
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

### 1. Sony WH-1000XM6 Price Check (Daily 10:00 AM IST)
- **URL**: `https://botanicals-stock-bot.saini-gaurav2907.workers.dev/cron?type=sony&token=geon_botanicals_admin_2026`
- **Schedule**: Daily at **10:00 AM IST** (`04:30 UTC`)
- **Request Method**: `GET` (or `POST`)
- **Behavior**: Checks Unboxify. If the price differs from ₹29,900 (or previous price), sends an alert to Telegram.

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
