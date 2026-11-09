"""看護師の買う割合の直し(2026-11-09)の確認。python scripts/e2e_nurse_conv_1109.py [URL] [--out DIR]
開発サーバー(npx vite --port 5791)を出しておく。headless Edge(channel="msedge")・390x844 と 360x640。共有 Chrome は使わない。
見ること:
 1 購入画面(看護師): 第116回の試験まで何日・願書の受付の締め切り・必修/一般/状況設定の無料と完全版の数(問題データから数えた数と同じ)・
   状況設定の行。急がせる言い回しが無い。横にはみ出さない。
 2 ホーム: 無料の回の必修が1問でも残っていれば案内は出ない。全部解いたら「第115回の必修問題を、全部解きました」と
   最後の答えの正解の数・基準の目安・完全版で増える必修と状況設定の数。押すと購入画面(paywall_from=home-sub-done)。
 3 結果の画面: 最後の必修を解いた回の結果に「必修問題 50問を解き終えました」の行。
 4 介護福祉士の購入画面には、区分の表・状況設定の行・時期の見出しが出ない(前と同じ)。
 console のエラー 0。"""
import datetime
import json
import math
import os
import re
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5791/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "e2e_out", "nurse_conv_1109")
for i, a in enumerate(sys.argv):
    if a == "--out":
        OUT = sys.argv[i + 1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUSHY = re.compile(r"今だけ|期間限定|残り\d+(時間|分)|あと\d+(時間|分)で|セール|割引|急いで|お早め|本日限り")
errors, fails, oks = [], [], [0]


def check(cond, msg):
    if cond:
        oks[0] += 1
    else:
        print("NG  " + msg)
        fails.append(msg)


def shot(pg, name, full=True):
    w = pg.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1], f"{name}: 横にはみ出さない {w}")
    os.makedirs(OUT, exist_ok=True)
    pg.screenshot(path=os.path.join(OUT, name + ".png"), full_page=full)


E = json.load(open(os.path.join(ROOT, "exams", "nurse", "exam.json"), encoding="utf8"))
QS = json.load(open(os.path.join(ROOT, "exams", "nurse", "data", "questions.json"), encoding="utf8"))
FREE = E["freeExams"]
KEY = "CapacitorStorage.nigatecho." + E["key"] + ".v1"


def part(q):
    return "sub" if q["subject"] == "必修問題" else ("case" if q.get("case") else "general")


def counts():
    c = {}
    for q in QS:
        if q.get("excluded"):
            continue
        k = part(q)
        f, a = c.get(k, (0, 0))
        c[k] = (f + (q["exam"] in FREE), a + 1)
    return c


C = counts()
FREE_SUB = [q for q in QS if q["exam"] in FREE and part(q) == "sub" and not q.get("excluded")]
LOCKED = [q for q in QS if q["exam"] not in FREE]
LO, HI = min(q["exam"] for q in LOCKED), max(q["exam"] for q in LOCKED)


def open_exam(pg, exam):
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(URL)
    pg.wait_for_selector(".first-pick")
    pg.click(f".first-pick button[data-exam={exam}]")
    pg.wait_for_selector(".home")


def put_records(pg, recs):
    pg.evaluate("([k, r]) => { const cur = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...cur, records: r })); }", [KEY, recs])
    pg.reload()
    pg.wait_for_selector(".home")


def rec(ok, t):
    return {"n": 1, "ok": 1 if ok else 0, "at": t, "streak": 1 if ok else 0, "missed": not ok}


def attrs(pg):
    return pg.evaluate("() => JSON.parse(localStorage.getItem('nigatecho.mockAttrs') || '{}')")


def close_paywall(pg):
    pg.locator(".paywall .topbar button").first.click()
    pg.wait_for_selector(".home")


