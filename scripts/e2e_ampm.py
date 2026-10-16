"""午前・午後で分けて解く(2026-10-16 テスターの要望)の確認。python scripts/e2e_ampm.py [URL] [--exams kaigo] [--out DIR]
開発サーバー(npx vite --port 5391)を出しておく。スマホ縦 390x844 で、
ホーム → 午前を選ぶ → 苦手を解く(午前だけ)→ 開き直しても午前のまま → 苦手ノート(午前/午後でしぼる)→ 問題を探す → ランダム10問(午後)
→ 模試(午前だけ・採点・記録)→ 年度別の一覧(切り替えは出さず、午前・午後のボタンのまま)→ 両方に戻す、を回して写真を撮る。
見ること: console のエラー 0・横にはみ出さない・出た問題がすべて選んだ区分・選んだ区分が記録(settings.ampm)に残る。"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5391/")
EXAMS = ["kaigo"]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "shots_ampm_1016")
for i, a in enumerate(sys.argv):
    if a == "--exams":
        EXAMS = sys.argv[i + 1].split(",")
    if a == "--out":
        OUT = sys.argv[i + 1]
errors, fails, oks = [], [], [0]


def check(cond, msg):
    if cond:
        oks[0] += 1
    else:
        print("NG  " + msg)
        fails.append(msg)


def shot(pg, d, name):
    w = pg.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1], f"{name}: 横にはみ出さない {w}")
    pg.screenshot(path=os.path.join(d, name + ".png"), full_page=False)


def answer(pg):
    """選ぶ数だけ上から選んで答え合わせ(2つ選ぶ問題もある)"""
    k = 0
    while k == 0 or pg.locator(".bottom-bar .btn.next").is_disabled():
        pg.locator(".choices .choice").nth(k).click()
        k += 1
    pg.click(".bottom-bar .btn.next")
    pg.wait_for_selector(".verdict")


def tab(pg, t):
    pg.click(f".tabbar button[data-tab={t}]")


def saved(pg, key):
    return pg.evaluate("(k) => JSON.parse(localStorage.getItem(`CapacitorStorage.nigatecho.${k}.v1`) || '{}')", key)


def src_half(pg):
    t = pg.locator(".q-src").first.text_content()
    return "午前" if " 午前 " in t else "午後" if " 午後 " in t else t


def run(pg, exam, key):
    d = os.path.join(OUT, exam) if len(EXAMS) > 1 else OUT
    os.makedirs(d, exist_ok=True)
    pg.goto(f"{URL}?demo=1&exam={exam}&n=420&acc=0.6&premium=1")
    pg.wait_for_selector(".home")
    # 完全版(開発サーバーの見本の購入)。単体のアプリは先頭の試験の鍵が nigatecho.mockFull なので両方に入れる
    pg.evaluate("(d) => { localStorage.setItem('nigatecho.mockFull', '1'); localStorage.setItem(`nigatecho.mockFull.${d}`, '1'); }", exam)
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator(".home .ampm").count() == 1, f"{exam}: ホームに午前・午後の切り替え")
    check(pg.locator(".home .ampm").get_attribute("data-ampm") == "both", f"{exam}: はじめは両方")
    check("ampm" not in saved(pg, key).get("settings", {}), f"{exam}: 両方のときは記録に項目を足さない")
    shot(pg, d, "01_home_both")

    # 午前を選ぶ → 苦手を解く
    pg.click(".home .ampm [data-ampm-opt='午前']")
    check(saved(pg, key)["settings"].get("ampm") == "午前", f"{exam}: 午前が記録に残る")
    btn = pg.locator("[data-home=nigate]")
    check("午前" in btn.text_content(), f"{exam}: 苦手を解くのボタンに午前")
    shot(pg, d, "02_home_am")
    btn.click()
    pg.wait_for_selector(".q-src")
    check("午前" in pg.locator(".topbar h1").text_content(), f"{exam}: 題名に午前")
    halves = set()
    for _ in range(8):
        halves.add(src_half(pg))
        answer(pg)
        nxt = pg.locator(".bottom-bar .btn.next")
        nxt.click()
        if pg.locator(".result-hero").count():
            break
        pg.wait_for_selector(".q-src")
    check(halves == {"午前"}, f"{exam}: 苦手を解く(午前)で出たのは午前だけ {halves}")
    shot(pg, d, "03_nigate_am_result")

    # 開き直しても午前のまま
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator(".home .ampm").get_attribute("data-ampm") == "午前", f"{exam}: 開き直しても午前")

    # 苦手ノート
    tab(pg, "note")
    pg.wait_for_selector(".note-page")
    check(pg.locator(".note-page .ampm").get_attribute("data-ampm") == "午前", f"{exam}: ノートも午前")
    srcs = pg.locator(".ni-src").all_text_contents()
    check(srcs and all(" 午前 " in s for s in srcs), f"{exam}: ノートは午前の苦手だけ ({len(srcs)})")
    shot(pg, d, "04_note_am")
    pg.click(".note-page .ampm [data-ampm-opt='午後']")
    srcs = pg.locator(".ni-src").all_text_contents()
    check(srcs and all(" 午後 " in s for s in srcs), f"{exam}: 午後にすると午後の苦手だけ ({len(srcs)})")
    check("午後" in pg.locator("[data-note=solve-all]").text_content(), f"{exam}: まとめて解くのボタンに午後")
    shot(pg, d, "05_note_pm")
    pg.click("[data-note=solve-all]")
    pg.wait_for_selector(".q-src")
    check(src_half(pg) == "午後", f"{exam}: ノートから解く1問目は午後")
    pg.click(".topbar .icon")

    # 問題を探す → ランダム10問(午後)
    tab(pg, "search")
    pg.wait_for_selector(".find-list")
    check(pg.locator(".search-page .ampm").get_attribute("data-ampm") == "午後", f"{exam}: 問題を探すも午後")
    shot(pg, d, "06_search_pm")
    halves = set()
    for _ in range(3):
        pg.click(".find-row[data-find=random]")
        pg.wait_for_selector(".q-src")
        check("午後" in pg.locator(".topbar h1").text_content(), f"{exam}: ランダムの題名に午後")
        for _ in range(10):
            halves.add(src_half(pg))
            answer(pg)
            pg.click(".bottom-bar .btn.next")
            if pg.locator(".result-hero").count():
                break
            pg.wait_for_selector(".q-src")
        pg.click(".topbar .icon")
        pg.wait_for_selector(".find-list")
    check(halves == {"午後"}, f"{exam}: ランダム10問(午後)で出たのは午後だけ {halves}")

    # 模試(午前だけ)
    pg.click(".find-row[data-find=mock]")
    pg.wait_for_selector(".exam-row")
    check(pg.locator(".list-page .ampm").count() == 1, f"{exam}: 模試の画面に切り替え")
    pg.click(".list-page .ampm [data-ampm-opt='午前']")
    qs = pg.evaluate("async (dir) => (await (await fetch(`./data/${dir}/questions.json`)).json())", exam)
    latest = max(q["exam"] for q in qs)
    am = [q for q in qs if q["exam"] == latest and q["session"] == "午前"]
    n_am = len(am)
    pts_am = sum(q.get("points", 1) for q in am if not q["excluded"])
    start = pg.locator(f"[data-mock-start='{latest}']")
    check(f"{n_am}問" in start.text_content(), f"{exam}: 模試の始めるに午前の問題数 {n_am}")
    shot(pg, d, "07_mock_picker_am")
    start.click()
    pg.wait_for_selector(".q-src")
    check(f"/ {n_am}" in pg.locator(".count").text_content(), f"{exam}: 模試は午前の{n_am}問")
    check(src_half(pg) == "午前", f"{exam}: 模試の1問目は午前")
    shot(pg, d, "08_mock_run_am")
    pg.locator(".choices .choice").first.click()
    pg.click(".submit-early")
    pg.click(".sheet-actions .btn.primary")
    pg.wait_for_selector(".result-hero")
    check("目安" in pg.locator(".pass-line").first.text_content(), f"{exam}: 午前だけの模試は合格基準の目安で見る")
    m = saved(pg, key)["mocks"][-1]
    check(m.get("session") == "午前" and m["total"] == pts_am, f"{exam}: 模試の記録に午前 {m.get('session')} {m['total']}")
    shot(pg, d, "09_mock_result_am")
    pg.click(".topbar .icon")
    pg.wait_for_selector(".exam-row")
    pg.click(".topbar .icon")
    pg.wait_for_selector(".find-list")
    pg.click("button.more-link")
    pg.wait_for_selector(".mock-score")
    check(" 午前" in pg.locator(".exam-row .exam-head b").first.text_content(), f"{exam}: 模試の記録に午前と出る")
    shot(pg, d, "09b_mock_history")
    pg.click(".topbar .icon")
    pg.wait_for_selector(".find-list")

    # 年度別の一覧: 切り替えは出さず、回ごとの午前・午後のボタンのまま
    tab(pg, "search")
    pg.click(".find-row[data-find=exams]")
    pg.wait_for_selector(".exam-row")
    check(pg.locator(".list-page .ampm").count() == 0, f"{exam}: 年度別の一覧には切り替えを出さない")
    check(pg.locator(".exam-actions .btn").filter(has_text="午前").count() > 0, f"{exam}: 年度別の午前のボタンはそのまま")
    shot(pg, d, "10_exams_list")
    pg.click(".topbar .icon")

    # 両方に戻す
    tab(pg, "home")
    pg.click(".home .ampm [data-ampm-opt='both']")
    check("ampm" not in saved(pg, key)["settings"], f"{exam}: 両方に戻すと記録から項目が消える")
    check("・" not in pg.locator("[data-home=nigate]").text_content(), f"{exam}: 苦手を解くは区分なしに戻る")
    shot(pg, d, "11_home_back_both")


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
    pg = ctx.new_page()
    # 開発サーバーに favicon.ico が無いだけの 404 は数えない
    pg.on("console", lambda m: errors.append(f"{m.text} {m.location}") if m.type == "error" and "favicon.ico" not in str(m.location) else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 and not r.url.endswith("favicon.ico") else None)
    pg.goto(URL)
    pg.wait_for_selector(".home")
    keys = pg.evaluate("async () => (await import('/src/exams.multi.json')).default.exams.reduce((o, e) => (o[e.dir] = e.key, o), {})")
    for e in EXAMS:
        pg.evaluate("() => localStorage.clear()")
        run(pg, e, keys[e])
        print(f"{e} done")
    ctx.close()
    b.close()

check(not errors, f"console のエラー 0: {errors[:5]}")
print(f"OK {oks[0]} / NG {len(fails)}")
sys.exit(1 if fails else 0)
