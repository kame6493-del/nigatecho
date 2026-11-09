"""結果のあとの「この試験の続き」(2026-11-09)の確認。python scripts/e2e_after_result_1109.py [URL] [--out DIR]
開発サーバー(npx vite --port 5691)を出しておく。headless Edge(channel="msedge")・390x844。共有 Chrome は使わない。
見ること:
 1 はじめて入れた日: 10問を解いてホームへ戻っても出ない。
 2 戻ってきた人(使い始めが2日前): 10問を解いて「ホームへ戻る」で出る。数(無料の残り・苦手の科目・完全版の範囲と数・試験日まで)が
   問題データと記録から数えた値と同じ。値段の文字・急がせる言い回しが無い。「閉じる」で消える。
 3 同じ日の2回目は出ない。
 4 次の日(出した日を前の日にする): × で出ても出る。「完全版の中身を見る」で購入画面(paywall_from=after-result)。
 5 外(暗い所)を押しても閉じる。
 6 続けて解く(「間違えた問題を復習する」)人には出ない。
 7 今日すでに購入画面を開いた人には出ない。
 8 買った人には出ない。
 9 看護師: 必修問題の行が出る。
 console のエラー 0。"""
import datetime
import json
import math
import os
import re
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5691/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "e2e_out", "after_result_1109")
for i, a in enumerate(sys.argv):
    if a == "--out":
        OUT = sys.argv[i + 1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUSHY = re.compile(r"今だけ|期間限定|残り\d+(時間|分|日)|あと\d+(時間|分)で|セール|割引|急いで|お早め|本日限り")
DAY = 86400000
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


def set_pref(pg, key, patch):
    pg.evaluate("""([k, p]) => {
      const cur = JSON.parse(localStorage.getItem('CapacitorStorage.' + k) || '{}');
      localStorage.setItem('CapacitorStorage.' + k, JSON.stringify({ ...cur, ...p }));
    }""", [key, patch])


def returning(pg, days=2):
    """使い始めを days 日前にする(戻ってきた人)"""
    t = pg.evaluate("() => Date.now()")
    set_pref(pg, "nigatecho.review", {"firstAt": t - days * DAY})


def shown_yesterday(pg):
    t = pg.evaluate("() => Date.now()")
    d = datetime.datetime.fromtimestamp((t - DAY) / 1000).strftime("%Y-%m-%d")
    set_pref(pg, "nigatecho.afterResult", {"shownDay": d})


def answer_all(pg, limit=40):
    for _ in range(limit):
        if pg.locator(".page.result").count():
            return
        pg.wait_for_selector(".choices .choice, .calc")
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


def solve10(pg):
    if pg.locator("text=まず10問解いてみる").count():
        pg.click("text=まず10問解いてみる")
    else:
        pg.click(".quick >> text=ランダム10問")
    answer_all(pg)


def leave(pg, how):
    if how == "home":
        pg.click(".result-actions >> text=ホームへ戻る")
    else:
        pg.click(".topbar [aria-label='閉じる']")
    pg.wait_for_selector(".home")


def sheet_after(pg, expect):
    """案内が出る(expect=True)/出ない を待って確かめる"""
    try:
        pg.wait_for_selector(".after-result", timeout=2500)
        return True
    except Exception:
        return False


def open_exam(pg, exam):
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(URL)
    pg.wait_for_selector(".first-pick")
    pg.click(f".first-pick button[data-exam={exam}]")
    pg.wait_for_selector(".home")


def check_rows(pg, exam, e, qs):
    rec = records(pg, e["key"])
    t = pg.locator(".after-result").inner_text()
    free = [q for q in qs if q["exam"] in e["freeExams"] and not q.get("excluded")]
    left = len([q for q in free if q["id"] not in rec])
    locked = [q for q in qs if q["exam"] not in e["freeExams"]]
    lo, hi = min(q["exam"] for q in locked), max(q["exam"] for q in locked)
    check(f"{e['name']}の続き" in t, f"{exam}: 見出しが「{e['name']}の続き」 [{t[:40]}]")
    check(f"あと {left}問" in t, f"{exam}: 無料の残りが合う(あと {left}問) [{t}]")
    rng = f"第{lo}回" if lo == hi else f"第{lo}〜{hi}回"
    check(f"{rng}({len(locked):,}問)" in t, f"{exam}: 完全版の範囲と数が合う({rng} {len(locked)}問) [{t}]")
    m = re.search(r"(苦手の多い|正答率の低い) (\S+)\s+(\d+)問 → 完全版 (\d+)問", t)
    check(m is not None or (exam == "nurse" and pg.locator("[data-row=sub]").count() == 1), f"{exam}: 苦手の科目の行 [{t}]")
    check(not (m and e.get("subPass") and m.group(2) in [e.get("short", {}).get(x, x) for x in e["subPass"].get("subjects", [])]),
          f"{exam}: 苦手の科目が必修そのものなら、必修の行と2行に分けない [{t}]")
    if m:
        short = {v: k for k, v in e.get("short", {}).items()}
        subj = short.get(m.group(2), m.group(2))
        now_n = len([q for q in free if q["subject"] == subj])
        full_n = len([q for q in qs if q["subject"] == subj and not q.get("excluded")])
        check((int(m.group(3)), int(m.group(4))) == (now_n, full_n), f"{exam}: {subj} の数が問題データと合う {now_n}→{full_n} [{m.group(0)}]")
    days = (datetime.date.fromisoformat(e["examDate"]) - datetime.date.today()).days
    un_full = len([q for q in qs if not q.get("excluded") and q["id"] not in rec])
    if days > 0:
        check(f"試験まで {days}日" in t and f"完全版の残り {un_full:,}問 → 1日 {math.ceil(un_full / days)}問" in t,
              f"{exam}: 試験日までの行が合う({days}日・{un_full}問・1日 {math.ceil(un_full / days)}問) [{t}]")
    check("¥" not in t and "円" not in t and "無料で" not in t.replace("(無料)", ""), f"{exam}: 値段の文字が無い [{t}]")
    check(not PUSHY.search(t), f"{exam}: 急がせる言い回しが無い")
    # 閉じるボタンが見えて、押す所と同じ大きさ
    bc = pg.locator("[data-after-result=close]").bounding_box()
    bo = pg.locator("[data-after-result=open]").bounding_box()
    check(bc and bo and bc["height"] >= 44 and abs(bc["width"] - bo["width"]) < 2, f"{exam}: 閉じるボタンが押す所と同じ大きさ {bc} {bo}")
    check(bc and bc["y"] + bc["height"] <= 844, f"{exam}: 閉じるボタンが画面の中 {bc}")
    return t


def run_kaigo(pg):
    exam = "kaigo"
    e, qs = cfg(exam)
    open_exam(pg, exam)
    # 1 はじめて入れた日
    solve10(pg)
    leave(pg, "home")
    check(not sheet_after(pg, False), "kaigo: はじめて入れた日には出ない")
    shot(pg, exam, "01_first_day_home", "はじめて入れた日: 10問のあとのホーム(案内なし)")
    # 2 戻ってきた人
    returning(pg)
    solve10(pg)
    leave(pg, "home")
    check(sheet_after(pg, True), "kaigo: 戻ってきた人が10問を解いてホームへ戻ると出る")
    if pg.locator(".after-result").count():
        check_rows(pg, exam, e, qs)
        check(pg.locator(".paywall").count() == 0, "kaigo: 購入画面は勝手に開かない")
        shot(pg, exam, "02_after_result_sheet", "戻ってきた人: 10問のあとホームへ戻ったときの「介護福祉士の続き」")
        pg.click("[data-after-result=close]")
        pg.wait_for_timeout(300)
        check(pg.locator(".after-result").count() == 0, "kaigo: 閉じるで消える")
        shot(pg, exam, "03_closed", "閉じたあとのホーム")
    # 3 同じ日の2回目
    solve10(pg)
    leave(pg, "home")
    check(not sheet_after(pg, False), "kaigo: 同じ日の2回目は出ない")
    # 4 次の日・× で出る → 購入画面
    shown_yesterday(pg)
    solve10(pg)
    leave(pg, "x")
    check(sheet_after(pg, True), "kaigo: 次の日は × で出ても出る")
    if pg.locator(".after-result").count():
        pg.click("[data-after-result=open]")
        pg.wait_for_selector(".paywall")
        check(attrs(pg).get("paywall_from") == "after-result", f"kaigo: paywall_from=after-result {attrs(pg)}")
        check(pg.locator(".after-result").count() == 0, "kaigo: 購入画面の上に案内が残らない")
        shot(pg, exam, "04_paywall_from_sheet", "案内から開いた購入画面")
        pg.click(".topbar [aria-label='閉じる']")
        pg.wait_for_selector(".home")
        check(pg.locator(".after-result").count() == 0, "kaigo: 購入画面を閉じたあと案内は出し直さない")
    # 5 外を押しても閉じる(4 で購入画面を開いたので、その記録を前の日にする)
    shown_yesterday(pg)
    set_pref(pg, "nigatecho.review", {"paywallAt": pg.evaluate("() => Date.now()") - DAY})
    solve10(pg)
    leave(pg, "home")
    check(sheet_after(pg, True), "kaigo: (外で閉じる)出る")
    if pg.locator(".after-result").count():
        pg.mouse.click(195, 60)
        pg.wait_for_timeout(300)
        check(pg.locator(".after-result").count() == 0, "kaigo: 外を押すと閉じる")
    # 6 続けて解く人
    shown_yesterday(pg)
    solve10(pg)
    if pg.locator(".result-actions >> text=間違えた問題を復習する").count():
        pg.click(".result-actions >> text=間違えた問題を復習する")
        pg.wait_for_selector(".choices .choice")
        check(pg.locator(".after-result").count() == 0, "kaigo: 復習へ進んだ人には出ない")
        pg.click(".topbar [aria-label='閉じる']")
        pg.wait_for_selector(".home")
        check(not sheet_after(pg, False), "kaigo: 復習を途中でやめてホームへ戻っても出ない")
    else:
        check(False, "kaigo: 「間違えた問題を復習する」がある")
    # 6b もう一度同じ問題で解く → 途中でやめる
    solve10(pg)
    pg.click(".result-actions >> text=もう一度同じ問題で解く")
    pg.wait_for_selector(".choices .choice")
    pg.click(".topbar [aria-label='閉じる']")
    pg.wait_for_selector(".home")
    check(not sheet_after(pg, False), "kaigo: 「もう一度」を途中でやめても出ない")
    # 7 今日すでに購入画面を開いた人
    shown_yesterday(pg)
    t = pg.evaluate("() => Date.now()")
    set_pref(pg, "nigatecho.review", {"paywallAt": t - 60000})
    solve10(pg)
    leave(pg, "home")
    check(not sheet_after(pg, False), "kaigo: 今日すでに購入画面を開いた人には出ない")
    # 8 買った人
    set_pref(pg, "nigatecho.review", {"paywallAt": 0})
    shown_yesterday(pg)
    pg.evaluate("() => localStorage.setItem('nigatecho.mockFull.kaigo', '1')")
    pg.reload()
    pg.wait_for_selector(".home")
    returning(pg)
    solve10(pg)
    leave(pg, "home")
    check(not sheet_after(pg, False), "kaigo: 買った人には出ない")


def run_nurse(pg):
    exam = "nurse"
    e, qs = cfg(exam)
    open_exam(pg, exam)
    returning(pg)
    if pg.locator("[data-home=sub-first]").count():
        pg.click("[data-home=sub-first]")
        answer_all(pg)
    else:
        solve10(pg)
    leave(pg, "home")
    check(sheet_after(pg, True), "nurse: 戻ってきた人に出る")
    if pg.locator(".after-result").count():
        t = check_rows(pg, exam, e, qs)
        check(pg.locator("[data-row=sub]").count() == 1 and "必修問題(基準 8割)" in t, f"nurse: 必修問題の行 [{t}]")
        if pg.locator("[data-row=sub]").count():
            sub_now = len([q for q in qs if q["subject"] == "必修問題" and q["exam"] in e["freeExams"] and not q.get("excluded")])
            sub_full = len([q for q in qs if q["subject"] == "必修問題" and not q.get("excluded")])
            check(f"{sub_now}問 → 完全版 {sub_full}問" in pg.locator("[data-row=sub]").inner_text(), f"nurse: 必修の数が合う {sub_now}→{sub_full}")
        shot(pg, exam, "01_after_result_sheet", "看護師: 必修10問のあとの「看護師の続き」")


def run_simple(pg, exam):
    e, qs = cfg(exam)
    open_exam(pg, exam)
    returning(pg)
    solve10(pg)
    leave(pg, "home")
    check(sheet_after(pg, True), f"{exam}: 戻ってきた人に出る")
    if pg.locator(".after-result").count():
        check_rows(pg, exam, e, qs)
        shot(pg, exam, "01_after_result_sheet", f"{e['name']}: 10問のあとの案内")


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    for name, fn in [("kaigo", run_kaigo), ("nurse", run_nurse), ("kanri", lambda pg: run_simple(pg, "kanri")), ("shakai", lambda pg: run_simple(pg, "shakai"))]:
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
