/* ==========================================================================
   CR7 Tribute - main.js (interactions & rendering)
   Vanilla JS, no dependencies.
   ========================================================================== */
"use strict";

const HONOR_ICONS = {
  cup: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6h20v8a10 10 0 0 1-20 0V6Z"/><path d="M14 10h-4a4 4 0 0 0 4 8M34 10h4a4 4 0 0 1-4 8"/><path d="M24 24v6m0 0h-8a2 2 0 0 0-2 2v2h20v-2a2 2 0 0 0-2-2h-8Zm0 0v6"/></svg>',
  shield: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 4 40 9v13c0 10-6.5 17.5-16 22C14.5 39.5 8 32 8 22V9l16-5Z"/><path d="M18 23l5 5 8-9"/></svg>',
  star: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M24 4l6 13 14 1.5-10.5 9L37 42l-13-7.5L11 42l3.5-14.5L4 18.5 18 17l6-13Z"/></svg>',
  boot: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 40h32M12 34l4-14 8-4 6 2 4-8 4 4-3 7-3 4 3 3-2 6H12Z"/><path d="M16 20l-4 6"/></svg>',
  medal: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="31" r="9"/><path d="M24 26l1.6 3.2 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.5-2.4 3.4-.5L24 26Z"/><path d="M24 40v-6m-9-3H6l8-8M33 31h9l-8-8"/></svg>',
  globe: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="18"/><path d="M6 24h36M24 6c6 6 6 30 0 36M24 6c-6 6-6 30 0 36"/><path d="M12 14h26M10 34h28"/></svg>',
  ball: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="18"/><path d="M24 6v36M6 24h36M9 13l30 22M39 13 9 35"/><path d="M24 6c-7 6-7 30 0 36M24 6c7 6 7 30 0 36"/></svg>',
  crown: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 36h32M10 32l-3-20 12 9 5-15 5 15 12-9-3 20H10Z"/><path d="M14 40h20"/></svg>'
};

/* 图片来源与署名（Wikimedia Commons，待素材选定后填充真实链接） */
const CREDITS = {
  facup: "https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_and_Andriy_Shevchenko,_2007.jpg",
  moscow: "https://commons.wikimedia.org/wiki/File:2008_0521_Moscow_41.jpg",
  porto: "https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_free_Kick_(5628686898).jpg",
  campnou: "https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_(5593113861).jpg",
  lisbon2014: "https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_(35480124482).jpg",
  euro2016: "https://commons.wikimedia.org/wiki/File:Euro_2016_Cristiano_Ronaldo.jpg",
  cardiff: "https://commons.wikimedia.org/wiki/File:Real_Madrid_celebration_after_winning_the_2018_UEFA_Champions_League_Final_DSC_0561_(41501641655).jpg",
  bicycle: "https://commons.wikimedia.org/wiki/File:2019-20_Serie_A_-_Torino_v_Juventus_-_Cristiano_Ronaldo.jpg",
  atletico: "https://commons.wikimedia.org/wiki/File:Atl%C3%A9tico_de_Madrid_v_Juventus,_10_August_2019_(5).jpg",
  arabcup: "https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_with_Al_Nassr,_19_September_2023_-_44.jpg",
  ninehundred: "https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_2277.jpg",
  wc2026: "https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_Croatia_v_Portugal_2_July_2026-086.jpg"
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- 通用：数字滚动 ---------------- */
function animateCount(el, target, duration = 1400) {
  if (prefersReducedMotion) { el.textContent = target.toLocaleString(); return; }
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------------- 通用：视口观察 ---------------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const delay = el.dataset.delay ? parseInt(el.dataset.delay, 10) : 0;
      el.style.transitionDelay = delay + "ms";
      el.classList.add("is-in");
      if (el.dataset.count) animateCount(el, parseInt(el.dataset.count, 10));
      revealObserver.unobserve(el);
    }
  });
}, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });

function observeReveals(root = document) {
  $$(".reveal, .dnum, [data-count], .bio-prose p.is-reveal", root).forEach((el) => {
    if (!el.classList.contains("is-in")) revealObserver.observe(el);
  });
}

/* ---------------- 导航 ---------------- */
const nav = $("#nav");
const navToggle = $("#navToggle");
const navMenu = $("#navMenu");

function updateNav() {
  nav.classList.toggle("scrolled", window.scrollY > 40);
}

navToggle.addEventListener("click", () => {
  const open = navToggle.getAttribute("aria-expanded") === "true";
  navToggle.setAttribute("aria-expanded", String(!open));
  navMenu.classList.toggle("is-open", !open);
  navToggle.setAttribute("aria-label", open ? "打开菜单" : "关闭菜单");
});

