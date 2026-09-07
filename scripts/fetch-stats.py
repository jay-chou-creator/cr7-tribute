#!/usr/bin/env python3
"""
CR7 实时数据抓取脚本（Cloudflare / GitHub Actions 通用）

数据源：ronaldostats.app（人工逐场核对的 C 罗数据站）
输出：data/live-stats.json，供前端 /api/cr7-stats 与静态兜底读取

设计原则
--------
1. 零第三方依赖：只用标准库（urllib + re + json），避免 CI 里 pip 安装失败。
2. 多策略解析：数据源改版文案时，只要还有一处能读出数字就不会整体崩掉。
   策略 A：JSON-LD FAQPage（主）
   策略 B：JSON-LD WebPage.description（旧版文案）
   策略 C：JSON-LD ItemList 逐队求和（交叉校验 / 兜底）
   策略 D：整页纯文本正则（最后兜底）
3. 三重校验：范围校验 + 交叉校验（俱乐部+国家队≈总计）+ 单调校验（生涯累计只增不减）。
   任一校验不过就拒绝写入，保持上一次的好数据，绝不把脏数据推上线。

用法
----
    python scripts/fetch-stats.py                 # 正常抓取并写入
    python scripts/fetch-stats.py --dry-run       # 只打印，不写文件
    python scripts/fetch-stats.py --force         # 忽略「只增不减」校验（人工纠错时用）
    python scripts/fetch-stats.py --quiet         # 安静模式（CI 用）

退出码：0 = 成功（含无变化）；1 = 抓取或解析失败（CI 会标红并触发邮件告警）
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

SOURCE_URL = os.environ.get("CR7_SOURCE_URL", "https://ronaldostats.app/")
OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "data", "live-stats.json")
)
SOURCE_LABEL = "ronaldostats.app · 人工逐场核对 · FIFA/UEFA/各成员协会官方正式赛事口径"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; CR7-Tribute-LiveData/2.0; "
        "+https://github.com/jay-chou-creator/cr7-tribute)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
}

TIMEOUT_SECONDS = 30
RETRIES = 3

# 生涯累计数字的合理区间。超出即判定为解析错误，拒绝写入。
# （C 罗 2026 年 41 岁，进球 900+ 且仍在增长，上界留足余量）
BOUNDS = {
    "goals": (900, 1200),
    "apps": (1100, 1600),
    "assists": (200, 400),
    "trophies": (30, 45),
    "clubGoals": (700, 1000),
    "clubApps": (900, 1400),
    "ntGoals": (120, 200),
    "ntApps": (180, 300),
}

# 俱乐部 + 国家队 与总计之间的允许偏差（数据源自身存在口径微调）
TOLERANCE_GOALS = 3
TOLERANCE_APPS = 8

# 生涯累计量，正常情况下永远不会下降
MONOTONIC_FIELDS = ("goals", "apps", "assists", "clubGoals", "clubApps", "ntGoals", "ntApps")

NUMERIC_FIELDS = (
    "goals", "apps", "assists", "trophies",
    "clubGoals", "clubApps", "ntGoals", "ntApps",
)

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def log(msg: str, quiet: bool = False) -> None:
    if not quiet:
        print(msg)


def warn(msg: str) -> None:
    print(f"[WARN] {msg}", file=sys.stderr)


# --------------------------------------------------------------------------- #
# 抓取
# --------------------------------------------------------------------------- #
def fetch_html(url: str, quiet: bool = False) -> str:
    """带重试地抓取页面 HTML。"""
    last_err: Exception | None = None
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.read().decode(charset, errors="replace")
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as err:
            last_err = err
            log(f"[INFO] 第 {attempt}/{RETRIES} 次抓取失败：{err}", quiet)
            if attempt < RETRIES:
                import time

                time.sleep(2 * attempt)
    raise RuntimeError(f"页面抓取失败：{last_err}")


# --------------------------------------------------------------------------- #
# JSON-LD 提取
# --------------------------------------------------------------------------- #
LD_JSON_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)


def extract_jsonld(html: str) -> list:
    """提取页面中所有 JSON-LD 数据块，容错处理注释与尾随逗号。"""
    results = []
    for raw in LD_JSON_RE.findall(html):
        text = raw.strip()
        if not text:
            continue
        for candidate in (text, re.sub(r"^\s*//.*?$", "", text, flags=re.MULTILINE)):
            try:
                results.append(json.loads(candidate))
                break
            except json.JSONDecodeError:
                continue
    return results


def iter_faq(items: list) -> list[tuple[str, str]]:
    """把 FAQPage 拉平成 [(question, answer), ...]。"""
    pairs: list[tuple[str, str]] = []
    for block in items:
        if not isinstance(block, dict):
            continue
        if block.get("@type") == "FAQPage":
            for entity in block.get("mainEntity", []) or []:
                answer = entity.get("acceptedAnswer", {}) or {}
                pairs.append((str(entity.get("name", "")), str(answer.get("text", ""))))
        # 有些站点把 Question 直接平铺
        if block.get("@type") == "Question":
            answer = block.get("acceptedAnswer", {}) or {}
            pairs.append((str(block.get("name", "")), str(answer.get("text", ""))))
    return pairs


def to_int(text: str) -> int | None:
    try:
        return int(str(text).replace(",", "").replace(" ", "").strip())
    except (ValueError, AttributeError):
        return None


# --------------------------------------------------------------------------- #
# 解析：概览（总进球 / 总出场 / 助攻 / 冠军）
# --------------------------------------------------------------------------- #
def parse_overview(jsonld: list, text: str) -> dict:
    """
    返回 {"goals": int|None, "apps": int|None, "assists": int|None, "trophies": int|None}
    每种字段独立解析，缺哪个补哪个，互不牵连。
    """
    out = {"goals": None, "apps": None, "assists": None, "trophies": None}
    faq = iter_faq(jsonld)

    # --- 策略 A：FAQPage 问答 -------------------------------------------------
    for question, answer in faq:
        q = question.lower()

        # "has scored 978 career goals in 1,334 senior appearances"
        if out["goals"] is None and ("goals" in q and "scored" in q and "season" not in q):
            m = re.search(
                r"scored\s+([\d,]+)\s+(?:career\s+)?goals", answer, re.IGNORECASE
            )
            if m:
                out["goals"] = to_int(m.group(1))
        if out["apps"] is None:
            m = re.search(
                r"in\s+([\d,]+)\s+(?:senior\s+)?(?:appearances|caps|games|matches)",
                answer, re.IGNORECASE,
            )
            if m and out["goals"] is not None:
                out["apps"] = to_int(m.group(1))

        # "Cristiano Ronaldo has 291 career assists in 1,334 appearances"
        if out["assists"] is None and "assist" in q:
            m = re.search(r"([\d,]+)\s+(?:career\s+)?assists", answer, re.IGNORECASE)
            if m:
                out["assists"] = to_int(m.group(1))
            if out["apps"] is None:
                m2 = re.search(
                    r"in\s+([\d,]+)\s+(?:senior\s+)?(?:appearances|caps|games)",
                    answer, re.IGNORECASE,
                )
                if m2:
                    out["apps"] = to_int(m2.group(1))

        # "has won 35 team trophies"
        if out["trophies"] is None and "troph" in q:
            m = re.search(r"([\d,]+)\s+(?:team\s+)?troph", answer, re.IGNORECASE)
            if m:
                out["trophies"] = to_int(m.group(1))

    # --- 策略 B：WebPage.description 旧版文案 ---------------------------------
    for block in jsonld:
        if not isinstance(block, dict) or block.get("@type") != "WebPage":
            continue
        desc = str(block.get("description", ""))
        m = re.search(
            r"has\s+([\d,]+)\s+career goals,\s+([\d,]+)\s+assists\s+and\s+([\d,]+)\s+appearances",
            desc, re.IGNORECASE,
        )
        if m:
            out["goals"] = out["goals"] or to_int(m.group(1))
            out["assists"] = out["assists"] or to_int(m.group(2))
            out["apps"] = out["apps"] or to_int(m.group(3))

    # --- 策略 D：整页文本正则兜底 ---------------------------------------------
    if out["goals"] is None:
        m = re.search(r"scored\s+([\d,]{3,4})\s+career goals", text, re.IGNORECASE)
        if m:
            out["goals"] = to_int(m.group(1))
    if out["assists"] is None:
        m = re.search(r"([\d,]{3})\s+career assists", text, re.IGNORECASE)
        if m:
            out["assists"] = to_int(m.group(1))
    if out["apps"] is None:
        m = re.search(r"in\s+([\d,]{4})\s+senior appearances", text, re.IGNORECASE)
        if m:
            out["apps"] = to_int(m.group(1))

    return out


# --------------------------------------------------------------------------- #
# 解析：逐队明细
# --------------------------------------------------------------------------- #
TEAM_RE = re.compile(
    r"^(?P<team>.+?)\s*:\s*(?P<goals>[\d,]+)\s*goals?\s*,\s*"
    r"(?P<apps>[\d,]+)\s*(?:appearances|apps|caps|games)\s*,\s*"
    r"(?P<assists>[\d,]+)\s*assists?\s*$",
    re.IGNORECASE,
)


def parse_teams(jsonld: list, text: str) -> list[tuple[str, int, int, int]]:
    """返回 [(球队名, 进球, 出场, 助攻), ...]。"""
    teams: list[tuple[str, int, int, int]] = []

    for block in jsonld:
        if not isinstance(block, dict) or block.get("@type") != "ItemList":
            continue
        for item in block.get("itemListElement", []) or []:
            name = item.get("name") if isinstance(item, dict) else None
            if not name:
                continue
            m = TEAM_RE.match(str(name).strip())
            if m:
                teams.append((
                    m.group("team").strip(),
                    to_int(m.group("goals")) or 0,
                    to_int(m.group("apps")) or 0,
                    to_int(m.group("assists")) or 0,
                ))

    if not teams:  # 纯文本兜底
        for m in TEAM_RE.finditer(text):
            teams.append((
                m.group("team").strip(),
                to_int(m.group("goals")) or 0,
                to_int(m.group("apps")) or 0,
                to_int(m.group("assists")) or 0,
            ))

    # 去重（保留首次出现）
    seen = set()
    unique = []
    for t in teams:
        key = t[0].lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(t)
    return unique


def split_club_vs_country(teams: list[tuple[str, int, int, int]]) -> dict:
    club_goals = club_apps = club_assists = 0
    nt_goals = nt_apps = nt_assists = 0
    for team, goals, apps, assists in teams:
        if "portugal" in team.lower():
            nt_goals, nt_apps, nt_assists = goals, apps, assists
        else:
            club_goals += goals
            club_apps += apps
            club_assists += assists
    return {
        "clubGoals": club_goals, "clubApps": club_apps, "clubAssists": club_assists,
        "ntGoals": nt_goals, "ntApps": nt_apps, "ntAssists": nt_assists,
        "assistsSum": club_assists + nt_assists,
    }


# --------------------------------------------------------------------------- #
# 解析：更新日期
# --------------------------------------------------------------------------- #
def parse_updated_at(jsonld: list, text: str) -> str:
    for block in jsonld:
        if isinstance(block, dict) and block.get("@type") == "WebPage":
            raw = str(block.get("dateModified", "")).strip()
            if raw:
                try:
                    if "T" in raw:
                        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                    else:
                        dt = datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                except ValueError:
                    pass

    m = re.search(r"as of\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", text, re.IGNORECASE)
    if m:
        day, month_name, year = m.group(1), m.group(2).lower(), m.group(3)
        month = MONTHS.get(month_name)
        if month:
            try:
                return datetime(int(year), month, int(day), tzinfo=timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
            except ValueError:
                pass

    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --------------------------------------------------------------------------- #
# 校验
# --------------------------------------------------------------------------- #
def validate(data: dict, previous: dict | None, force: bool) -> list[str]:
    """返回问题列表；空列表表示通过。软问题只告警，硬问题拒绝写入。"""
    problems: list[str] = []

    for key in NUMERIC_FIELDS:
        value = data.get(key)
        if not isinstance(value, int):
            problems.append(f"{key} 缺失或不是整数")
            continue
        low, high = BOUNDS[key]
        if not (low <= value <= high):
            problems.append(f"{key}={value} 超出合理区间 [{low}, {high}]")

    if "problems" in problems:  # pragma: no cover - 占位
        return problems

    clubs = (data.get("clubGoals") or 0) + (data.get("ntGoals") or 0)
    if abs(clubs - (data.get("goals") or 0)) > TOLERANCE_GOALS:
        warn(f"进球交叉校验不一致：总计 {data.get('goals')} vs 逐队合计 {clubs}")

    apps = (data.get("clubApps") or 0) + (data.get("ntApps") or 0)
    if abs(apps - (data.get("apps") or 0)) > TOLERANCE_APPS:
        warn(f"出场交叉校验不一致：总计 {data.get('apps')} vs 逐队合计 {apps}")

    if previous and not force:
        for key in MONOTONIC_FIELDS:
            prev = previous.get(key)
            if isinstance(prev, int) and isinstance(data.get(key), int) and data[key] < prev:
                problems.append(
                    f"{key} 从 {prev} 下降到 {data[key]}（生涯累计不应减少；"
                    f"如确为修正，请加 --force）"
                )
    return problems


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def build_payload(jsonld: list, text: str, previous: dict | None) -> dict:
    overview = parse_overview(jsonld, text)
    teams = parse_teams(jsonld, text)

    if not teams:
        raise ValueError("未能解析出逐队数据（ItemList 缺失）")

    split = split_club_vs_country(teams)

    goals = overview["goals"]
    apps = overview["apps"]
    assists = overview["assists"]
    trophies = overview["trophies"]

    # 逐队合计作为兜底：概览解析失败时用合计顶上
    if goals is None:
        goals = split["clubGoals"] + split["ntGoals"]
        warn("概览进球解析失败，已回退为逐队合计")
    if apps is None:
        apps = split["clubApps"] + split["ntApps"]
        warn("概览出场解析失败，已回退为逐队合计")
    if assists is None:
        assists = split["assistsSum"]
        warn("助攻解析失败，已回退为逐队合计")
    if trophies is None and previous:
        trophies = previous.get("trophies", 34)
        warn("冠军数解析失败，沿用上一次的值")
    if trophies is None:
        trophies = 34

    payload = {
        "goals": goals,
        "apps": apps,
        "assists": assists,
        "trophies": trophies,
        "clubGoals": split["clubGoals"],
        "clubApps": split["clubApps"],
        "ntGoals": split["ntGoals"],
        "ntApps": split["ntApps"],
        "updatedAt": parse_updated_at(jsonld, text),
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": SOURCE_LABEL,
    }
    return payload


def load_previous(path: str) -> dict | None:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description="抓取 CR7 生涯最新数据")
    parser.add_argument("--dry-run", action="store_true", help="只打印不写文件")
    parser.add_argument("--force", action="store_true", help="跳过「只增不减」校验")
    parser.add_argument("--quiet", action="store_true", help="安静模式")
    parser.add_argument("--out", default=OUTPUT_PATH, help="输出文件路径")
    args = parser.parse_args()

    quiet = args.quiet

    try:
        html = fetch_html(SOURCE_URL, quiet)
    except RuntimeError as err:
        print(f"[ERROR] {err}", file=sys.stderr)
        return 1

    # 用于兜底正则的纯文本（去掉标签，压缩空白）
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)

    jsonld = extract_jsonld(html)
    log(f"[INFO] 找到 {len(jsonld)} 个 JSON-LD 数据块", quiet)
    if not jsonld:
        print("[ERROR] 页面中未找到 JSON-LD 结构化数据", file=sys.stderr)
        return 1

    previous = load_previous(args.out)

    try:
        payload = build_payload(jsonld, text, previous)
    except ValueError as err:
        print(f"[ERROR] {err}", file=sys.stderr)
        return 1

    log(
        "[INFO] 解析结果：{goals} 球 / {apps} 场 / {assists} 助攻 / {trophies} 冠".format(**payload),
        quiet,
    )
    log(
        "[INFO] 俱乐部 {clubGoals} 球 {clubApps} 场 · 国家队 {ntGoals} 球 {ntApps} 场".format(**payload),
        quiet,
    )

    problems = validate(payload, previous, args.force)
    if problems:
        for p in problems:
            print(f"[ERROR] 数据校验未通过：{p}", file=sys.stderr)
        print("[ERROR] 拒绝写入，保持上一次的数据不变", file=sys.stderr)
        return 1

    changed = True
    if previous:
        if all(previous.get(k) == payload[k] for k in NUMERIC_FIELDS) and (
            previous.get("updatedAt") == payload["updatedAt"]
        ):
            changed = False

    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        print(f"[OK] dry-run 完成，changed={str(changed).lower()}")
        github_output(changed)
        return 0

    if changed:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        log(f"[OK] 数据已更新并写入 {args.out}", quiet)
    else:
        # 只刷新抓取时间，不改变展示内容
        payload = dict(previous or {}, fetchedAt=payload["fetchedAt"])
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        log("[OK] 数据无变化", quiet)

    github_output(changed)
    return 0


def github_output(changed: bool) -> None:
    """写出 changed 标记：优先 GITHUB_OUTPUT（新），兼容旧 set-output（已废弃，仅打印）。"""
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        try:
            with open(path, "a", encoding="utf-8") as fh:
                fh.write(f"changed={str(changed).lower()}\n")
            return
        except OSError as err:
            warn(f"写入 GITHUB_OUTPUT 失败：{err}")
    print(f"::set-output name=changed::{str(changed).lower()}")


if __name__ == "__main__":
    sys.exit(main())
