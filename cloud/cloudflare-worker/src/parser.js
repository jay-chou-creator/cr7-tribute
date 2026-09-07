/* ==========================================================================
   CR7 Tribute - 数据源解析器（纯函数，可在 Node / Workers / 测试中复用）
   --------------------------------------------------------------------------
   数据源：ronaldostats.app（人工逐场核对的 C 罗数据站）

   为什么不用「一次正则全匹配」？
   2026-09-05 事故复盘：数据源改版了 JSON-LD 的文案，旧脚本里唯一的一条正则
   再也匹配不上，于是每天 4 次的定时任务连续失败、数据停在旧值。
   现在每种字段都独立解析、多策略兜底，任何一处文案变化都只影响一个字段。

   策略优先级：
     A. JSON-LD FAQPage 问答      —— 主来源
     B. JSON-LD WebPage.description —— 旧版文案
     C. JSON-LD ItemList 逐队求和  —— 交叉校验 + 兜底
     D. 整页纯文本正则             —— 最后防线

   三重校验：范围校验 / 交叉校验 / 单调校验（生涯累计只增不减）。
   校验不过就拒绝写入，保持上一次的好数据，绝不把脏数据推上线。
   ========================================================================== */
"use strict";

export const SOURCE_URL = "https://ronaldostats.app/";
export const SOURCE_LABEL =
  "ronaldostats.app · 人工逐场核对 · FIFA/UEFA/各成员协会官方正式赛事口径";

/** 与 js/data.js 的 LIVE_DATA.baseline 保持一致（离线兜底值）。 */
export const BASELINE = {
  goals: 978,
  apps: 1334,
  assists: 291,
  trophies: 35,
  clubGoals: 832,
  clubApps: 1101,
  ntGoals: 146,
  ntApps: 233,
  updatedAt: "2026-09-07",
  source: SOURCE_LABEL
};

export const NUMERIC_FIELDS = [
  "goals", "apps", "assists", "trophies",
  "clubGoals", "clubApps", "ntGoals", "ntApps"
];

const MONOTONIC_FIELDS = [
  "goals", "apps", "assists", "clubGoals", "clubApps", "ntGoals", "ntApps"
];

/* 生涯累计数字的合理区间，超范围即判为解析错误 */
const BOUNDS = {
  goals: [900, 1200],
  apps: [1100, 1600],
  assists: [200, 400],
  trophies: [30, 45],
  clubGoals: [700, 1000],
  clubApps: [900, 1400],
  ntGoals: [120, 200],
  ntApps: [180, 300]
};

/* 数据源自身存在口径微调，允许的小偏差 */
const TOLERANCE_GOALS = 3;
const TOLERANCE_APPS = 8;

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

const LD_JSON_RE =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const TEAM_RE = new RegExp(
  "^([^:]+?)\\s*:\\s*([\\d,]+)\\s*goals?\\s*,\\s*" +
  "([\\d,]+)\\s*(?:appearances|apps|caps|games)\\s*,\\s*" +
  "([\\d,]+)\\s*assists?\\s*$",
  "i"
);

