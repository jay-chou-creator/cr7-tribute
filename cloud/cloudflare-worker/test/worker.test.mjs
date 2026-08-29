/* Minimal local test for the worker's fetch handler (no wrangler needed).
   Run: node test/worker.test.mjs  (Node >= 18 with global fetch/Request/Response) */
import worker from "../src/worker.js";

const env = {};
const ctx = { waitUntil() {} };
let failures = 0;

function check(name, cond, extra) {
  if (cond) console.log("PASS", name);
  else { failures++; console.error("FAIL", name, extra ?? ""); }
}

/* 1. Baseline path: no override configured */
let res = await worker.fetch(new Request("https://w.example/api/cr7-stats"), env, ctx);
let body = await res.json();
check("baseline status 200", res.status === 200);
check("baseline goals", body.goals === 977, body);
check("baseline source", body.source === "baseline", body);
check("cors header", res.headers.get("Access-Control-Allow-Origin") === "*");

/* 2. Remote override path (mock global fetch) */
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({
  goals: 979, apps: 1331, assists: 261, trophies: 34,
  clubGoals: 832, clubApps: 1103, ntGoals: 147, ntApps: 229,
  updatedAt: "2026-09-01T18:00:00Z", junkField: true
}), { status: 200 });
env.STATS_JSON_URL = "https://override.example/stats.json";
res = await worker.fetch(new Request("https://w.example/api/cr7-stats"), env, ctx);
body = await res.json();
globalThis.fetch = realFetch;
check("override goals", body.goals === 979, body);
check("override updatedAt truncated", body.updatedAt === "2026-09-01", body);
check("override junk dropped", !("junkField" in body), body);
check("override source", body.source === "remote-override", body);
check("cache-control", res.headers.get("Cache-Control") === "public, max-age=300");

/* 3. Malformed override degrades to baseline */
globalThis.fetch = async () => new Response("not json", { status: 200 });
res = await worker.fetch(new Request("https://w.example/api/cr7-stats"), env, ctx);
body = await res.json();
globalThis.fetch = realFetch;
check("malformed override -> baseline", body.source === "baseline" && body.goals === 977, body);

/* 4. Contract guard: all-negative junk rejected -> baseline */
globalThis.fetch = async () => new Response(JSON.stringify({ goals: -5 }), { status: 200 });
res = await worker.fetch(new Request("https://w.example/api/cr7-stats"), env, ctx);
body = await res.json();
globalThis.fetch = realFetch;
check("invalid override -> baseline", body.source === "baseline", body);

/* 5. OPTIONS preflight + 404 */
res = await worker.fetch(new Request("https://w.example/api/cr7-stats", { method: "OPTIONS" }), env, ctx);
check("options 204", res.status === 204);
res = await worker.fetch(new Request("https://w.example/nope"), env, ctx);
check("404 route", res.status === 404);

process.exit(failures ? 1 : 0);
