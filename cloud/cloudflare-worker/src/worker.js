/* ==========================================================================
   CR7 Tribute - Cloudflare Worker proxy for live career stats
   --------------------------------------------------------------------------
   Why a proxy?
   The site is hosted on GitHub Pages (pure static). Calling a football data
   API directly from the browser would leak API keys and hit CORS limits.
   This worker keeps all credentials server-side and exposes one clean,
   CORS-enabled endpoint that js/data.js (LIVE_DATA.api) can poll.

   Response contract (what the frontend expects):
   {
     "goals": 977, "apps": 1330, "assists": 261, "trophies": 34,
     "clubGoals": 831, "clubApps": 1102, "ntGoals": 146, "ntApps": 228,
     "updatedAt": "2026-08-29",
     "source": "baseline | remote-override"
   }

   Data resolution order:
   1. env.STATS_JSON_URL - an owner-controlled JSON (raw gist / R2 / KV-backed
      URL) with the same shape as above minus "source". Update that file after
      every match; no redeploy needed.
   2. Embedded BASELINE - the verified numbers below (must match js/data.js).

   Upgrading to a real provider:
   Store the provider key as a secret (npx wrangler secret put API_KEY) and
   fetch/aggregate inside this worker - see the commented ADAPTER example at
   the bottom. The browser never sees the key.
   ========================================================================== */
"use strict";

/* Must stay in sync with js/data.js (LIVE_DATA.baseline). */
const BASELINE = {
  goals: 977,
  apps: 1330,
  assists: 261,
  trophies: 34,
  clubGoals: 831,
  clubApps: 1102,
  ntGoals: 146,
  ntApps: 228,
  updatedAt: "2026-08-29"
};

const NUMERIC_FIELDS = [
  "goals", "apps", "assists", "trophies",
  "clubGoals", "clubApps", "ntGoals", "ntApps"
];
const CACHE_TTL_SECONDS = 300; /* 5 minutes: match-day polling granularity */

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept",
    "Access-Control-Max-Age": "86400"
  };
}

/* Coerce + whitelist incoming JSON into the contract; drop anything invalid. */
function normalize(raw, source) {
  if (!raw || typeof raw !== "object") return null;
  const out = { ...BASELINE };
  let hasAny = false;
  for (const key of NUMERIC_FIELDS) {
    const value = Number(raw[key]);
    if (Number.isFinite(value) && value >= 0) {
      out[key] = Math.round(value);
      hasAny = true;
    }
  }
  if (typeof raw.updatedAt === "string" && raw.updatedAt.trim()) {
    out.updatedAt = raw.updatedAt.trim().slice(0, 10);
  }
  if (!hasAny) return null;
  return { ...out, source };
}

async function serveStats(env, ctx) {
  /* caches.default exists only on Cloudflare's runtime; skip caching elsewhere. */
  const cache = globalThis.caches && caches.default ? caches.default : null;
  const cacheKey = cache ? new Request("https://cache.internal/cr7-stats", { method: "GET" }) : null;

  let payload = null;
  if (env.STATS_JSON_URL) {
    const cached = cache ? await cache.match(cacheKey) : null;
    if (cached) {
      payload = await cached.json();
    } else {
      try {
        const res = await fetch(env.STATS_JSON_URL, {
          headers: { Accept: "application/json" },
          cf: { cacheTtl: 60, cacheEverything: true }
        });
        if (!res.ok) throw new Error("override HTTP " + res.status);
        const normalized = normalize(await res.json(), "remote-override");
        if (normalized) {
          payload = normalized;
          if (cache) {
            ctx.waitUntil(
              cache.put(cacheKey, new Response(JSON.stringify(normalized), {
                headers: { "Content-Type": "application/json", "Cache-Control": "max-age=" + CACHE_TTL_SECONDS }
              }))
            );
          }
        }
      } catch (err) {
        /* Override unreachable or malformed: degrade to baseline, never 5xx the site. */
        payload = null;
      }
    }
  }

  if (!payload) payload = { ...BASELINE, source: "baseline" };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=" + CACHE_TTL_SECONDS,
      ...corsHeaders(env)
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (request.method === "GET" && (url.pathname === "/api/cr7-stats" || url.pathname === "/api/cr7-stats/")) {
      return serveStats(env, ctx);
    }

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(JSON.stringify({
        service: "cr7-stats-proxy",
        endpoints: ["/api/cr7-stats"],
        cacheTtlSeconds: CACHE_TTL_SECONDS
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) }
      });
    }

    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) }
    });
  }
};

/* --------------------------------------------------------------------------
   ADAPTER EXAMPLE - plug in a keyed provider when you want automation.

   1. npx wrangler secret put API_KEY
   2. env.API_PROVIDER = "api-football" (vars in wrangler.toml)
   3. In serveStats(), before falling back to BASELINE:

   if (env.API_PROVIDER === "api-football" && env.API_KEY) {
     // api-football v3: fixtures for a team on a given date, key stays here.
     const res = await fetch(
       "https://v3.football.api-sports.io/fixtures?team=<TEAM_ID>&season=<SEASON>",
       { headers: { "x-apisports-key": env.API_KEY } }
     );
     // Aggregate the response into the contract, track a monotonically
     // increasing career total in Workers KV, and normalize() before serving.
   }

   Career-cumulative totals are not exposed by most match APIs as a single
   number, so the common pattern is: baseline (this file or STATS_JSON_URL)
   + match-level delta detection after each game day.
   -------------------------------------------------------------------------- */
