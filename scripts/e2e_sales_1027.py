"""1.4.5(2026-10-27)の直しの確認。python scripts/e2e_sales_1027.py [URL] [--out DIR]
開発サーバー(npx vite --port 5681)を出しておく。headless Edge(channel="msedge")・390x844。共有 Chrome は使わない。
見ること:
 N 看護師: はじめてのホームで「まず必修問題を10問」(必修は8割が基準の一文)。押すと必修問題だけ10問。
   結果に「第115回(無料)の残り」と苦手の科目の増え方。ホームの予想点に必修の点数が先に出て、帯が予想点のすぐ下。
 P 試験日カードの学習の目安: まだ解いていない数・1日の数(切り上げ)が実際の数と合う。買っていない人には完全版の分も。
   押すと購入画面(paywall_from=date-plan)。買った人には完全版の行を出さない。
 R 介護・社会: 10問の結果に無料の残り・苦手の科目の行。数は問題データと記録から数えた値と同じ。
 どの画面にも値段の文字・急がせる言い回しを足していない(購入画面の値段のボタンは前からある物)。console のエラー 0。"""
import datetime
import json
import math
import os
import re
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5681/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "e2e_out", "sales_1027")
for i, a in enumerate(sys.argv):
    if a == "--out":
        OUT = sys.argv[i + 1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUSHY = re.compile(r"今だけ|期間限定|残り\d+(時間|分|日)|あと\d+(時間|分)で|セール|割引|急いで|お早め")
errors, fails, oks = [], [], [0]
walk = {}


def check(cond, msg):
    if cond:
        oks[0] += 1
    else:
        print("NG  " + msg)
        fails.append(msg)


def shot(pg, exam, name, note, full=False):
    w = pg.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1], f"{exam} {name}: 横にはみ出さない {w}")
    d = os.path.join(OUT, exam)
    os.makedirs(d, exist_ok=True)
    pg.screenshot(path=os.path.join(d, name + ".png"), full_page=full)
    walk.setdefault(exam, []).append({"file": name + ".png", "note": note})


def cfg(exam):
    e = json.load(open(os.path.join(ROOT, "exams", exam, "exam.json"), encoding="utf8"))
    qs = json.load(open(os.path.join(ROOT, "exams", exam, "data", "questions.json"), encoding="utf8"))
    return e, qs


def records(pg, key):
    return pg.evaluate("(k) => JSON.parse(localStorage.getItem(`CapacitorStorage.nigatecho.${k}.v1`) || '{\"records\":{}}').records", key)


def attrs(pg):
    return pg.evaluate("() => JSON.parse(localStorage.getItem('nigatecho.mockAttrs') || '{}')")


def answer_all(pg, subjects=None, limit=40):
    """結果が出るまで、1番目から押せるまで選んで答える。subjects があれば問題の科目を記録する"""
    for _ in range(limit):
        if pg.locator(".page.result").count():
            return
        pg.wait_for_selector(".choices .choice, .calc")
        if subjects is not None and pg.locator(".q-subj").count():
            subjects.append(pg.locator(".q-subj").first.inner_text())
        if pg.locator(".calc").count():
            for r in range(pg.locator(".calc-row").count()):
                pg.locator(".calc-row").nth(r).locator(".calc-d").nth(1).click()
        else:
            k = 0
            while pg.locator(".bottom-bar .btn.next").is_disabled() and k < pg.locator(".choices .choice").count():
                pg.locator(".choices .choice").nth(k).click()
                k += 1
        pg.click(".bottom-bar .btn.next")
        pg.wait_for_selector(".explain-page, .verdict")
        pg.click(".bottom-bar .btn.next")
    pg.wait_for_selector(".page.result")


def no_price_added(pg, exam, where):
    t = pg.locator(".page").first.inner_text()
    check("¥" not in t and "円" not in t, f"{exam} {where}: 値段の文字が無い")
    check(not PUSHY.search(t), f"{exam} {where}: 急がせる言い回しが無い")


def open_exam(pg, exam):
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(URL)
    pg.wait_for_selector(".first-pick")
    pg.click(f".first-pick button[data-exam={exam}]")
    pg.wait_for_selector(".home")


