"""初めて入れた人の目で、まとめ版を最初から触って撮る(2026-11-19)。
python scripts/walk_first_1119.py [URL] --out DIR [--exams kaigo,nurse,kanri]
開発サーバー(npx vite --port 5719)を出しておく。headless Edge(channel="msedge")・390x844。共有 Chrome は使わない。
撮る順: 試験を選ぶ → ホーム → 1問目 → 答えを選んだ所 → 解説 → 10問の結果 → ホームへ戻った所 → 苦手ノート → 成績 → 購入画面
→ (2日目のつもり)もう一度開いたホーム。console のエラーも数える。"""
import os
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5719/")
OUT = None
EXAMS = ["kaigo", "nurse", "kanri"]
for i, a in enumerate(sys.argv):
    if a == "--out":
        OUT = sys.argv[i + 1]
    if a == "--exams":
        EXAMS = sys.argv[i + 1].split(",")
assert OUT, "--out DIR"
DAY = 86400000
errors = []


def shot(pg, exam, n, name, full=False):
    d = os.path.join(OUT, exam)
    os.makedirs(d, exist_ok=True)
    pg.wait_for_timeout(250)
    pg.screenshot(path=os.path.join(d, f"{n:02d}_{name}.png"), full_page=full)


def answer_one(pg, wrong=False):
    pg.wait_for_selector(".choices .choice, .calc")
    if pg.locator(".calc").count():
        for r in range(pg.locator(".calc-row").count()):
            pg.locator(".calc-row").nth(r).locator(".calc-d").nth(1).click()
    else:
        k = 0
        while pg.locator(".bottom-bar .btn.next").is_disabled() and k < pg.locator(".choices .choice").count():
            pg.locator(".choices .choice").nth(k).click()
            k += 1


def run(pg, exam):
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(URL)
    pg.wait_for_selector(".first-pick")
    shot(pg, exam, 1, "first_pick", full=True)
    pg.click(f".first-pick button[data-exam={exam}]")
    pg.wait_for_selector(".home")
    shot(pg, exam, 2, "home_first")
    shot(pg, exam, 3, "home_first_full", full=True)
    # ホームの一番目立つボタンで始める
    btn = pg.locator(".home .btn.primary.wide").filter(has_text="10問").first
    btn.click()
    pg.wait_for_selector(".choices .choice, .calc")
    shot(pg, exam, 4, "q1")
    answer_one(pg)
    shot(pg, exam, 5, "q1_selected")
    pg.click(".bottom-bar .btn.next")
    pg.wait_for_selector(".explain-page, .verdict")
    shot(pg, exam, 6, "q1_explain")
    shot(pg, exam, 7, "q1_explain_full", full=True)
    pg.click(".bottom-bar .btn.next")
    for _ in range(40):
        if pg.locator(".page.result").count():
            break
        answer_one(pg)
        pg.click(".bottom-bar .btn.next")
        pg.wait_for_selector(".explain-page, .verdict")
        pg.click(".bottom-bar .btn.next")
        pg.wait_for_timeout(50)
    pg.wait_for_selector(".page.result")
    shot(pg, exam, 8, "result")
    shot(pg, exam, 9, "result_full", full=True)
    pg.click(".result-actions >> text=ホームへ戻る")
    pg.wait_for_selector(".home")
    pg.wait_for_timeout(800)
    shot(pg, exam, 10, "home_after")
    shot(pg, exam, 11, "home_after_full", full=True)
    if pg.locator(".after-result").count():
        pg.click("[data-after-result=close]")
    pg.click(".tabbar >> text=苦手ノート")
    pg.wait_for_timeout(400)
    shot(pg, exam, 12, "note", full=True)
    pg.click(".tabbar >> text=成績")
    pg.wait_for_timeout(400)
    shot(pg, exam, 13, "stats", full=True)
    pg.click(".tabbar >> text=ホーム")
    pg.wait_for_selector(".home")
    # 購入画面(ホームの完全版の案内があればそれ、無ければ年度別の鍵)
    if pg.locator(".home [data-upsell]").count():
        pg.locator(".home [data-upsell]").first.click()
    else:
        pg.click(".quick >> text=年度別")
        pg.wait_for_timeout(300)
        pg.locator(".locked, [data-locked]").first.click()
    pg.wait_for_selector(".paywall", timeout=5000)
    shot(pg, exam, 14, "paywall")
    shot(pg, exam, 15, "paywall_full", full=True)
    # 2日目のつもりで開き直す(使い始めを1日前に)
    pg.evaluate("""() => {
      const k = 'CapacitorStorage.nigatecho.review';
      const cur = JSON.parse(localStorage.getItem(k) || '{}');
      cur.firstAt = Date.now() - 86400000;
      localStorage.setItem(k, JSON.stringify(cur));
    }""")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    pg.wait_for_timeout(500)
    shot(pg, exam, 16, "home_day2", full=True)
    shot(pg, exam, 17, "home_day2_top")
    # 次の日のつもりで、今日の数を0にして開き直す(今日の10問がある版だけ)
    pg.evaluate("""() => {
      for (const k of Object.keys(localStorage)) {
        if (!/^CapacitorStorage\\.nigatecho\\..*\\.v1$/.test(k)) continue;
        const d = JSON.parse(localStorage.getItem(k));
        if (!d || !d.daily) continue;
        const t = new Date(); const key = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
        const y = new Date(Date.now() - 86400000); const yk = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
        if (d.daily[key]) { d.daily[yk] = d.daily[key]; delete d.daily[key]; }
        localStorage.setItem(k, JSON.stringify(d));
      }
    }""")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    pg.wait_for_timeout(500)
    shot(pg, exam, 18, "home_nextday_top")
    if pg.locator("[data-home=today-start]").count():
        pg.click("[data-home=today-start]")
        for _ in range(40):
            if pg.locator(".page.result").count():
                break
            answer_one(pg)
            pg.click(".bottom-bar .btn.next")
            pg.wait_for_selector(".explain-page, .verdict")
            pg.click(".bottom-bar .btn.next")
            pg.wait_for_timeout(50)
        pg.wait_for_selector(".page.result")
        shot(pg, exam, 19, "today_result", full=True)
        pg.click(".result-actions >> text=ホームへ戻る")
        pg.wait_for_selector(".home")
        pg.wait_for_timeout(800)
        if pg.locator(".after-result").count():
            shot(pg, exam, 20, "today_after_sheet")
            pg.click("[data-after-result=close]")
        shot(pg, exam, 21, "home_today_done_top")


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    for exam in EXAMS:
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
        pg = ctx.new_page()
        pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
        pg.on("pageerror", lambda e: errors.append(str(e)))
        try:
            run(pg, exam)
            print(exam, "ok")
        except Exception as e:
            print(exam, "STOP", e)
            pg.screenshot(path=os.path.join(OUT, f"{exam}_stop.png"))
        ctx.close()
    b.close()
print("console errors", len(errors), errors[:5])
