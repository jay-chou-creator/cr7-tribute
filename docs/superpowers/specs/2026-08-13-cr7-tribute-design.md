# CR7 Tribute Website - Design Spec

**Date:** 2026-08-13
**Status:** Approved by user brief (the user's request message is the design source of truth)

## 1. Goal

A single-page, code-native tribute website for Cristiano Ronaldo: strong motion, high interactivity,
premium aesthetics, deep content, fully responsive (desktop / tablet / mobile), directly runnable
with zero build step and zero runtime dependencies.

## 2. Design System

### Palette (tokens)

| Token | Value | Usage |
|---|---|---|
| `--bg-0` | `#07080A` | page base (deep charcoal black) |
| `--bg-1` | `#0D0F13` | section bands / surfaces |
| `--bg-2` | `#14171D` | raised surfaces, cards |
| `--gold` | `#C9A227` | primary accent (metallic champagne gold) |
| `--gold-light` | `#E8CE8C` | highlights, hover glow |
| `--gold-dim` | `#8A7130` | muted gold, borders |
| `--text` | `#F5F4F0` | primary white |
| `--text-dim` | `#9BA0A8` | secondary text |
| `--line` | `rgba(201,162,39,.16)` | hairline borders |

### Typography

- Display: system stack `"Arial Black", "Segoe UI", sans-serif` with heavy weight + tight tracking
  (fallback-first; no external font downloads for offline reliability).
- Body: `"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`.
- Data/numerals: `"Cascadia Mono", Consolas, monospace` for stats and years.
- Handwritten signature: `"Segoe Script", "Comic Sans MS", cursive` (footer only).

### Motion

- Reveal: opacity 0 → 1 + translateY(24px), 0.5s cubic-bezier(.22,.61,.36,1), triggered by
  IntersectionObserver, staggered by data-delay.
- Hover: 0.3s transitions on transform/box-shadow/color; micro "sheen" sweep on cards/buttons.
- Ambient: slow golden particles (canvas) in hero + data section; prefers-reduced-motion honored.

## 3. Page Structure (sections in order)

1. **Hero** - full viewport; generated dark stadium background with footballer silhouette
   ("SIUU" pose), black gradient overlays, headline `CRISTIANO RONALDO`, subtitle
   「足坛传奇 · 纪录之王」, CTA 「开启传奇之旅」→ `#journey`; mouse-follow parallax + scroll
   background shift; golden particles.
2. **Nav** - transparent → frosted glass (`backdrop-filter`) after scroll; anchors with smooth
   scrolling; active-link highlight; mobile burger menu.
3. **Timeline** (`#journey`) - vertical line with progress fill on scroll; 8 nodes:
   Sporting CP (2002-03) / Man Utd I (2003-09) / Real Madrid (2009-18) / Juventus (2018-21) /
   Man Utd II (2021-22) / Al-Nassr (2023-) / Portugal NT (2003-); expandable detail cards
   (click/hover) with era image, key matches, stats.
4. **Data center** (`#data`) - 3 tabs (俱乐部生涯 / 国家队生涯 / 个人荣誉); count-up metrics,
   animated bar chart (goals per season era), donut chart (goal share by club), record list,
   filter chips (赛事/赛季).
5. **Gallery** (`#moments`) - masonry cards (CSS columns), lazy-loaded generated images,
   hover zoom + caption reveal, modal with full story; filter chips (赛事/年份/成就类型).
6. **Honors wall** (`#honors`) - responsive grid of SVG line-art trophy icons with slow glow
   animation; hover reveals full award name, years, key achievement; count summary.
7. **Biography** (`#legend`) - 3 sub-tabs (成长之路 / 竞技精神 / 赛场之外), image + prose,
   scroll fade-ins, key sentences in bold gold.
8. **Footer** - tribute copy + handwritten signature `CR7`, back-to-top button appears after
   scroll with progress ring.

## 4. Content Facts (verified 2026-08, marked 数据截至 2026 年 8 月)

- Career: 977 official goals, 261 assists, 1,330 matches.
- Club goals: Real Madrid 451, Man Utd 145 (both spells), Al-Nassr 129, Juventus 101, Sporting 5.
- Portugal: 146 goals / 228 caps; Euro 2016 + Nations League 2019 winner; first man to score
  in 6 World Cups (2026).
- Al-Nassr: Arab Club Champions Cup 2023; Saudi Pro League champion 2025-26 (28 league goals
  that season).
- Individual: 5 Ballon d'Or (2008, 2013, 2014, 2016, 2017); 4 European Golden Shoes;
  CL all-time top scorer 140 goals / 183 apps; record 17 goals in one CL season (2013-14).
- Team honours: 34 senior titles (9 Man Utd, 16 Real Madrid, 5 Juventus, 2 Al-Nassr, 2 Portugal).

## 5. Tech Constraints

- Vanilla HTML5 + CSS3 + ES2017+ JS, no frameworks, no build step, no external requests.
- Semantic markup; Grid/Flex layout; `loading="lazy"` images; CSS transforms for animation;
  one shared IntersectionObserver; single canvas particle field; W3C-valid syntax;
  `prefers-reduced-motion` support.

## 6. Assets

Paid image generation was abandoned by user request (quota exhausted); all imagery was sourced
from Wikimedia Commons (CC / public domain) and processed locally: center-crop to slot ratios,
WebP q84 conversion (23 assets, ~4 MB total). Attribution table in `assets/img/CREDITS.md`;
cards without an exact-match photo are labelled "资料图".

## 7. Deliverable

`outputs/cr7-tribute/` - `index.html`, `css/style.css`, `js/main.js`, `js/data.js`,
`assets/img/*.webp` (generated, converted to WebP), `docs/`.
