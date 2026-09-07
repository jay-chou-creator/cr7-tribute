# CR7 Tribute Website

A single-page tribute website for Cristiano Ronaldo: motion-rich, interactive, fully responsive,
and dependency-free (vanilla HTML / CSS / JS).

## 线上地址

- 站点：https://cr7-tribute.pages.dev
- 数据接口：https://cr7-tribute.pages.dev/api/cr7-stats
- 数据源 Worker：https://cr7-tribute-stats.2736784080.workers.dev
  （`/api/cr7-stats` 取数、`/api/cr7-stats/health` 看最近一次抓取结果）

## Run

No build step required. Either open `index.html` directly, or serve the folder locally:

```powershell
python -m http.server 8765
```

Then visit `http://localhost:8765`.

## Structure

```text
index.html          Semantic page skeleton (nav, hero, timeline, data, gallery, honors, bio, footer, modal)
css/style.css       Design tokens, section styles, motion, responsive breakpoints, reduced-motion
js/data.js          Content source of truth (eras, stats, moments, honors, biography) + LIVE_DATA config
js/main.js          Rendering + interactions (observer reveals, tabs, filters, charts, modal, particles, parallax)
assets/img/*.webp   Photos (Wikimedia Commons, CC-licensed; see assets/img/CREDITS.md)
favicon.ico         Site icon
cloud/              Cloudflare Worker proxy for live career stats (see cloud/cloudflare-worker/README.md)
docs/               Design spec + implementation plan (superpowers workflow)
```

## Features

- Hero: full-viewport photo, gradient overlays, mouse-follow parallax, scroll fade, golden particles
- Nav: transparent to frosted glass on scroll, smooth anchors, active-section highlight, mobile burger menu
- Timeline: 7 career phases, scroll-lit progress line, expandable detail cards with era photos and stories
- Data center: 3 tabs (club / national team / individual), count-up counters, animated bar charts,
  donut chart, competition filters, records lists
- Gallery: masonry cards, competition/type filters, modal with full story and image attribution
- Honors wall: 33 tiles with SVG line-art icons, glow animation, hover reveal
- Biography: 3 chapters with scroll-fade paragraphs and gold key sentences
- Live data: stat counters bound to a proxy endpoint with static-baseline fallback,
  golden pulse on goal-count changes, replayable count animations, source/updated stamp
- Footer: tribute quote, handwritten signature, progress-ring back-to-top

## Content & accuracy

Stats are verified against ronaldostats.app as of September 2026 (978 official goals, 1,334 matches,
291 assists, 35 team trophies; Portugal 146 goals / 233 caps; Saudi Pro League champion 2025-26;
first man to score in six World Cups, etc.). A footnote on the page states the data cutoff.

## Live data

Current numbers (source: ronaldostats.app, as of 2026-09-07): **978 official goals**, 1,334
appearances, 291 assists, 35 team trophies; Portugal 146 goals / 233 caps; Saudi Pro League
champion 2025-26; first man to score in six World Cups.

The pipeline is Cloudflare-first:

```text
ronaldostats.app ──(Worker cron, every 6h)──▶ Workers KV ──▶ /api/cr7-stats ──▶ browser
                                                                    ▲
                      GitHub Actions (daily, fallback) ──▶ data/live-stats.json
```

The frontend walks three tiers and never goes blank:

| Tier | Source | Badge shown |
| --- | --- | --- |
| 1 | `/api/cr7-stats` — Cloudflare Pages Function reading KV | 在线数据（绿色 LIVE 指示灯） |
| 2 | `data/live-stats.json` — static snapshot in the repo | 静态快照 |
| 3 | `LIVE_DATA.baseline` in `js/data.js` | 静态基准数据 |

Polling is 5 min in live mode / 1 h otherwise, with exponential backoff on repeated
failures and an immediate refresh when the tab regains focus. Number increases trigger the
golden pulse animation.

Full deployment steps: `cloud/cloudflare-worker/README.md`.

## Deployment

| Target | How |
| --- | --- |
| Cloudflare Pages (primary) | Connect the GitHub repo, framework preset **None**, build command empty, output directory **/** — pushes to `main` auto-deploy |
| Cloudflare Worker (data) | `cd cloud/cloudflare-worker && npx wrangler deploy` (also registers the 6-hour cron) |
| GitHub Pages (legacy) | Repo → Settings → Pages → Deploy from branch `main`, root |

After the Worker is up, bind the KV namespace in Pages:
**Pages → Settings → Functions → KV namespace bindings → `STATS_KV`**.
The Pages Function degrades gracefully if the binding is missing.

## Image credits

All photos are from Wikimedia Commons under CC / public-domain licenses. Full attribution
(source page, author, license) is in `assets/img/CREDITS.md`; the gallery modal also links each
moment to its source page. Cards that use an era-appropriate file instead of the exact match are
labelled "资料图" (archival/illustrative).

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). `prefers-reduced-motion` is respected.

## 实时数据功能

C 罗生涯数据自动更新，数据源 `ronaldostats.app`（人工逐场核对）。

- **主链路**：Cloudflare Worker + Cron Triggers，每 6 小时抓取一次，校验通过后写入 Workers KV，
  由同源的 Pages Function `/api/cr7-stats` 提供给前端。Cloudflare 的 cron 不会因仓库无活动而被停用。
- **兜底链路**：GitHub Actions 每天 03:00 UTC 跑一次 `scripts/fetch-stats.py`，
  更新仓库里的静态快照 `data/live-stats.json`。
- **离线兜底**：`js/data.js` 里的 `LIVE_DATA.baseline` 硬编码基准值。

前端三级自动回退，任何一级挂掉都不会白屏；生涯累计数字只增不减，异常回跳的数据会被丢弃。

手动触发更新：

```bash
# 前端会自动拉取，无需操作；想强制刷新可以调用 Worker 的刷新接口
curl -X POST -H "x-refresh-token: <REFRESH_TOKEN>" \
  https://cr7-tribute-stats.<你的子域名>.workers.dev/api/cr7-stats
```

### 2026-09 故障复盘

数据源改版了 JSON-LD 文案（`WebPage.description` 里不再是
"has 978 career goals, 291 assists and 1,333 appearances"），旧脚本唯一那条正则匹配不上，
导致 GitHub Actions 从 2026-09-05 起连续失败、数据停在旧值。

修复方式：抓取脚本重写为多策略解析（FAQPage / WebPage.description / ItemList 求和 / 整页文本兜底），
每个字段独立解析；再加三重校验（范围 / 交叉 / 单调），校验不过就保留上一次的好数据。
同时把主链路迁到 Cloudflare，避免 GitHub 停用 schedule 事件导致整体失效。
