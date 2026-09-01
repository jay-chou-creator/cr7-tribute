#!/usr/bin/env python3
"""
CR7 实时数据抓取脚本
数据源：ronaldostats.app（人工逐场核对的 C 罗数据站）
解析方式：提取页面中的 JSON-LD 结构化数据（schema.org），比解析 HTML 更稳定可靠。
作用：抓取最新数据并生成 data/live-stats.json，供 GitHub Pages 前端读取。
用法：python scripts/fetch-stats.py
退出码：0=成功（数据可能已更新或无变化），1=抓取/解析失败
"""

import json
import re
import sys
import os
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("[ERROR] 需要 requests 库：pip install requests", file=sys.stderr)
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("[ERROR] 需要 beautifulsoup4 库：pip install beautifulsoup4", file=sys.stderr)
    sys.exit(1)

SOURCE_URL = "https://ronaldostats.app/"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "live-stats.json")
HEADERS = {
    "User-Agent": "CR7-Tribute-LiveData/1.0 (+https://github.com/jay-chou-creator/cr7-tribute)"
}

# 团队冠军数（ronaldostats.app 不追踪此项，保持网站基准数据）
TROPHIES = 34


def fetch_html(url: str) -> str:
    """获取页面 HTML，失败则抛出异常。"""
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def extract_jsonld(soup: BeautifulSoup) -> list:
    """从页面中提取所有 JSON-LD script 标签的内容。"""
    scripts = soup.find_all("script", type="application/ld+json")
    results = []
    for s in scripts:
        text = s.string or ""
        text = text.strip()
        if not text:
            continue
        try:
            data = json.loads(text)
            results.append(data)
        except json.JSONDecodeError:
            # 有些 JSON-LD 可能包含注释或非标准格式，尝试清理
            try:
                cleaned = re.sub(r'//.*?$', '', text, flags=re.MULTILINE)
                data = json.loads(cleaned)
                results.append(data)
            except json.JSONDecodeError:
                continue
    return results


def parse_overview_from_jsonld(jsonld_list: list) -> dict:
    """
    从 JSON-LD 中解析总览数据（进球、出场、助攻）。
    优先从 WebPage 的 description 字段提取，兜底从 FAQPage 提取。
    """
    # 模式1：WebPage description: "Cristiano Ronaldo has 978 career goals, 291 assists and 1,333 appearances..."
    for data in jsonld_list:
        if isinstance(data, dict) and data.get("@type") == "WebPage":
            desc = data.get("description", "")
            m = re.search(
                r"has\s+([\d,]+)\s+career goals,\s+([\d,]+)\s+assists\s+and\s+([\d,]+)\s+appearances",
                desc, re.IGNORECASE
            )
            if m:
                return {
                    "goals": int(m.group(1).replace(",", "")),
                    "assists": int(m.group(2).replace(",", "")),
                    "apps": int(m.group(3).replace(",", "")),
                }

    # 模式2：FAQPage 的 answer 文本: "Cristiano Ronaldo has scored 978 career goals in 1,333 senior appearances... with 291 assists."
    for data in jsonld_list:
        if isinstance(data, dict) and data.get("@type") == "FAQPage":
            for entity in data.get("mainEntity", []):
                answer = entity.get("acceptedAnswer", {}).get("text", "")
                m = re.search(
                    r"has scored\s+([\d,]+)\s+goals in\s+([\d,]+)\s+senior appearances.*?with\s+([\d,]+)\s+assists",
                    answer, re.IGNORECASE | re.DOTALL
                )
                if m:
                    return {
                        "goals": int(m.group(1).replace(",", "")),
                        "apps": int(m.group(2).replace(",", "")),
                        "assists": int(m.group(3).replace(",", "")),
                    }

    raise ValueError("无法从 JSON-LD 中解析总览数据（goals/apps/assists）")


def parse_club_data_from_jsonld(jsonld_list: list) -> dict:
    """
    从 JSON-LD 的 ItemList 中解析各俱乐部/国家队数据。
    ItemList 的 itemListElement 格式：
    { "position": 1, "name": "Real Madrid: 450 goals, 438 appearances, 131 assists" }
    """
    club_goals = 0
    club_apps = 0
    nt_goals = 0
    nt_apps = 0
    found_items = []

    for data in jsonld_list:
        if isinstance(data, dict) and data.get("@type") == "ItemList":
            for item in data.get("itemListElement", []):
                name = item.get("name", "")
                # 格式："Real Madrid: 450 goals, 438 appearances, 131 assists"
                m = re.match(
                    r"(.+?):\s+([\d,]+)\s+goals,\s+([\d,]+)\s+appearances,\s+([\d,]+)\s+assists",
                    name, re.IGNORECASE
                )
                if m:
                    team = m.group(1).strip()
                    goals = int(m.group(2).replace(",", ""))
                    apps = int(m.group(3).replace(",", ""))
                    assists = int(m.group(4).replace(",", ""))
                    found_items.append((team, goals, apps, assists))

                    if "portugal" in team.lower():
                        nt_goals = goals
                        nt_apps = apps
                    else:
                        club_goals += goals
                        club_apps += apps

    if not found_items:
        raise ValueError("未能从 JSON-LD ItemList 中解析出俱乐部数据")

    print(f"[INFO] 解析到 {len(found_items)} 支球队：")
    for team, goals, apps, assists in found_items:
        print(f"       {team}: {goals}球 / {apps}场 / {assists}助攻")

    return {
        "clubGoals": club_goals,
        "clubApps": club_apps,
        "ntGoals": nt_goals,
        "ntApps": nt_apps,
    }


