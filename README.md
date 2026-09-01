# CR7 Tribute Website

A single-page tribute website for Cristiano Ronaldo: motion-rich, interactive, fully responsive,
and dependency-free (vanilla HTML / CSS / JS).

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

Stats are verified against public records as of August 2026 (977 official goals, 1,330 matches,
261 assists; Portugal 146 goals / 228 caps; Saudi Pro League champion 2025-26; first man to score
in six World Cups, etc.). A footnote on the page states the data cutoff.

## Live data

By default the page runs in static-baseline mode (GitHub Pages friendly, no keys, no CORS
issues) with a visible "last updated" stamp. To enable live refresh, deploy the bundled
Cloudflare Worker in `cloud/cloudflare-worker/` and point `LIVE_DATA.api` in `js/data.js`
at it — the page then polls (5 min on match days, 1 h otherwise), animates number changes
with a golden pulse, and degrades back to the baseline on any network failure.
Full deployment steps: `cloud/cloudflare-worker/README.md`.

## Image credits

All photos are from Wikimedia Commons under CC / public-domain licenses. Full attribution
(source page, author, license) is in `assets/img/CREDITS.md`; the gallery modal also links each
moment to its source page. Cards that use an era-appropriate file instead of the exact match are
labelled "资料图" (archival/illustrative).

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). `prefers-reduced-motion` is respected.

## 实时数据功能
本网站已集成 C 罗实时进球数据自动更新功能，数据来源 ronaldostats.app，通过 GitHub Actions 每日自动更新。