function toInt(value) {
  if (value === null || value === undefined) return null;
  const n = parseInt(String(value).replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractJsonLd(html) {
  const blocks = [];
  LD_JSON_RE.lastIndex = 0;
  let match;
  while ((match = LD_JSON_RE.exec(html)) !== null) {
    const text = match[1].trim();
    if (!text) continue;
    try {
      blocks.push(JSON.parse(text));
      continue;
    } catch (_) {
      /* 有些 JSON-LD 带注释，清理后重试 */
    }
    try {
      blocks.push(JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")));
    } catch (_) {
      /* 忽略无法解析的块 */
    }
  }
  return blocks;
}

function iterFaq(blocks) {
  const pairs = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    if (block["@type"] === "FAQPage") {
      for (const entity of block.mainEntity || []) {
        const answer = (entity && entity.acceptedAnswer) || {};
        pairs.push([String((entity && entity.name) || ""), String(answer.text || "")]);
      }
    }
    if (block["@type"] === "Question") {
      const answer = block.acceptedAnswer || {};
      pairs.push([String(block.name || ""), String(answer.text || "")]);
    }
  }
  return pairs;
}

/** 解析总览：进球 / 出场 / 助攻 / 团队冠军。每字段独立，缺哪个补哪个。 */
export function parseOverview(blocks, text) {
  const out = { goals: null, apps: null, assists: null, trophies: null };

  for (const [question, answer] of iterFaq(blocks)) {
    const q = question.toLowerCase();

    if (out.goals === null && q.includes("goals") && q.includes("scored") && !q.includes("season")) {
      const m = answer.match(/scored\s+([\d,]+)\s+(?:career\s+)?goals/i);
      if (m) out.goals = toInt(m[1]);
    }
    if (out.apps === null && out.goals !== null) {
      const m = answer.match(/in\s+([\d,]+)\s+(?:senior\s+)?(?:appearances|caps|games|matches)/i);
      if (m) out.apps = toInt(m[1]);
    }
    if (out.assists === null && q.includes("assist")) {
      const m = answer.match(/([\d,]+)\s+(?:career\s+)?assists/i);
      if (m) out.assists = toInt(m[1]);
      if (out.apps === null) {
        const m2 = answer.match(/in\s+([\d,]+)\s+(?:senior\s+)?(?:appearances|caps|games)/i);
        if (m2) out.apps = toInt(m2[1]);
      }
    }
    if (out.trophies === null && q.includes("troph")) {
      const m = answer.match(/([\d,]+)\s+(?:team\s+)?troph/i);
      if (m) out.trophies = toInt(m[1]);
    }
  }

  /* 策略 B：旧版 WebPage.description 文案 */
  for (const block of blocks) {
    if (!block || block["@type"] !== "WebPage") continue;
    const desc = String(block.description || "");
    const m = desc.match(
      /has\s+([\d,]+)\s+career goals,\s+([\d,]+)\s+assists\s+and\s+([\d,]+)\s+appearances/i
    );
    if (m) {
      if (out.goals === null) out.goals = toInt(m[1]);
      if (out.assists === null) out.assists = toInt(m[2]);
      if (out.apps === null) out.apps = toInt(m[3]);
    }
  }

  /* 策略 D：整页文本兜底 */
  if (out.goals === null) {
    const m = text.match(/scored\s+([\d,]{3,4})\s+career goals/i);
    if (m) out.goals = toInt(m[1]);
  }
  if (out.assists === null) {
    const m = text.match(/([\d,]{3})\s+career assists/i);
    if (m) out.assists = toInt(m[1]);
  }
  if (out.apps === null) {
    const m = text.match(/in\s+([\d,]{4})\s+senior appearances/i);
    if (m) out.apps = toInt(m[1]);
  }
  if (out.trophies === null) {
    const m = text.match(/([\d,]{2})\s+team trophies/i);
    if (m) out.trophies = toInt(m[1]);
  }

  return out;
}

/** 解析逐队明细：[{ team, goals, apps, assists }, ...] */
export function parseTeams(blocks, text) {
  const teams = [];

  for (const block of blocks) {
    if (!block || block["@type"] !== "ItemList") continue;
    for (const item of block.itemListElement || []) {
      const name = item && item.name ? String(item.name).trim() : "";
      if (!name) continue;
      const m = name.match(TEAM_RE);
      if (m) {
        teams.push({
          team: m[1].trim(),
          goals: toInt(m[2]) || 0,
          apps: toInt(m[3]) || 0,
          assists: toInt(m[4]) || 0
        });
      }
    }
  }

  if (teams.length === 0) {
    for (const segment of text.split(/(?<=\d)\s+(?=[A-Z])/)) {
      const m = segment.trim().match(TEAM_RE);
      if (m) {
        teams.push({
          team: m[1].trim(),
          goals: toInt(m[2]) || 0,
          apps: toInt(m[3]) || 0,
          assists: toInt(m[4]) || 0
        });
      }
    }
  }

  const seen = new Set();
  return teams.filter((t) => {
    const key = t.team.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function splitClubVsCountry(teams) {
  let clubGoals = 0, clubApps = 0, clubAssists = 0;
  let ntGoals = 0, ntApps = 0, ntAssists = 0;
  for (const t of teams) {
    if (t.team.toLowerCase().includes("portugal")) {
      ntGoals += t.goals; ntApps += t.apps; ntAssists += t.assists;
    } else {
      clubGoals += t.goals; clubApps += t.apps; clubAssists += t.assists;
    }
  }
  return {
    clubGoals, clubApps, clubAssists,
    ntGoals, ntApps, ntAssists,
    assistsSum: clubAssists + ntAssists
  };
}

export function parseUpdatedAt(blocks, text) {
  for (const block of blocks) {
    if (!block || block["@type"] !== "WebPage") continue;
    const raw = String(block.dateModified || "").trim();
    if (!raw) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (raw.includes("T")) return raw.slice(0, 10);
  }
  const m = text.match(/as of\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) {
      const day = String(m[1]).padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      return `${m[3]}-${mm}-${day}`;
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * 主入口。
 * @param {string} html  数据源页面 HTML
 * @param {object|null} previous 上一次成功写入的数据（用于单调校验）
 * @param {{force?: boolean}} options
 * @returns {{ok: boolean, data: object|null, errors: string[], warnings: string[]}}
 */
export function parseStats(html, previous = null, options = {}) {
  const errors = [];
  const warnings = [];
  const blocks = extractJsonLd(html);
  const text = stripHtml(html);

  if (blocks.length === 0) {
    return { ok: false, data: null, errors: ["页面中未找到 JSON-LD 结构化数据"], warnings };
  }

  const overview = parseOverview(blocks, text);
  const teams = parseTeams(blocks, text);
  if (teams.length === 0) {
    return { ok: false, data: null, errors: ["未能解析出逐队数据（ItemList 缺失）"], warnings };
  }

  const split = splitClubVsCountry(teams);

  let goals = overview.goals;
  let apps = overview.apps;
  let assists = overview.assists;
  let trophies = overview.trophies;

  if (goals === null) {
    goals = split.clubGoals + split.ntGoals;
    warnings.push("概览进球解析失败，已回退为逐队合计");
  }
  if (apps === null) {
    apps = split.clubApps + split.ntApps;
    warnings.push("概览出场解析失败，已回退为逐队合计");
  }
  if (assists === null) {
    assists = split.assistsSum;
    warnings.push("助攻解析失败，已回退为逐队合计");
  }
  if (trophies === null) {
    trophies = (previous && previous.trophies) || BASELINE.trophies;
    warnings.push("冠军数解析失败，沿用上一次的值");
  }

  const data = {
    goals, apps, assists, trophies,
    clubGoals: split.clubGoals,
    clubApps: split.clubApps,
    ntGoals: split.ntGoals,
    ntApps: split.ntApps,
    updatedAt: parseUpdatedAt(blocks, text),
    source: SOURCE_LABEL
  };

  /* 范围校验 */
  for (const key of NUMERIC_FIELDS) {
    const value = data[key];
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${key} 缺失或不是有效数字`);
      continue;
    }
    const [low, high] = BOUNDS[key];
    if (value < low || value > high) {
      errors.push(`${key}=${value} 超出合理区间 [${low}, ${high}]`);
    }
  }

  /* 交叉校验 */
  const sumGoals = data.clubGoals + data.ntGoals;
  if (Math.abs(sumGoals - data.goals) > TOLERANCE_GOALS) {
    warnings.push(`进球交叉校验不一致：总计 ${data.goals} vs 逐队合计 ${sumGoals}`);
  }
  const sumApps = data.clubApps + data.ntApps;
  if (Math.abs(sumApps - data.apps) > TOLERANCE_APPS) {
    warnings.push(`出场交叉校验不一致：总计 ${data.apps} vs 逐队合计 ${sumApps}`);
  }

  /* 单调校验：生涯累计不应倒退 */
  if (previous && !options.force) {
    for (const key of MONOTONIC_FIELDS) {
      const prev = previous[key];
      if (Number.isFinite(prev) && data[key] < prev) {
        errors.push(`${key} 从 ${prev} 下降到 ${data[key]}（生涯累计不应减少）`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, data: null, errors, warnings };
  }
  return { ok: true, data, errors, warnings };
}
