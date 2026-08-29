# CR7 Stats Proxy (Cloudflare Worker)

Server-side proxy that gives the static GitHub Pages site a safe live-data
endpoint. API keys and upstream URLs never reach the browser; the frontend
only ever calls this worker.

## Response contract

`GET /api/cr7-stats` returns:

```json
{
  "goals": 977, "apps": 1330, "assists": 261, "trophies": 34,
  "clubGoals": 831, "clubApps": 1102, "ntGoals": 146, "ntApps": 228,
  "updatedAt": "2026-08-29",
  "source": "baseline | remote-override"
}
```

Edge-cached for 5 minutes (`Cache-Control: public, max-age=300`), which
matches the frontend match-day polling cadence in `js/data.js`.

## Data sources

| Priority | Source | When to use |
| --- | --- | --- |
| 1 | `STATS_JSON_URL` var — any URL you control serving the same JSON (raw GitHub gist, R2/KV endpoint) | Recommended: update the JSON after each match, no redeploy |
| 2 | Embedded `BASELINE` in `src/worker.js` | Fallback; must stay in sync with `js/data.js` (`LIVE_DATA.baseline`) |

If the override URL is unreachable or malformed, the worker degrades to the
baseline instead of erroring, so the site never breaks.

## Deploy

### Option A — Cloudflare dashboard (no CLI)

1. Cloudflare dashboard → **Workers & Pages → Create → Worker**, name it
   e.g. `cr7-stats-proxy`, deploy the hello-world.
2. **Edit code**, paste the contents of `src/worker.js`, **Deploy**.
3. Worker → **Settings → Variables and Secrets**, add:
   - `ALLOWED_ORIGIN` = `https://jay-chou-creator.github.io` (locks CORS to your site)
   - `STATS_JSON_URL` = your JSON URL (optional, leave unset to serve baseline)

### Option B — Wrangler CLI

```bash
cd cloud/cloudflare-worker
npx wrangler login
npx wrangler deploy
# then set vars
npx wrangler secret put STATS_JSON_URL   # or put it in wrangler.toml [vars]
```

## Wire up the frontend

In `js/data.js`, set:

```js
const LIVE_DATA = {
  api: "https://cr7-stats-proxy.<your-subdomain>.workers.dev/api/cr7-stats",
  ...
};
```

The page then polls automatically (5 min on match days, 1 h otherwise), shows
「在线数据」 in the live bar, and plays the golden pulse animation whenever a
number increases. If the worker is unreachable, the page silently falls back
to the static baseline.

## Upgrading to a keyed provider

See the `ADAPTER EXAMPLE` comment at the bottom of `src/worker.js`. Keep in
mind most football APIs expose per-match data, not career-cumulative totals —
the usual pattern is baseline + KV-tracked deltas detected after each match.
Store keys only as Worker secrets (`npx wrangler secret put API_KEY`).

## Local test

```bash
node test/worker.test.mjs
```
