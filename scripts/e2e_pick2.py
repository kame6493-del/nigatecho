"""「2つ選べ」の問題の画面の確認。python scripts/e2e_pick2.py [URL]
管理栄養士のデータには2つ選ぶ問題が無いので、ブラウザの中でだけ 40-001 を pick:2・正答[1,2] に書き換えて試す。"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5191/"
import json as _json
EXAM = _json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "exam.current.json"), encoding="utf-8"))
LATEST = EXAM["latestExam"]
OUT = os.path.join(os.path.dirname(__file__), "e2e_out", EXAM["dir"])
TARGET = f"{LATEST}-001"
os.makedirs(OUT, exist_ok=True)
fails, errors = [], []


def check(cond, msg):
    print(("OK  " if cond else "NG  ") + msg)
    if not cond:
        fails.append(msg)


def patch(route):
    resp = route.fetch()
    qs = json.loads(resp.text())
    for q in qs:
        if q["id"] == TARGET:
            q["pick"] = 2
            q["answer"] = [1, 2]
    route.fulfill(response=resp, body=json.dumps(qs, ensure_ascii=False), headers={**resp.headers, "content-type": "application/json"})


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
    ctx.route("**/data/questions.json", patch)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # 練習: 2つ選ぶまで答え合わせできない → 1と2で正解
    pg.goto(URL)
    pg.wait_for_selector(".home")
    pg.click("text=年度別")
    pg.locator(".exam-row").first.locator("text=午前").click()
    pg.wait_for_selector(".choice")
    check(pg.locator(".q-src").inner_text().startswith(f"第{LATEST}回 午前 問1"), f"第{LATEST}回 午前 問1 から始まる")
    check(pg.locator(".pick-note").count() == 1, "「2つ選ぶ問題です」が出る")
    btn = pg.locator(".bottom-bar .btn.primary")
    check(btn.is_disabled(), "1つも選んでいないと答え合わせできない")
    pg.locator(".choice").nth(0).click()
    check(btn.is_disabled() and pg.locator(".verdict").count() == 0, "1つ選んだだけでは答え合わせにならない")
    pg.locator(".choice").nth(1).click()
    check(not btn.is_disabled(), "2つ選ぶと答え合わせできる")
    pg.locator(".choice").nth(2).click()
    check(pg.locator(".choice.is-picked").count() == 2, "3つ目は選べない")
    pg.screenshot(path=os.path.join(OUT, "p2_selecting.png"), full_page=True)
    btn.click()
    pg.wait_for_selector(".verdict")
    check(pg.locator(".verdict.good").count() == 1, "1と2で正解")
    pg.screenshot(path=os.path.join(OUT, "p2_answered.png"), full_page=True)

    # 片方だけ合っていると不正解(同じ問題をもう一度)
    pg.click(".topbar .icon")
    pg.click("text=年度別")
    pg.locator(".exam-row").first.locator("text=午前").click()
    pg.wait_for_selector(".choice")
    pg.locator(".choice").nth(0).click()
    pg.locator(".choice").nth(3).click()
    pg.locator(".bottom-bar .btn.primary").click()
    pg.wait_for_selector(".verdict")
    check(pg.locator(".verdict.bad").count() == 1, "1と4は不正解")
    check(pg.locator(".choice.is-wrong").count() == 1 and pg.locator(".choice.is-answer").count() == 2, "誤りの1つに×、正答2つに印")

    # 模試: 1つだけ選んだ問題は回答済みに数えない
    pg.goto(URL + "?demo=1&premium=1&n=0")
    pg.wait_for_selector(".home")
    pg.click("text=本番形式の模試")
    pg.locator(".exam-row").first.locator("text=始める").click()
    pg.wait_for_selector(".choice")
    pg.locator(".choice").nth(0).click()
    check("回答 0" in pg.locator(".mock-nav").inner_text(), "模試: 1つ選んだだけでは回答済みにならない")
    pg.locator(".choice").nth(1).click()
    check("回答 1" in pg.locator(".mock-nav").inner_text(), "模試: 2つ選ぶと回答済み")
    pg.click("text=ここで採点する")
    pg.click(".sheet .btn.primary")
    pg.wait_for_selector(".subject-table")
    check(pg.locator(".result-score b").inner_text() == "1", "模試: 1と2を選んだ問1だけが正解で1点")
    b.close()

print("errors:", errors[:5])
print("FAILS:", len(fails))
sys.exit(1 if fails or errors else 0)