navMenu.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    navToggle.setAttribute("aria-expanded", "false");
    navMenu.classList.remove("is-open");
  }
});

/* 滚动高亮当前导航项 */
const navLinks = $$(".nav-link");
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === "#" + id);
      });
    }
  });
}, { rootMargin: "-42% 0px -52% 0px" });
$$("section[id]").forEach((s) => sectionObserver.observe(s));

/* ---------------- 时间轴 ---------------- */
const tlNodes = $("#tlNodes");
const tlProgress = $("#tlProgress");
const chevron = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

function renderTimeline() {
  tlNodes.innerHTML = CR7.eras.map((era, i) => {
    const stats = `
      <div class="tl-stats">
        <div class="tl-stat"><b>${era.apps}</b><span>出场</span></div>
        <div class="tl-stat"><b>${era.goals}</b><span>进球</span></div>
        <div class="tl-stat"><b>${era.trophies}</b><span>冠军</span></div>
      </div>`;
    const stories = era.stories.map((s) => `<div class="tl-story"><h4>${s.h}</h4><p>${s.p}</p></div>`).join("");
    return `
      <article class="tl-node reveal" data-era="${era.id}" style="--delay:${i * 60}ms">
        <span class="tl-dot" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <div class="tl-card" role="button" tabindex="0" aria-expanded="false" aria-label="展开 ${era.club} 详情">
          <div class="tl-card-head">
            <div>
              <span class="tl-years">${era.years}</span>
              <h3 class="tl-club">${era.club}</h3>
              <p class="tl-tagline">${era.tagline}</p>
            </div>
            <span class="tl-chevr">${chevron}</span>
          </div>
          <div class="tl-media"><img src="${era.img}" alt="${era.club}时期" loading="lazy"></div>
          <div class="tl-body"><div class="tl-body-inner">${stats}${stories}</div></div>
        </div>
      </article>`;
  }).join("");

  $$(".tl-card", tlNodes).forEach((card) => {
    const toggle = () => {
      const node = card.closest(".tl-node");
      const open = node.classList.toggle("is-open");
      card.setAttribute("aria-expanded", String(open));
    };
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });
}

const tlObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("is-lit");
  });
}, { threshold: 0.3, rootMargin: "0px 0px -12% 0px" });

function updateTimelineProgress() {
  const timeline = $("#timeline");
  if (!timeline) return;
  const rect = timeline.getBoundingClientRect();
  const vh = window.innerHeight;
  const progress = Math.min(Math.max((vh * 0.72 - rect.top) / rect.height, 0), 1);
  tlProgress.style.height = (progress * 100) + "%";
  $$(".tl-node", tlNodes).forEach((node) => {
    if (!node.classList.contains("is-lit") && node.getBoundingClientRect().top < vh * 0.82) {
      node.classList.add("is-lit");
    }
  });
}

/* ---------------- 图表 ---------------- */
function renderBarChart(container, data, maxOverride) {
  const max = maxOverride || Math.max(...data.map((d) => d.value));
  container.innerHTML = data.map((d) => `
    <div class="bar">
      <span class="bar-value">${d.value}</span>
      <span class="bar-fill" style="--h:${Math.max((d.value / max) * 100, 3)}%"></span>
      <span class="bar-label">${d.label}</span>
    </div>`).join("");
}

const barObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const bar = entry.target;
      bar.style.height = bar.style.getPropertyValue("--h");
      bar.parentElement.classList.add("is-animated");
      barObserver.unobserve(bar);
    }
  });
}, { threshold: 0.4 });

function bindBarAnimations(root) {
  $$(".bar-fill", root).forEach((bar) => barObserver.observe(bar));
}

function renderDonut(containerId, data, totalElId) {
  const donut = $("#" + containerId);
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const stops = data.map((d) => {
    const from = acc;
    acc += d.value;
    return `${d.color} ${from}% ${acc}%`;
  }).join(", ");
  donut.style.background = `conic-gradient(${stops})`;
  $("#" + totalElId).textContent = total.toLocaleString();
  const legend = $("#clubLegend");
  if (legend) {
    legend.innerHTML = data.map((d) => `<li><i style="background:${d.color}"></i>${d.label} <b style="margin-left:auto;color:var(--gold-light);font-family:var(--font-mono)">${d.value}%</b></li>`).join("");
  }
}

function renderRecords(container, records, filter = "all") {
  const list = records.filter((r) => filter === "all" || r.comp === filter || !r.comp);
  container.innerHTML = list.map((r) => `<li><b>◆</b>${r.text}<span>${r.tag}</span></li>`).join("");
}