def check_plan(pg, exam, e, qs, premium=False):
    key = e["key"]
    rec = records(pg, key)
    today = datetime.date.today()
    days = (datetime.date.fromisoformat(e["examDate"]) - today).days
    free = [q for q in qs if q["exam"] in e["freeExams"] and not q.get("excluded")]
    full = [q for q in qs if not q.get("excluded")]
    un_now = len([q for q in (full if premium else free) if q["id"] not in rec])
    un_full = len([q for q in full if q["id"] not in rec])
    pg.evaluate("() => document.querySelector('[data-plan]')?.scrollIntoView({block: 'center'})")
    check(pg.locator("[data-plan]").count() == 1, f"{exam}: 試験日カードに学習の目安")
    t = pg.locator("[data-plan]").inner_text() if pg.locator("[data-plan]").count() else ""
    check(f"まだ解いていない {un_now}問" in t and f"1日 {math.ceil(un_now / days)}問で1周" in t,
          f"{exam}: 目安の数が合う(残り {un_now}問・{days}日 → 1日 {math.ceil(un_now / days)}問) [{t}]")
    if premium:
        check(pg.locator("[data-upsell=date-plan]").count() == 0, f"{exam}: 買った人には完全版の目安を出さない")
    else:
        check(f"完全版の {un_full}問なら" in t and f"1日 {math.ceil(un_full / days)}問で1周" in t,
              f"{exam}: 完全版の目安の数が合う({un_full}問 → 1日 {math.ceil(un_full / days)}問) [{t}]")
    check("¥" not in t and "円" not in t and not PUSHY.search(t), f"{exam}: 目安に値段・急がせる文が無い")
    return un_now, un_full, days


def check_result_progress(pg, exam, e, qs):
    rec = records(pg, e["key"])
    free = [q for q in qs if q["exam"] in e["freeExams"] and not q.get("excluded")]
    left = len([q for q in free if q["id"] not in rec])
    check(pg.locator("[data-upsell=result-progress]").count() == 1, f"{exam}: 結果に無料の残りと苦手の科目の行")
    t = pg.locator("[data-upsell=result-progress]").inner_text() if pg.locator("[data-upsell=result-progress]").count() else ""
    check(f"あと {left}問" in t, f"{exam}: 無料の残りが合う(あと {left}問) [{t}]")
    m = re.search(r"(苦手の多い|正答率の低い) (\S+)\s+(\d+)問 → 完全版 (\d+)問", t)
    check(m is not None, f"{exam}: 苦手の科目の増え方の行 [{t}]")
    if m:
        short = {v: k for k, v in e.get("short", {}).items()}
        subj = short.get(m.group(2), m.group(2))
        now_n = len([q for q in free if q["subject"] == subj])
        full_n = len([q for q in qs if q["subject"] == subj and not q.get("excluded")])
        check((int(m.group(3)), int(m.group(4))) == (now_n, full_n), f"{exam}: {subj} の数が問題データと合う {now_n}→{full_n} [{m.group(0)}]")
    check(pg.locator(".paywall").count() == 0, f"{exam}: 結果で購入画面は勝手に開かない")


