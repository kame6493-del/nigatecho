"""看護師 第111〜115回(1200問)の画面の確認。python scripts/e2e_nurse_all.py [URL]  開発サーバー(npx vite --port 5477)を出しておく。
1) ホームの試験のカードと、試験を選ぶ一覧に看護師の絵が出る
2) 完全版の見本(疑似購入)で、模試 第111回・第113回を全問正答で解く。計算問題は欄の並び(第111回「①.②mL」、第113回「2023年①②月③④日」)で出て、
   正しい数字を入れる → 結果が満点・合格点(第111回 167点・第113回 158点)、必修の満点が第113回は49点
3) 完全版を買っていないと第111〜114回は鍵がかかる(購入画面に看護師の値段 ¥980 と商品名)
画面写真は scripts/e2e_out/nurse_all/ に置く。"""
import os
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5477/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "e2e_out", "nurse_all")
os.makedirs(OUT, exist_ok=True)
errors, fails, oks = [], [], [0]


def check(cond, msg):
    if cond:
        oks[0] += 1
    else:
        print("NG  " + msg)
        fails.append(msg)


def shot(pg, name, full=True):
    pg.screenshot(path=os.path.join(OUT, name + ".png"), full_page=full)


def current(pg):
    return pg.evaluate("""async () => {
        const src = document.querySelector('.q-src').textContent;
        window.__qs = window.__qs || await (await fetch('./data/nurse/questions.json')).json();
        const m = src.match(/第(\\d+)回 (午前|午後) 問(\\d+)/);
        return window.__qs.find(x => x.exam == m[1] && x.session == m[2] && x.no == m[3]);
    }""")


def mock_all(pg, ex, full, hisshu_full, pass_score, calc_text):
    pg.click(".tabbar button[data-tab=search]")
    pg.wait_for_selector(".find-list")
    pg.click(".find-row[data-find=mock]")
    pg.wait_for_selector(f"[data-mock-start='{ex}']")
    pg.click(f"[data-mock-start='{ex}']")
    pg.wait_for_selector(".q-src")
    for i in range(240):
        q = current(pg)
        check(q["exam"] == ex, f"模試 第{ex}回の問題")
        if q.get("calc"):
            check(pg.locator(".calc .calc-row").count() == q["calc"]["slots"], f"第{ex}回: 計算問題の欄が{q['calc']['slots']}つ")
            for k, d in enumerate(q["answer"]):
                pg.locator(".calc-row").nth(k).locator(".calc-d").nth(d).click()
            now = pg.locator(".calc-now").inner_text().replace("\n", "").replace(" ", "")
            if q["id"] in calc_text:
                check(now == calc_text[q["id"]], f"第{ex}回: 入れた数字が冊子の形で出る {now!r}")
                shot(pg, f"{ex}_calc_{q['id']}", full=False)
        elif not q["excluded"]:
            ans = q["accepted"][0] if q.get("accepted") else q["answer"]
            for n in ans:
                pg.locator(".choices .choice").nth(n - 1).click()
        pg.click(".bottom-bar .btn.primary")
        if i == 239:
            pg.wait_for_selector(".sheet")
            pg.click(".sheet .btn.primary")
    pg.wait_for_selector(".result-hero")
    txt = pg.locator(".result-hero").inner_text()
    print(ex, txt.replace("\n", " / "))
    rest = full - hisshu_full
    check(f"{full}" in txt, f"第{ex}回: 満点 {full}")
    check(f"一般・状況設定 {rest}/{rest}点" in txt, f"第{ex}回: 一般・状況設定 {rest}/{rest}")
    check(f"{pass_score}点" in txt, f"第{ex}回: 合格点 {pass_score}点")
    check(f"必修問題 {hisshu_full}/{hisshu_full}点" in txt, f"第{ex}回: 必修問題 {hisshu_full}/{hisshu_full}")
    check(pg.locator(".pass-line.bad").count() == 0, f"第{ex}回: 全問正答で基準に届く")
    shot(pg, f"{ex}_mock_result")
    pg.goto(URL)
    pg.wait_for_selector(".home")


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
    pg = ctx.new_page()
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.wait_for_load_state("networkidle")
    pg.evaluate("() => { localStorage.clear(); localStorage.setItem('CapacitorStorage.nigatecho.exam', 'kangoshi') }")
    # 未購入: 第111〜114回は鍵
    pg.goto(URL + "?demo=1&exam=nurse&n=60&acc=0.6")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator(".exam-name").inner_text() == "看護師", "ホームの試験名が看護師")
    shot(pg, "01_home")
    imgs = pg.evaluate("() => [...document.querySelectorAll('.home img')].map(i => i.getAttribute('src'))")
    check(any("exam_nurse" in (s or "") for s in imgs), f"ホームのカードに看護師の絵 {imgs}")
    pg.click(".exam-card-main")
    pg.wait_for_selector(".ex-list")
    item = pg.locator(".ex-item[data-exam='nurse']")
    check(item.count() == 1, "試験の一覧に看護師")
    src = item.locator("img").first.get_attribute("src") if item.locator("img").count() else ""
    check("exam_nurse" in (src or ""), f"一覧の看護師のカードに看護師の絵 {src}")
    item.scroll_into_view_if_needed()
    shot(pg, "02_switch", full=False)
    pg.click(".topbar .icon")
    pg.wait_for_selector(".home")
    check(pg.locator(".unlock").count() >= 1, "未購入: 完全版の案内が出る")
    lock_txt = pg.locator(".unlock").first.inner_text()
    print("unlock:", lock_txt.replace("\n", " / "))
    check("111" in lock_txt and "114" in lock_txt, "未購入: 鍵の回が第111〜114回")
    pg.locator(".unlock").first.click()
    pg.wait_for_selector(".paywall")
    pw = pg.locator(".paywall").inner_text()
    check("看護師" in pw, "購入画面に看護師")
    shot(pg, "03_paywall")

    # 完全版の見本
    pg.goto(URL)
    pg.wait_for_selector(".home")
    pg.evaluate("() => localStorage.setItem('nigatecho.mockFull.nurse', '1')")
    pg.goto(URL + "?demo=1&exam=nurse&n=1&acc=1&premium=1")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    mock_all(pg, 111, 300, 50, 167, {"111-090": "3.8mL", "111-210": "3.2%"})
    mock_all(pg, 113, 299, 49, 158, {"113-106": "2023年11月12日"})
    w = pg.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1], f"横にはみ出さない {w}")
    b.close()

print(f"OK {oks[0]} / NG {len(fails)} / console エラー {len(errors)}")
for e in errors[:10]:
    print("  err:", e[:200])
sys.exit(1 if fails or errors else 0)