/* ---------------- 数据看板 ---------------- */
function initDataBoard() {
  renderBarChart($("#clubBar"), CR7.stats.club.bars);
  renderBarChart($("#ntBar"), CR7.stats.nt.bars);
  renderBarChart($("#honorBar"), CR7.stats.honor.bars);
  renderDonut("clubDonut", CR7.stats.club.donut, "clubDonutTotal");
  renderRecords($("#clubRecords"), CR7.stats.club.records);
  renderRecords($("#ntRecords"), CR7.stats.nt.records);
  renderRecords($("#honorRecords"), CR7.stats.honor.records);
  bindBarAnimations(document);

  /* 俱乐部纪录赛事筛选 */
  const clubChips = $$(".chips[data-filter-group=\"club\"] .chip");
  clubChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      clubChips.forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      renderRecords($("#clubRecords"), CR7.stats.club.records, chip.dataset.filter);
    });
  });
}

/* ---------------- 标签页（数据 + 人物志共用） ---------------- */
function initTabs() {
  $$(".tabs").forEach((tablist) => {
    $$(".tab-btn", tablist).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".tab-btn", tablist).forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
        const panelKey = btn.dataset.tab || btn.dataset.biotab;
        const isData = !!btn.dataset.tab;
        $$(isData ? ".tab-panel[data-panel]" : ".bio-panel[data-biopanel]").forEach((panel) => {
          const key = panel.dataset.panel || panel.dataset.biopanel;
          panel.classList.toggle("is-active", key === panelKey);
        });
        if (isData) observeReveals($("#panel-" + panelKey));
        else observeReveals($(".bio-panel.is-active"));
      });
    });
  });
}

/* ---------------- 经典时刻画廊 ---------------- */
const masonry = $("#masonry");
let momentState = { comp: "all", type: "all" };

function momentTags(m) {
  const compMap = { ucl: "欧冠", dom: "国内赛事", nt: "国家队", ksa: "沙特" };
  const typeMap = { title: "冠军", record: "纪录", classic: "经典", comeback: "逆转" };
  return `<span class="mcard-tag">${compMap[m.comp]}</span><span class="mcard-tag">${typeMap[m.type]}</span>`;
}

function renderGallery() {
  masonry.innerHTML = CR7.moments.map((m, i) => {
    const visible = (momentState.comp === "all" || m.comp === momentState.comp) &&
                    (momentState.type === "all" || m.type === momentState.type);
    return `
      <button class="mcard ${visible ? "" : "is-hidden"}" data-id="${m.id}" style="animation-delay:${(i % 6) * 70}ms" aria-label="查看：${m.title}">
        <span class="mcard-media"><img src="${m.img}" alt="${m.title}" loading="lazy"></span>
        <span class="mcard-caption">
          <span class="mcard-date">${m.date}</span>
          <span class="mcard-title">${m.title}</span>
          <span class="mcard-tags">${momentTags(m)}</span>
        </span>
      </button>`;
  }).join("");

  $$(".mcard", masonry).forEach((card) => {
    card.addEventListener("click", () => openModal(card.dataset.id));
  });
}

function initMomentFilters() {
  $$(".chips[data-filter-group]", document).forEach((group) => {
    const kind = group.dataset.filterGroup;
    $$(".chip", group).forEach((chip) => {
      chip.addEventListener("click", () => {
        $$(".chip", group).forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        if (kind === "moments") momentState.comp = chip.dataset.filter;
        else momentState.type = chip.dataset.filter;
        renderGallery();
      });
    });
  });
}

/* ---------------- 弹窗 ---------------- */
const modal = $("#modal");
let lastFocused = null;

function openModal(id) {
  const m = CR7.moments.find((x) => x.id === id);
  if (!m) return;
  lastFocused = document.activeElement;
  $("#modalImg").src = m.img;
  $("#modalImg").alt = m.title;
  $("#modalCaption").textContent = m.credit;
  $("#modalMeta").textContent = m.date + " · " + m.title;
  $("#modalTitle").textContent = m.title;
  $("#modalText").textContent = m.story;
  const source = CREDITS[m.id] || "https://commons.wikimedia.org";
  $("#modalSource").href = source;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  $(".modal-close", modal).focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
  if (lastFocused) lastFocused.focus();
}

$$("[data-close-modal]").forEach((el) => el.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
  if (modal.hidden) return;
  if (e.key === "Tab") {
    const focusables = $$("button, a", modal).filter((el) => !el.hidden);
    const first = focusables[0];
    const lastEl = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  }
});

