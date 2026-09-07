/* 解析器离线测试（不需要网络、不需要 wrangler）
   运行：node test/parser.test.mjs */
import {
  parseStats,
  parseOverview,
  parseTeams,
  splitClubVsCountry,
  extractJsonLd,
  stripHtml
} from "../src/parser.js";

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("PASS", name);
  else {
    failures += 1;
    console.error("FAIL", name, extra !== undefined ? JSON.stringify(extra) : "");
  }
}

const ITEM_LIST = `{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Real Madrid: 450 goals, 438 appearances, 131 assists" },
    { "@type": "ListItem", "position": 2, "name": "Portugal: 146 goals, 233 appearances, 45 assists" },
    { "@type": "ListItem", "position": 3, "name": "Manchester United: 145 goals, 346 appearances, 64 assists" },
    { "@type": "ListItem", "position": 4, "name": "Al Nassr: 131 goals, 152 appearances, 23 assists" },
    { "@type": "ListItem", "position": 5, "name": "Juventus: 101 goals, 134 appearances, 22 assists" },
    { "@type": "ListItem", "position": 6, "name": "Sporting CP: 5 goals, 31 appearances, 6 assists" }
  ]
}`;

/* ---------- 1. 现行文案（2026-09 数据源改版后的 FAQPage 结构） ---------- */
const CURRENT_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "WebPage",
  "description": "Ronaldo's goals, assists and appearances split across all six teams he has played for, as of 7 September 2026.",
  "dateModified": "2026-09-07" }
</script>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
  { "@type": "Question", "name": "How many goals has Cristiano Ronaldo scored?",
    "acceptedAnswer": { "@type": "Answer", "text": "Cristiano Ronaldo has scored 978 career goals in 1,334 senior appearances for club and country as of 7 September 2026, a rate of 0.73 goals per game." } },
  { "@type": "Question", "name": "How many assists does Cristiano Ronaldo have?",
    "acceptedAnswer": { "@type": "Answer", "text": "Cristiano Ronaldo has 291 career assists in 1,334 appearances as of 7 September 2026." } },
  { "@type": "Question", "name": "How many trophies has Ronaldo won?",
    "acceptedAnswer": { "@type": "Answer", "text": "Cristiano Ronaldo has won 35 team trophies, including 5 UEFA Champions Leagues." } }
] }
</script>
<script type="application/ld+json">${ITEM_LIST}</script>
</head><body><p>Cristiano Ronaldo has scored 978 career goals.</p></body></html>`;

let r = parseStats(CURRENT_HTML, null);
check("现行文案：解析成功", r.ok, r.errors);
check("现行文案：进球 978", r.data && r.data.goals === 978, r.data);
check("现行文案：出场 1334", r.data && r.data.apps === 1334, r.data);
check("现行文案：助攻 291", r.data && r.data.assists === 291, r.data);
check("现行文案：冠军 35", r.data && r.data.trophies === 35, r.data);
check("现行文案：俱乐部 832 球", r.data && r.data.clubGoals === 832, r.data);
check("现行文案：国家队 146 球 / 233 场",
  r.data && r.data.ntGoals === 146 && r.data.ntApps === 233, r.data);
check("现行文案：更新日期 2026-09-07", r.data && r.data.updatedAt === "2026-09-07", r.data);

/* ---------- 2. 旧版文案（WebPage description）仍能解析 ---------- */
const LEGACY_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "WebPage",
  "description": "Cristiano Ronaldo has 980 career goals, 292 assists and 1,340 appearances.",
  "dateModified": "2026-10-01" }
</script>
<script type="application/ld+json">${ITEM_LIST}</script>
</head><body></body></html>`;

r = parseStats(LEGACY_HTML, null);
check("旧版文案：解析成功", r.ok, r.errors);
check("旧版文案：进球 980", r.data && r.data.goals === 980, r.data);
check("旧版文案：助攻 292", r.data && r.data.assists === 292, r.data);
check("旧版文案：出场 1340", r.data && r.data.apps === 1340, r.data);

/* ---------- 3. 单调校验：生涯累计不应倒退 ---------- */
r = parseStats(CURRENT_HTML, { goals: 990, apps: 1340, assists: 291, trophies: 35 });
check("数字倒退被拒绝", !r.ok && r.errors.some((e) => e.includes("goals")), r.errors);
r = parseStats(CURRENT_HTML, { goals: 990 }, { force: true });
check("--force 可跳过单调校验", r.ok, r.errors);

/* ---------- 4. 范围校验：离谱数字被拒绝 ---------- */
const CRAZY_HTML = CURRENT_HTML.replace(
  "has scored 978 career goals in 1,334 senior appearances",
  "has scored 5000 career goals in 1,334 senior appearances"
);
r = parseStats(CRAZY_HTML, null);
check("进球数离谱被拒绝", !r.ok && r.errors.some((e) => e.includes("goals")), r.errors);

/* ---------- 5. 结构性缺失 ---------- */
r = parseStats("<html><body>no structured data here</body></html>", null);
check("无 JSON-LD 时报错", !r.ok && r.errors[0].includes("JSON-LD"), r.errors);

const NO_LIST = CURRENT_HTML.replace(
  /<script type="application\/ld\+json">\{[\s\S]*?"@type": "ItemList"[\s\S]*?<\/script>/,
  ""
);
r = parseStats(NO_LIST, null);
check("无 ItemList 时报错", !r.ok && r.errors.some((e) => e.includes("逐队")), r.errors);

/* ---------- 6. 单元测试：子函数 ---------- */
const blocks = extractJsonLd(CURRENT_HTML);
check("提取到 3 个 JSON-LD 块", blocks.length === 3, blocks.length);

const overview = parseOverview(blocks, stripHtml(CURRENT_HTML));
check("parseOverview 独立可用",
  overview.goals === 978 && overview.apps === 1334 && overview.assists === 291, overview);

const teams = parseTeams(blocks, stripHtml(CURRENT_HTML));
check("parseTeams 解析出 6 支球队", teams.length === 6, teams.length);

const split = splitClubVsCountry(teams);
check("俱乐部/国家队拆分正确",
  split.clubGoals === 832 && split.ntGoals === 146 && split.ntApps === 233, split);

console.log(failures ? `\n${failures} 项失败` : "\n全部通过");
process.exit(failures ? 1 : 0);