def run_nurse(pg):
    exam = "nurse"
    e, qs = cfg(exam)
    open_exam(pg, exam)
    check(pg.locator("[data-home=sub-first]").count() == 1, "nurse: はじめてのホームに「まず必修問題を10問」")
    t = pg.locator(".hero-first").inner_text()
    check("必修問題は8割が基準" in t, f"nurse: 8割の基準の一文 [{t}]")
    check(pg.locator(".hero-first").inner_text().count("10問") >= 2, "nurse: ランダムの10問も選べる")
    no_price_added(pg, exam, "はじめてのホーム")
    shot(pg, exam, "01_home_first", "看護師のはじめてのホーム: まず必修問題を10問")
    pg.click("[data-home=sub-first]")
    pg.wait_for_selector(".choices .choice")
    check("必修問題 10問" in pg.locator(".topbar h1").inner_text(), "nurse: 題名が「必修問題 10問」")
    shot(pg, exam, "02_quiz_sub", "必修問題の1問目")
    subs = []
    answer_all(pg, subs)
    check(len(subs) == 10 and all("必修" in s for s in subs), f"nurse: 10問とも必修問題 {subs}")
    pg.evaluate("() => document.querySelector('[data-upsell=result]').scrollIntoView({block: 'center'})")
    check_result_progress(pg, exam, e, qs)
    no_price_added(pg, exam, "必修10問の結果")
    shot(pg, exam, "03_result_sub", "必修10問の結果: 無料の残り・苦手の科目の増え方・鍵の回の1問")
    pg.click(".topbar [aria-label='閉じる']")
    pg.wait_for_selector(".home")
    check(pg.locator("[data-forecast=sub-first]").count() == 1, "nurse: 10問で必修の点数が予想点に出る")
    ft = pg.locator(".forecast").inner_text()
    rec = records(pg, e["key"])
    seen_sub = [q for q in qs if q["subject"] == "必修問題" and q["id"] in rec]
    ok = len([q for q in seen_sub if rec[q["id"]]["streak"] > 0])
    latest = max(q["exam"] for q in qs)
    total = len([q for q in qs if q["exam"] == latest and q["subject"] == "必修問題" and not q.get("excluded")])
    score = round(total * ok / len(seen_sub))
    check(f"{score}/ {total}点" in ft.replace("\n", "") or f"{score}\n/ {total}点" in ft, f"nurse: 必修の点数が記録と合う({score}/{total}) [{ft[:80]}]")
    check(f"{math.ceil(total * 0.8)}" in ft, "nurse: 基準の目安(8割)")
    check(pg.evaluate("() => { const f = document.querySelector('.forecast'); return !!f && f.nextElementSibling?.matches('[data-upsell=home-raised]'); }"), "nurse: 必修10問で帯が予想点のすぐ下")
    pg.evaluate("() => document.querySelector('.forecast').scrollIntoView({block: 'start'})")
    shot(pg, exam, "04_home_forecast_sub", "必修10問のあとのホーム: 必修の点数と完全版の帯")
    check_plan(pg, exam, e, qs)
    shot(pg, exam, "05_home_plan", "試験日カードの学習の目安")
    pg.click("[data-upsell=date-plan]")
    pg.wait_for_selector(".paywall")
    check(attrs(pg).get("paywall_from") == "date-plan", f"nurse: 目安から開くと paywall_from=date-plan {attrs(pg)}")
    shot(pg, exam, "06_paywall_from_plan", "目安から開いた購入画面")
    # 買った人
    pg.click(".pw-cta .btn.primary")
    pg.wait_for_selector(".home")
    check(pg.locator("[data-upsell^=home-]").count() == 0, "nurse: 買った人のホームに帯が無い")
    check_plan(pg, exam, e, qs, premium=True)
    shot(pg, exam, "07_home_plan_premium", "買った人の学習の目安(完全版の行なし)")


def run_random(pg, exam):
    e, qs = cfg(exam)
    open_exam(pg, exam)
    check(pg.locator("[data-home=sub-first]").count() == 0, f"{exam}: 必修の入口は看護師だけ")
    check(pg.locator("[data-plan]").count() == 0, f"{exam}: 1問も解く前は目安を出さない")
    pg.click("text=まず10問解いてみる")
    answer_all(pg)
    pg.evaluate("() => document.querySelector('[data-upsell=result]').scrollIntoView({block: 'center'})")
    check_result_progress(pg, exam, e, qs)
    no_price_added(pg, exam, "10問の結果")
    shot(pg, exam, "01_result10", "10問の結果: 無料の残り・苦手の科目の増え方")
    pg.click(".topbar [aria-label='閉じる']")
    pg.wait_for_selector(".home")
    check_plan(pg, exam, e, qs)
    no_price_added(pg, exam, "ホーム")
    shot(pg, exam, "02_home_plan", "試験日カードの学習の目安")


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    for name, fn in [("nurse", run_nurse), ("kaigo", lambda pg: run_random(pg, "kaigo")), ("shakai", lambda pg: run_random(pg, "shakai"))]:
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg = ctx.new_page()
        pg.on("console", lambda m: errors.append(f"{m.text} {m.location}") if m.type == "error" and "favicon.ico" not in str(m.location) else None)
        fn(pg)
        print(name, "done")
        ctx.close()
    b.close()

os.makedirs(OUT, exist_ok=True)
json.dump(walk, open(os.path.join(OUT, "walk.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
check(not errors, f"console のエラー 0: {errors[:5]}")
print(f"OK {oks[0]} / NG {len(fails)}")
sys.exit(1 if fails else 0)
