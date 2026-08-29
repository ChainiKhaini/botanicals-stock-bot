# 🌿 100% Pure Botanicals Stock Monitor — Telegram Bot & Cloudflare Worker

A serverless Cloudflare Worker that monitors product availability on [100% Pure Botanicals](https://100percentpurebotanicals.com/shop), provides interactive Telegram commands to check in-stock products, automatically sends daily summaries at **6:00 PM IST**, and instantly alerts when out-of-stock items come back into stock.

---

## 🚀 Features

- 🔄 **Full Multi-Page Catalog Tracking**: Continuously monitors all 450+ products across all catalog pages.
- ⏰ **Daily Automated 6:00 PM IST Updates**: Scheduled via Cloudflare Worker Cron Trigger (`30 12 * * *` UTC = 18:00 IST).
- 🚨 **Instant Restock Alerts**: Automatically detects when a product transitions from `Out of Stock` to `In Stock`.
- 💬 **Interactive Telegram Bot Commands**:
  - `/instock` or `/stock` — Browse all currently available products with prices and links.
  - `/instock <page>` — View specific page (e.g. `/instock 2`).
  - `/search <keyword>` — Check if a specific botanical item is in stock.
  - `/recent` or `/restocked` — View recently restocked items.
  - `/check` — Trigger an immediate live catalog check.
  - `/status` — View monitor statistics, in-stock ratio, and last check timestamp in IST.
  - `/help` — Overview of commands.
- 💾 **Persistent State**: Cloudflare KV (`BOTANICALS_STORE`) tracks product inventory diffs and restock history.
- 📊 **Web Dashboard**: Clean dark-mode status page with manual check trigger at `/`.

---

## 📁 Project Structure

```
botanicals-stock-bot/
├── src/
│   ├── index.js          # Cloudflare Worker router & cron handler
│   ├── scraper.js        # Multi-page product catalog fetcher
│   ├── store.js          # Cloudflare KV state & stock diffing logic
│   └── telegram.js       # Telegram Bot API client & message formatters
├── test/
│   ├── test-scraper.js   # Scraper test script
│   ├── test-pagination.js# Pagination test
│   └── test-full-pipeline.js # Full pipeline & diff simulation test
├── wrangler.toml         # Cloudflare Worker configuration & Cron triggers
├── package.json          # Dependencies & scripts
└── .dev.vars.example     # Local environment variables template
```

---

## 🛠️ Setup & Deployment Guide

### 1. Install Dependencies
```bash
cd botanicals-stock-bot
npm install
```

### 2. Create Cloudflare KV Namespace
Run the following command in your terminal:
```bash
npx wrangler kv namespace create BOTANICALS_STORE
```
Copy the returned `id` and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "BOTANICALS_STORE"
id = "your_kv_namespace_id_here"
```

### 3. Configure Secrets
Set your Telegram Bot credentials and admin tokens via Wrangler:
```bash
# Set your Telegram Bot Token
npx wrangler secret put TELEGRAM_BOT_TOKEN

# Set your Telegram Chat ID (e.g., 428883333)
npx wrangler secret put TELEGRAM_CHAT_ID

# Set an Admin Password for web triggers (e.g., geon_secret_admin_token)
npx wrangler secret put ADMIN_TOKEN

# Optional: Webhook secret verification token
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

### 4. Test Locally
Run the test suite:
```bash
npm test
```

Start the local worker development server:
```bash
npm run dev
```

### 5. Deploy to Cloudflare Workers
Deploy the worker:
```bash
npm run deploy
```

### 6. Set Telegram Webhook
Once deployed, link your Telegram Bot to your Cloudflare Worker URL:
```bash
curl -F "url=https://botanicals-stock-bot.<your-subdomain>.workers.dev/webhook" \
     -F "secret_token=your_webhook_secret_token" \
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

---

## ⏰ Cron Schedule

The cron trigger in `wrangler.toml` is configured for **6:00 PM IST**:
```toml
[triggers]
crons = ["30 12 * * *"] # 12:30 UTC = 18:00 IST (UTC+5:30)
```

---

## 🔒 Security & Best Practices

- Constant-time token comparisons via `crypto.subtle` prevent timing attacks.
- Telegram message chunking prevents exceeding Telegram's 4096-character limit.
- HTML escaping prevents injection issues in Telegram messages.
- Subrequest concurrency is optimized to fetch 450+ items in under 3 seconds.
