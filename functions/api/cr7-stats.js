/* ==========================================================================
   Cloudflare Pages Function：/api/cr7-stats
   --------------------------------------------------------------------------
   同源接口，前端 js/data.js 的第一个端点。读取顺序：
     1. Workers KV（由 cr7-tribute-stats Worker 的 Cron 每 6 小时写入）
     2. 站点内的静态快照 /data/live-stats.json（GitHub Actions 兜底巡检更新）
     3. 代码内 BASELINE 硬编码基准值

   任何一级挂掉都自动降级，永远不会给前端返回 5xx。
   ========================================================================== */
"use strict";

const BASELINE = {
  goals: 978,
  apps: 1334,
  assists: 291,
  trophies: 35,
  clubGoals: 832,
  clubApps: 1101,
  ntGoals: 146,
  ntApps: 233,
  updatedAt: "2026-09-07",
  source: "ronaldostats.app · 人工逐场核对 · FIFA/UEFA/各成员协会官方正式赛事口径"
};

const CACHE_TTL_SECONDS = 300;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept",
    "Access-Control-Max-Age": "86400"
  };
}

async function fromKv(env) {
  if (!env.STATS_KV) return null;
  try {
    const raw = await env.STATS_KV.get("latest", { type: "json" });
    return raw && typeof raw === "object" && typeof raw.goals === "number" ? raw : null;
  } catch (_) {
    return null;
  }
}

async function fromStaticSnapshot(request) {
  try {
    const url = new URL("/data/live-stats.json", request.url);
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: CACHE_TTL_SECONDS }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data.goals === "number" ? data : null;
  } catch (_) {
    return null;
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const payload =
    (await fromKv(env)) ||
    (await fromStaticSnapshot(request)) ||
    { ...BASELINE, stale: true };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=600`,
      ...corsHeaders()
    }
  });
}
