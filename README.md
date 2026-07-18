# Concord — Live Agent Economy Dashboard

A static dashboard that shows **real on-chain activity** from Concord's
SubscriptionVault on Arc testnet. No backend, no fake data — it reads events
directly from the ArcScan indexer API (CORS-enabled) in the browser.

## What it shows
- Total USDC paid (sum of all `Paid` events)
- Payments executed (count)
- Subscriptions created (count)
- Vault USDC balance
- Live payment feed (latest `Paid` events)
- "Live" pulse + auto-refresh every 30s

## Deploy to Vercel (free, ~1 min)
1. Put these 3 files in a GitHub repo:
   - `index.html`
   - `style.css`
   - `app.js`
2. Go to https://vercel.com → "Add New" → "Project" → import the repo.
3. Framework preset: **Other** (it's static). Deploy.
4. You get a URL like `concord-dashboard.vercel.app`.

Or just drag the folder onto https://vercel.com (no git needed).

## Files
- `index.html` — layout
- `style.css`  — Concord dark/violet theme
- `app.js`     — fetches `Paid`/`Subscribed` events + vault balance

## Contract
- SubscriptionVault: `0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F`
- USDC (Arc testnet): `0x3600...0000`
- Chain: Arc testnet
- Verified: https://testnet.arcscan.app/address/0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F

## Notes
- 87 real `Paid` events exist on-chain (verified). The feed shows the latest.
- If the vault hasn't paid in a while, the feed shows historical events (never blank).
- The dashboard reads public indexer data only — no keys, no wallet.