def parse_updated_date(jsonld_list: list) -> str:
    """从 JSON-LD 的 WebPage.dateModified 字段获取数据更新日期。"""
    for data in jsonld_list:
        if isinstance(data, dict) and data.get("@type") == "WebPage":
            date_modified = data.get("dateModified", "")
            if date_modified:
                try:
                    # 格式可能是 "2026-08-28" 或 ISO 格式
                    if "T" in date_modified:
                        dt = datetime.fromisoformat(date_modified.replace("Z", "+00:00"))
                    else:
                        dt = datetime.strptime(date_modified, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                except (ValueError, TypeError):
                    pass

    # 兜底：从 description 中提取 "as of 28 August 2026"
    for data in jsonld_list:
        if isinstance(data, dict) and data.get("@type") == "WebPage":
            desc = data.get("description", "")
            m = re.search(r"as of\s+(\d{1,2})\s+(\w+)\s+(\d{4})", desc, re.IGNORECASE)
            if m:
                day, month_str, year = m.groups()
                months = {
                    "january": 1, "february": 2, "march": 3, "april": 4,
                    "may": 5, "june": 6, "july": 7, "august": 8,
                    "september": 9, "october": 10, "november": 11, "december": 12
                }
                month = months.get(month_str.lower(), 1)
                try:
                    dt = datetime(int(year), month, int(day), tzinfo=timezone.utc)
                    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                except ValueError:
                    pass

    # 最终兜底：用当前时间
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    print(f"[INFO] 正在抓取 {SOURCE_URL} ...")

    try:
        html = fetch_html(SOURCE_URL)
    except Exception as e:
        print(f"[ERROR] 页面获取失败：{e}", file=sys.stderr)
        sys.exit(1)

    soup = BeautifulSoup(html, "html.parser")
    jsonld_list = extract_jsonld(soup)
    print(f"[INFO] 找到 {len(jsonld_list)} 个 JSON-LD 数据块")

    if not jsonld_list:
        print("[ERROR] 页面中未找到 JSON-LD 结构化数据", file=sys.stderr)
        sys.exit(1)

    # 解析总览数据
    try:
        overview = parse_overview_from_jsonld(jsonld_list)
    except ValueError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[INFO] 总览：{overview['goals']} 球 / {overview['apps']} 场 / {overview['assists']} 助攻")

    # 解析俱乐部/国家队数据
    try:
        club_data = parse_club_data_from_jsonld(jsonld_list)
    except ValueError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[INFO] 俱乐部总计：{club_data['clubGoals']} 球 / {club_data['clubApps']} 场")
    print(f"[INFO] 国家队：{club_data['ntGoals']} 球 / {club_data['ntApps']} 场")

    # 交叉校验：俱乐部 + 国家队 应等于总进球/总出场
    total_goals_check = club_data["clubGoals"] + club_data["ntGoals"]
    total_apps_check = club_data["clubApps"] + club_data["ntApps"]

    if abs(total_goals_check - overview["goals"]) > 3:
        print(f"[WARN] 进球交叉校验不一致：总览={overview['goals']}，俱乐部+国家队={total_goals_check}")
    if abs(total_apps_check - overview["apps"]) > 5:
        print(f"[WARN] 出场交叉校验不一致：总览={overview['apps']}，俱乐部+国家队={total_apps_check}")

    # 解析更新日期
    updated_at = parse_updated_date(jsonld_list)
    print(f"[INFO] 数据更新时间：{updated_at}")

    # 组装最终数据（以总览数据为准，俱乐部/国家队数据作为细分）
    result = {
        "goals": overview["goals"],
        "apps": overview["apps"],
        "assists": overview["assists"],
        "trophies": TROPHIES,
        "clubGoals": club_data["clubGoals"],
        "clubApps": club_data["clubApps"],
        "ntGoals": club_data["ntGoals"] if club_data["ntGoals"] > 0 else 146,
        "ntApps": club_data["ntApps"] if club_data["ntApps"] > 0 else 233,
        "updatedAt": updated_at,
        "source": "ronaldostats.app · 人工逐场核对 · FIFA/UEFA/各成员协会官方正式赛事口径"
    }

    # 读取现有数据，判断是否有变化
    output_path = os.path.normpath(OUTPUT_PATH)
    changed = True

    if os.path.exists(output_path):
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
            # 只比较核心数字字段
            core_fields = ["goals", "apps", "assists", "clubGoals", "clubApps", "ntGoals", "ntApps"]
            if all(existing.get(k) == result[k] for k in core_fields):
                changed = False
                print("[INFO] 数据无变化，不更新文件")
        except (json.JSONDecodeError, KeyError):
            pass

    if changed:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"[OK] 数据已更新并写入 {output_path}")
    else:
        print("[OK] 数据已是最新，无需更新")

    # 输出 changed 标记供 GitHub Actions 判断是否需要提交
    print(f"::set-output name=changed::{str(changed).lower()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