/* ---------------- 荣誉墙 ---------------- */
function renderHonors() {
  const groups = [
    { title: "团队冠军 · 34 座", items: CR7.honors.team },
    { title: "个人荣誉 · 16 项", items: CR7.honors.individual }
  ];
  $("#honorsGroups").innerHTML = groups.map((g) => `
    <div class="honors-group reveal">
      <h3 class="honors-group-title">${g.title}</h3>
      <div class="honors-grid">
        ${g.items.map((h) => `
          <div class="honor-tile" tabindex="0">
            <span class="honor-icon" aria-hidden="true">${HONOR_ICONS[h.kind] || HONOR_ICONS.cup}</span>
            <span class="honor-name">${h.name}</span>
            <span class="honor-count">× ${h.count.toLocaleString()}</span>
            <span class="honor-detail"><b>${h.years}</b><br>${h.detail}</span>
          </div>`).join("")}
      </div>
    </div>`).join("");
}

/* ---------------- 人物志 ---------------- */
function renderBio() {
  $("#bioPanels").innerHTML = CR7.bio.map((b) => `
    <div class="bio-panel ${b.id === "growth" ? "is-active" : ""}" data-biopanel="${b.id}">
      <div class="bio-grid ${b.flip ? "is-flip" : ""}">
        <figure class="bio-media">
          <img src="${b.img}" alt="${b.title}" loading="lazy">
          <figcaption class="bio-media-cap">${b.cap}</figcaption>
        </figure>
        <div class="bio-prose">
          <p class="section-kicker" style="margin-bottom:10px">${b.kicker}</p>
          <h3>${b.title}</h3>
          ${b.paras.map((p) => `<p class="is-reveal">${p}</p>`).join("")}
        </div>
      </div>
    </div>`).join("");
}

/* ---------------- 回到顶部 ---------------- */
const toTop = $("#toTop");
function updateToTop() {
  const visible = window.scrollY > 640;
  toTop.classList.toggle("is-visible", visible);
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  toTop.style.setProperty("--p", pct.toFixed(1) + "%");
}
toTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
});

/* ---------------- 粒子 ---------------- */
function createParticles(canvas, count = 46) {
  if (prefersReducedMotion) return;
  const ctx = canvas.getContext("2d");
  let raf = 0;
  let running = false;
  let particles = [];

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function spawn() {
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -(0.05 + Math.random() * 0.22),
      a: 0.08 + Math.random() * 0.35,
      tw: Math.random() * Math.PI * 2
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.tw += 0.015;
      if (p.y < -4) { p.y = canvas.height + 4; p.x = Math.random() * canvas.width; }
      if (p.x < -4) p.x = canvas.width + 4;
      if (p.x > canvas.width + 4) p.x = -4;
      const alpha = p.a * (0.55 + 0.45 * Math.sin(p.tw));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(232, 206, 140, " + alpha.toFixed(3) + ")";
      ctx.fill();
    });
    raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !running) {
        running = true;
        resize(); spawn(); frame();
      } else if (!entry.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
  }, { threshold: 0.05 });

  io.observe(canvas);
  window.addEventListener("resize", () => {
    if (running) { resize(); spawn(); }
  });
}

/* ---------------- 首屏视差 ---------------- */
const heroBg = $("#heroBg");
const heroContent = $("#heroContent");
let heroTicking = false;

function heroParallax() {
  if (heroTicking) return;
  heroTicking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    heroBg.style.transform = "translate3d(0, " + y * 0.32 + "px, 0) scale(1.06)";
    heroContent.style.transform = "translateY(" + y * 0.12 + "px)";
    heroContent.style.opacity = Math.max(1 - y / (window.innerHeight * 0.85), 0);
    heroTicking = false;
  });
}

if (!prefersReducedMotion) {
  document.addEventListener("mousemove", (e) => {
    if (window.scrollY > window.innerHeight * 0.6) return;
    const dx = (e.clientX / window.innerWidth - 0.5) * 14;
    const dy = (e.clientY / window.innerHeight - 0.5) * 10;
    heroContent.style.marginLeft = dx + "px";
    heroContent.style.marginTop = dy + "px";
  });
}

/* ---------------- 初始化 ---------------- */
function init() {
  renderTimeline();
  initDataBoard();
  renderGallery();
  initMomentFilters();
  renderHonors();
  renderBio();
  initTabs();
  observeReveals();
  createParticles($("#heroFx"), 52);
  createParticles($("#dataFx"), 40);
  updateNav();
  updateToTop();
  updateTimelineProgress();

  $$(".tl-node").forEach((node) => tlObserver.observe(node));

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateNav();
      updateToTop();
      updateTimelineProgress();
      heroParallax();
      ticking = false;
    });
  }, { passive: true });
}

document.addEventListener("DOMContentLoaded", init);