def check_paywall(pg, tag):
    pg.wait_for_selector(".paywall")
    t = pg.locator(".paywall").inner_text()
    days = (datetime.date.fromisoformat(E["examDate"]) - datetime.date.today()).days
    check(f"第116回の試験まで あと{days}日" in t, f"{tag}: 第116回まで あと{days}日 [{t[:200]}]")
    ap = E["paywallSeason"]["apply"]
    today = datetime.date.today().isoformat()
    if ap["from"] <= today <= ap["to"]:
        to = datetime.date.fromisoformat(ap["to"])
        check(f"願書の受付は {to.month}月{to.day}日まで" in t, f"{tag}: 願書の受付の締め切り")
    rows = pg.locator("[data-upsell=paywall-parts] tr[data-part]")
    check(rows.count() == 3, f"{tag}: 区分の表が3行 ({rows.count()})")
    for k, label in [("sub", "必修問題"), ("general", "一般問題"), ("case", "状況設定問題")]:
        r = pg.locator(f"[data-upsell=paywall-parts] tr[data-part={k}]").inner_text()
        f, a = C[k]
        nums = re.findall(r"(\d+)問", r)
        check(label in r and nums == [str(f), str(a)], f"{tag}: {label} の数が問題データと同じ {f}→{a} [{r}]")
    cs = pg.locator("[data-upsell=paywall-case]").inner_text()
    check(f"{C['case'][0]}問 → {C['case'][1]}問" in cs, f"{tag}: 状況設定の行 [{cs}]")
    check(not PUSHY.search(t), f"{tag}: 急がせる言い回しが無い")
    return t


def answer_until_result(pg, limit=5):
    for _ in range(limit):
        if pg.locator(".page.result").count():
            return
        pg.wait_for_selector(".choices .choice, .calc")
        k = 0
        while pg.locator(".bottom-bar .btn.next").is_disabled() and k < pg.locator(".choices .choice").count():
            pg.locator(".choices .choice").nth(k).click()
            k += 1
        pg.click(".bottom-bar .btn.next")
        pg.wait_for_selector(".explain-page, .verdict")
        pg.click(".bottom-bar .btn.next")
    pg.wait_for_selector(".page.result")


