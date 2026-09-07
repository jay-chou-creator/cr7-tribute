/* ==========================================================================
   CR7 Tribute - 实时数据 Worker（定时抓取 + KV 存储 + API 输出）
   --------------------------------------------------------------------------
   职责：
     scheduled()  → 每 6 小时抓取 ronaldostats.app，校验后写入 Workers KV
     fetch()      → /api/cr7-stats 读 KV 返回 JSON（同源 Pages Function 兜底用）

   为什么把定时抓取从 GitHub Actions 搬到这里：
     GitHub 会在仓库连续 60 天无活动后自动停用 schedule 事件，且抓取脚本一旦
     因数据源改版而解析失败，就会连续发邮件报错、数据却一直停在旧值。
     Cloudflare Cron Triggers 不会被停用，抓取失败会保留上一次的好数据并写入
     KV 的 lastError 键，可在 /api/cr7-stats/health 一眼看到。

   响应契约（前端 js/data.js 依赖）：
     {
       "goals": 978, "apps": 1334, "assists": 291, "trophies": 35,
       "clubGoals": 832, "clubApps": 1101, "ntGoals": 146, "ntApps": 233,
       "updatedAt": "2026-09-07", "fetchedAt": "...", "source": "..."
     }
   ========================================================================== */
"use strict";

import { parseStats, BASELINE, SOURCE_URL, NUMERIC_FIELDS } from "./parser.js";

const KV_LATEST = "latest";
const KV_LAST_ERROR = "lastError";
const KV_LAST_RUN = "lastRun";
const CACHE_TTL_SECONDS = 300;

/* 正常情况下 cron 每 6 小时抓一次就够了，不需要更高的频率。
   这个阈值只作为「cron 失灵时的安全网」：如果 KV 数据已经超过 7 小时没更新
   （说明定时任务没跑成功），才在有人访问时后台补抓一次。 */
const STALE_AFTER_MS = 7 * 60 * 60 * 1000;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type, x-refresh-token",
    "Access-Control-Max-Age": "86400"
  };
}

function json(body, { status = 200, env = {}, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env),
      ...headers
    }
  });
}

async function readLatest(env) {
  if (!env.STATS_KV) return null;
  try {
    const raw = await env.STATS_KV.get(KV_LATEST, { type: "json" });
    return raw && typeof raw === "object" ? raw : null;
  } catch (_) {
    return null;
  }
}

/* --------------------------------------------------------------------------
   核心：抓取 → 解析 → 校验 → 写入 KV
   -------------------------------------------------------------------------- */
async function scrapeAndStore(env, { force = false } = {}) {
  const runAt = new Date().toISOString();
  const previous = await readLatest(env);

  const record = (ok, detail) => {
    if (!env.STATS_KV) return;
    const payload = JSON.stringify({ at: runAt, ok, detail });
    env.STATS_KV.put(ok ? KV_LAST_RUN : KV_LAST_ERROR, payload).catch(() => {});
    if (ok) env.STATS_KV.put(KV_LAST_ERROR, JSON.stringify({ at: runAt, ok: true, detail: null })).catch(() => {});
  };

  let html;
  try {
    const res = await fetch(SOURCE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CR7-Tribute-LiveData/2.0; +https://github.com/jay-chou-creator/cr7-tribute)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9"
      },
      cf: { cacheTtl: 600 }
    });
    if (!res.ok) throw new Error("源站 HTTP " + res.status);
    html = await res.text();
  } catch (err) {
    record(false, "抓取失败：" + err.message);
    return { ok: false, error: "抓取失败：" + err.message };
  }

  const parsed = parseStats(html, previous, { force });
  if (!parsed.ok) {
    record(false, parsed.errors.join("; "));
    return { ok: false, errors: parsed.errors, warnings: parsed.warnings };
  }

  const data = { ...parsed.data, fetchedAt: runAt };
  const changed = !previous || NUMERIC_FIELDS.some((k) => previous[k] !== data[k]);

  /* 无论数据有没有变都要写：fetchedAt 表示「上次成功核对的时间」，
     不更新的话每次请求都会判定为过期，白白重复抓取源站。 */
  if (env.STATS_KV) {
    try {
      await env.STATS_KV.put(KV_LATEST, JSON.stringify(data));
    } catch (err) {
      record(false, "KV 写入失败：" + err.message);
      return { ok: false, error: "KV 写入失败：" + err.message };
    }
  }
  record(true, changed ? "已更新" : "无变化");

  return { ok: true, changed, data, warnings: parsed.warnings };
}

/* --------------------------------------------------------------------------
   HTTP 入口
   -------------------------------------------------------------------------- */
async function serveStats(request, env, ctx) {
  let payload = await readLatest(env);

  /* 只在 KV 还是空的时候（刚部署 / 首次访问）才当场抓一次，
     避免首次部署后空窗一整个 cron 周期。平时完全交给 cron，不做额外抓取。 */
  if (!payload && env.STATS_KV) {
    const result = await scrapeAndStore(env);
    payload = result.data || payload;
  }

  if (!payload) payload = { ...BASELINE, source: BASELINE.source + "（离线基准）" };

  return json(payload, {
    env,
    headers: {
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=600`
    }
  });
}

async function serveHealth(env) {
  let lastRun = null;
  let lastError = null;
  if (env.STATS_KV) {
    try {
      lastRun = await env.STATS_KV.get(KV_LAST_RUN, { type: "json" });
      lastError = await env.STATS_KV.get(KV_LAST_ERROR, { type: "json" });
    } catch (_) { /* 忽略 */ }
  }
  const latest = await readLatest(env);
  return json({
    service: "cr7-stats-worker",
    hasKv: Boolean(env.STATS_KV),
    hasData: Boolean(latest),
    lastRun,
    lastError,
    latest
  }, { env, headers: { "Cache-Control": "no-store" } });
}

export default {
  /* Cron Triggers：在 wrangler.toml 的 [triggers].crons 里配置 */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scrapeAndStore(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (url.pathname === "/api/cr7-stats" || url.pathname === "/api/cr7-stats/") {
      if (request.method === "POST") {
        /* 手动强制刷新：比赛日想立刻同步时调用，需要 REFRESH_TOKEN */
        const token =
          request.headers.get("x-refresh-token") ||
          url.searchParams.get("token") ||
          "";
        if (!env.REFRESH_TOKEN || token !== env.REFRESH_TOKEN) {
          return json({ error: "unauthorized" }, { status: 401, env });
        }
        const result = await scrapeAndStore(env, { force: true });
        return json(result, {
          status: result.ok ? 200 : 502,
          env,
          headers: { "Cache-Control": "no-store" }
        });
      }
      return serveStats(request, env, ctx);
    }

    if (url.pathname === "/api/cr7-stats/health") {
      return serveHealth(env);
    }

    if (url.pathname === "/") {
      return json({
        service: "cr7-stats-worker",
        endpoints: ["/api/cr7-stats", "/api/cr7-stats/health"],
        cacheTtlSeconds: CACHE_TTL_SECONDS
      }, { env });
    }

    return json({ error: "not found" }, { status: 404, env });
  }
};
