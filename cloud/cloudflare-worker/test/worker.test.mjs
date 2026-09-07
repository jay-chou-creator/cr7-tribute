/* Worker 路由测试（mock fetch 与 KV，不需要 wrangler、不需要网络）
   运行：node test/worker.test.mjs */
import worker from "../src/worker.js";
import { BASELINE } from "../src/parser.js";

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("PASS", name);
  else {
    failures += 1;
    console.error("FAIL", name, extra !== undefined ? JSON.stringify(extra) : "");
  }
}

function makeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key, opts) {
      const value = store.get(key);
      if (value === undefined) return null;
      if (opts && opts.type === "json") {
        try { return JSON.parse(value); } catch { return null; }
      }
      return value;
    },
    async put(key, value) { store.set(key, value); }
  };
}

const SOURCE_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "WebPage", "dateModified": "2026-09-07",
  "description": "Ronaldo's goals, assists and appearances split across all six teams." }
</script>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
  { "@type": "Question", "name": "How many goals has Cristiano Ronaldo scored?",
    "acceptedAnswer": { "@type": "Answer", "text": "Cristiano Ronaldo has scored 978 career goals in 1,334 senior appearances as of 7 September 2026." } },
  { "@type": "Question", "name": "How many assists does Cristiano Ronaldo have?",
    "acceptedAnswer": { "@type": "Answer", "text": "Cristiano Ronaldo has 291 career assists in 1,334 appearances." } },
  { "@type": "Question", "name": "How many trophies has Ronaldo won?",
    "acceptedAnswer": { "@type": "Answer", "text": "Cristiano Ronaldo has won 35 team trophies." } }
] }
</script>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
  { "@type": "ListItem", "position": 1, "name": "Real Madrid: 450 goals, 438 appearances, 131 assists" },
  { "@type": "ListItem", "position": 2, "name": "Portugal: 146 goals, 233 appearances, 45 assists" },
  { "@type": "ListItem", "position": 3, "name": "Manchester United: 145 goals, 346 appearances, 64 assists" },
  { "@type": "ListItem", "position": 4, "name": "Al Nassr: 131 goals, 152 appearances, 23 assists" },
  { "@type": "ListItem", "position": 5, "name": "Juventus: 101 goals, 134 appearances, 22 assists" },
  { "@type": "ListItem", "position": 6, "name": "Sporting CP: 5 goals, 31 appearances, 6 assists" }
] }
</script>
</head><body></body></html>`;

const realFetch = globalThis.fetch;
function mockSource(html, status = 200) {
  globalThis.fetch = async () => new Response(html, {
    status,
    headers: { "Content-Type": "text/html" }
  });
}

const ctx = { waitUntil() {} };

/* ---------- 1. KV 已有数据时直接返回，不触发抓取 ---------- */
let kv = makeKv({ latest: JSON.stringify({ ...BASELINE, goals: 979 }) });
let res = await worker.fetch(new Request("https://w.example/api/cr7-stats"), { STATS_KV: kv }, ctx);
let body = await res.json();
check("命中 KV：200", res.status === 200);
check("命中 KV：goals 979", body.goals === 979, body);
check("命中 KV：CORS 头", res.headers.get("Access-Control-Allow-Origin"));
check("命中 KV：Cache-Control", (res.headers.get("Cache-Control") || "").includes("max-age=300"));

/* ---------- 2. KV 为空时按需抓取并写入 ---------- */
mockSource(SOURCE_HTML);
kv = makeKv();
res = await worker.fetch(new Request("https://w.example/api/cr7-stats"), { STATS_KV: kv }, ctx);
body = await res.json();
globalThis.fetch = realFetch;
check("冷启动抓取：goals 978", body.goals === 978, body);
check("冷启动抓取：已写入 KV", kv.store.has("latest"));

/* ---------- 3. 源站异常时降级，不返回 5xx ---------- */
mockSource("boom", 503);
kv = makeKv();
res = await worker.fetch(new Request("https://w.example/api/cr7-stats"), { STATS_KV: kv }, ctx);
body = await res.json();
globalThis.fetch = realFetch;
check("源站 503：接口仍返回 200", res.status === 200, res.status);
check("源站 503：回退到基准值", body.goals === BASELINE.goals, body);
check("源站 503：错误已记录", kv.store.has("lastError"));

/* ---------- 4. 手动刷新需要 token ---------- */
kv = makeKv();
res = await worker.fetch(
  new Request("https://w.example/api/cr7-stats", { method: "POST" }),
  { STATS_KV: kv, REFRESH_TOKEN: "secret" },
  ctx
);
check("无 token 强制刷新：401", res.status === 401, res.status);

mockSource(SOURCE_HTML);
res = await worker.fetch(
  new Request("https://w.example/api/cr7-stats", {
    method: "POST",
    headers: { "x-refresh-token": "secret" }
  }),
  { STATS_KV: kv, REFRESH_TOKEN: "secret" },
  ctx
);
body = await res.json();
globalThis.fetch = realFetch;
check("带 token 强制刷新：成功", res.status === 200 && body.ok === true, body);

/* ---------- 5. 健康检查 ---------- */
kv = makeKv({ latest: JSON.stringify(BASELINE), lastRun: JSON.stringify({ at: "now", ok: true, detail: "无变化" }) });
res = await worker.fetch(new Request("https://w.example/api/cr7-stats/health"), { STATS_KV: kv }, ctx);
body = await res.json();
check("健康检查 200", res.status === 200);
check("健康检查：hasData", body.hasData === true, body);
check("健康检查：lastRun", body.lastRun && body.lastRun.ok === true, body);

/* ---------- 6. 路由与预检 ---------- */
res = await worker.fetch(new Request("https://w.example/api/cr7-stats", { method: "OPTIONS" }), {}, ctx);
check("OPTIONS 预检 204", res.status === 204, res.status);
res = await worker.fetch(new Request("https://w.example/"), {}, ctx);
check("根路径返回服务信息", res.status === 200);
res = await worker.fetch(new Request("https://w.example/nope"), {}, ctx);
check("未知路径 404", res.status === 404, res.status);

/* ---------- 7. scheduled：定时抓取写入 KV ---------- */
mockSource(SOURCE_HTML);
kv = makeKv();
let waited = null;
await worker.scheduled({}, { STATS_KV: kv }, { waitUntil: (p) => { waited = p; } });
globalThis.fetch = realFetch;
if (waited) await waited;
check("cron：已写入 latest", kv.store.has("latest"), [...kv.store.keys()]);
check("cron：已写入 lastRun", kv.store.has("lastRun"));

console.log(failures ? `\n${failures} 项失败` : "\n全部通过");
process.exit(failures ? 1 : 0);