def run(pg, b):
    # 1 購入画面
    open_exam(pg, "nurse")
    shot(pg, "01_home_first", full=False)
    pg.click("[data-upsell^=home-]")
    check_paywall(pg, "購入画面")
    check(attrs(pg).get("paywall_from") == "home", f"購入画面: paywall_from=home {attrs(pg)}")
    os.makedirs(OUT, exist_ok=True)
    pg.screenshot(path=os.path.join(OUT, "02_paywall_top.png"))
    shot(pg, "03_paywall_full")
    close_paywall(pg)
    # 2 ホーム: 必修が1問残っている → 出ない / 全部 → 出る
    t = pg.evaluate("() => Date.now()") - 3600_000
    recs = {q["id"]: rec(i % 4 != 0, t) for i, q in enumerate(FREE_SUB[:-1])}
    put_records(pg, recs)
    check(pg.locator("[data-upsell=home-sub-done]").count() == 0, "ホーム: 必修が1問残っていれば出ない")
    recs[FREE_SUB[-1]["id"]] = rec(True, t)
    put_records(pg, recs)
    ok = sum(1 for r in recs.values() if r["streak"] > 0)
    need = math.ceil(len(FREE_SUB) * E["subPass"]["ratio"])
    card = pg.locator("[data-upsell=home-sub-done]")
    check(card.count() == 1, "ホーム: 必修を全部解いたら出る")
    if card.count():
        ct = card.inner_text()
        locked_sub = C["sub"][1] - C["sub"][0]
        locked_case = C["case"][1] - C["case"][0]
        check(f"第{FREE[0]}回の必修問題を、全部解きました" in ct, f"ホーム: 見出し [{ct}]")
        check(f"{ok}/{len(FREE_SUB)}問 正解(基準の目安 {need}問)" in ct, f"ホーム: 正解の数と基準 {ok}/{need} [{ct}]")
        if ok < need:
            check(f"あと{need - ok}問" in ct, "ホーム: 基準まであと何問")
        check(f"第{LO}〜{HI}回の必修問題 {locked_sub}問と状況設定問題 {locked_case}問" in ct, f"ホーム: 増える数 {locked_sub}・{locked_case} [{ct}]")
        check("¥" not in ct and "円" not in ct and not PUSHY.search(ct), "ホーム: 値段・急がせる言葉が無い")
        check(pg.locator(".paywall").count() == 0, "ホーム: 購入画面は勝手に開かない")
        card.scroll_into_view_if_needed()
        shot(pg, "04_home_sub_done", full=False)
        card.locator("button").click()
        pg.wait_for_selector(".paywall")
        check(attrs(pg).get("paywall_from") == "home-sub-done", f"ホーム: 押すと購入画面(home-sub-done) {attrs(pg)}")
        close_paywall(pg)
    # 3 結果の画面: 無料の回で必修1問だけを残し、未回答から解く
    free_all = [q for q in QS if q["exam"] in FREE]
    last = FREE_SUB[-1]
    recs2 = {q["id"]: rec(True, t) for q in free_all if q["id"] != last["id"]}
    put_records(pg, recs2)
    check(pg.locator("[data-upsell=home-sub-done]").count() == 0, "ホーム: 必修が残っていれば出ない(2)")
    pg.click(".quick >> text=未回答")
    answer_until_result(pg)
    row = pg.locator("[data-row=sub-done]")
    check(row.count() == 1, "結果: 必修を解き終えた行が出る")
    if row.count():
        rt = row.inner_text()
        check(f"必修問題 {len(FREE_SUB)}問を、全部解きました" in rt and f"/{len(FREE_SUB)}問正解(基準の目安 {need}問)" in rt, f"結果: 行の文 [{rt}]")
        row.scroll_into_view_if_needed()
        shot(pg, "05_result_sub_done", full=False)
    pg.click(".result-actions >> text=ホームへ戻る")
    pg.wait_for_selector(".home")
    pg.wait_for_timeout(500)
    check(pg.locator("[data-upsell=home-finished]").count() == 1 and pg.locator("[data-upsell=home-sub-done]").count() == 0,
          "ホーム: 無料の回を全部解いたら、前からの1枚だけ(2枚重ねない)")
    # 4 小さい画面の購入画面
    ctx2 = b.new_context(viewport={"width": 360, "height": 640}, device_scale_factor=2, locale="ja-JP")
    p2 = ctx2.new_page()
    p2.on("console", lambda m: errors.append(f"{m.text} {m.location}") if m.type == "error" and "favicon.ico" not in str(m.location) else None)
    open_exam(p2, "nurse")
    p2.click("[data-upsell^=home-]")
    check_paywall(p2, "購入画面 360")
    shot(p2, "06_paywall_360")
    ctx2.close()
    # 5 介護福祉士は前のまま
    open_exam(pg, "kaigo")
    pg.click("[data-upsell^=home-]")
    pg.wait_for_selector(".paywall")
    check(pg.locator("[data-upsell=paywall-parts], [data-upsell=paywall-case], [data-upsell=paywall-season]").count() == 0, "介護: 区分の表・状況設定・時期の見出しは出ない")
    shot(pg, "07_kaigo_paywall_unchanged")


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
    pg = ctx.new_page()
    pg.on("console", lambda m: errors.append(f"{m.text} {m.location}") if m.type == "error" and "favicon.ico" not in str(m.location) else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("response", lambda r: r.status >= 400 and "favicon.ico" not in r.url and errors.append(f"{r.status} {r.url}"))
    try:
        run(pg, b)
    finally:
        b.close()
check(not errors, f"console のエラー 0 {errors[:3]}")
print(f"OK {oks[0]} / NG {len(fails)}")
print("写真:", OUT)
sys.exit(1 if fails else 0)
