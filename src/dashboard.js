/**
 * HTML Dashboard Generator for Cloudflare Workers
 */

import { escapeHtml } from "./telegram.js";

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
    max-width: 540px;
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

export function renderDashboardHtml(meta) {
  const lastCheckStr = meta?.lastCheck
    ? new Date(meta.lastCheck).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "Never";

  const total = meta?.totalCount || 0;
  const inStock = meta?.inStockCount || 0;
  const outOfStock = meta?.outOfStockCount || 0;
  const missingCount = meta?.missingCount || 0;
  const errors = meta?.consecutiveErrors || 0;
  const isHealthy = errors === 0;

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
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 202) {
          alert("✅ Stock check triggered in background!");
          setTimeout(() => location.reload(), 3000);
        } else if (resp.status === 429) {
          alert("⏳ Rate limited: " + (data.message || "Please wait before checking again."));
        } else if (resp.status === 401) {
          alert("❌ Unauthorized: Invalid Admin Token");
        } else {
          alert("❌ Status: " + resp.status + " - " + (data.error || ""));
        }
      } catch (err) {
        alert("❌ Request error: " + err.message);
      }
    });
  </script>
</body>
</html>`;
}
