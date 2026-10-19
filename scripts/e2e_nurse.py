"""看護師(第115回)の画面の確認。python scripts/e2e_nurse.py [URL]  開発サーバー(npx vite --port 5477)を出しておく。
1) 模試 第115回(240問)を解く。必修問題は11問、計算問題(115-090)はわざと間違え、ほかは正答を選ぶ
   → 結果: 必修問題 39/50 で基準 40 に届かず不合格、一般・状況設定は合格点 166 を上回る、と出ること
2) 間違えた問題を苦手から解く → 計算問題で数字を2つ入れるまで答え合わせできない・正しく入れると正解・解説に答えの比べが出る
3) 状況設定問題で事例文が出る
画面写真は scripts/e2e_out/nurse/ に置く。"""
import os
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5477/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "e2e_out", "nurse")
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
        const qs = await (await fetch('./data/nurse/questions.json')).json();
        const m = src.match(/第(\\d+)回 (午前|午後) 問(\\d+)/);
        return qs.find(x => x.exam == m[1] && x.session == m[2] && x.no == m[3]);
    }""")


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
    pg = ctx.new_page()
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.evaluate("() => { localStorage.clear(); localStorage.setItem('CapacitorStorage.nigatecho.exam', 'kangoshi') }")
    pg.goto(URL + "?demo=1&exam=nurse&n=1&acc=1&premium=1")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator(".exam-name").inner_text() == "看護師", "ホームの試験名が看護師")
    shot(pg, "01_home")

    # 模試
    pg.click(".tabbar button[data-tab=search]")
    pg.wait_for_selector(".find-list")
    pg.click(".find-row[data-find=mock]")
    pg.wait_for_selector("[data-mock-start='115']")
    pg.click("[data-mock-start='115']")
    pg.wait_for_selector(".q-src")
    wrong_hisshu = 0
    for i in range(240):
        q = current(pg)
        if q["calc"] if "calc" in q else False:
            check(pg.locator(".calc .calc-row").count() == 2, "模試: 計算問題に数字の欄が2つ")
            check(pg.locator(".choices .choice").count() == 0, "模試: 計算問題に選択肢が無い")
            pg.locator(".calc-row").nth(0).locator(".calc-d").nth(2).click()
            pg.locator(".calc-row").nth(1).locator(".calc-d").nth(4).click()
            check(pg.locator(".calc-box").nth(0).inner_text() == "2", "模試: 選んだ数字が欄に出る")
            shot(pg, "02_mock_calc", full=False)
        elif not q["excluded"]:
            ans = q["accepted"][0] if q.get("accepted") else q["answer"]
            if q["part"] == "必修問題" and wrong_hisshu < 11:
                wrong_hisshu += 1
                ans = [n for n in range(1, len(q["choices"]) + 1) if n not in q["answer"]][:q.get("pick", 1)]
            for n in ans:
                pg.locator(".choices .choice").nth(n - 1).click()
        if q["part"] == "状況設定問題" and q["no"] == 91:
            check(pg.locator(".case").count() == 1, "模試: 状況設定問題に事例文")
            shot(pg, "03_mock_case", full=False)
        if i + 1 < 240:
            pg.click(".bottom-bar .btn.primary")
        else:
            pg.click(".bottom-bar .btn.primary")
            pg.wait_for_selector(".sheet")
            pg.click(".sheet .btn.primary")
    pg.wait_for_selector(".result-hero")
    txt = pg.locator(".result-hero").inner_text()
    print(txt)
    # 満点 299(除外1問)。必修 39/50、計算問題(一般・1点)を落として 一般・状況設定 248/249
    check("287" in txt and "299" in txt, "模試の結果: 287/299点(必修39+一般・状況設定248)")
    check("一般・状況設定 248/249点" in txt, "一般・状況設定の点が別に出る")
    check("166点" in txt, "合格点166点(第115回)")
    check("必修問題 39/50点" in txt and "基準の目安 40点" in txt and "あと1点" in txt, "必修問題 39/50・基準40・あと1点")
    check(pg.locator(".pass-line.bad").count() == 1 and pg.locator(".pass-line.good").count() == 1, "一般・状況設定は届き、必修は届かない")
    check("今回は両方とも届いています" not in txt, "合格とは出さない")
    shot(pg, "04_mock_result")

    # 苦手から解く: 計算問題
    pg.click("text=間違えた")
    pg.wait_for_selector(".q-src")
    for k in range(20):
        q = current(pg)
        if q.get("calc"):
            nb = pg.locator(".bottom-bar .btn.next")
            check(nb.is_disabled(), "練習: 数字を入れる前は答え合わせを押せない")
            pg.locator(".calc-row").nth(0).locator(".calc-d").nth(4).click()
            check(nb.is_disabled(), "練習: 1つだけでは押せない")
            pg.locator(".calc-row").nth(1).locator(".calc-d").nth(2).click()
            shot(pg, "05_practice_calc", full=False)
            nb.click()
            pg.wait_for_selector(".verdict")
            check(pg.locator(".verdict.good").count() == 1, "練習: 42 で正解")
            check("正答 42滴/分" in pg.locator(".verdict").inner_text(), "練習: 正答の帯に 42滴/分")
            check(pg.locator(".calc-result").count() == 1, "練習: 解説に答えの比べ")
            check("1,500" in pg.locator(".explain-page").inner_text() or "1500" in pg.locator(".explain-page").inner_text(), "練習: 計算の解説")
            shot(pg, "06_practice_calc_explain")
            break
        ans = q["accepted"][0] if q.get("accepted") else q["answer"]
        for n in ans:
            pg.locator(".choices .choice").nth(n - 1).click()
        pg.click(".bottom-bar .btn.next")
        pg.wait_for_selector(".verdict")
        if k == 0:
            shot(pg, "07_practice_explain")
        pg.click(".bottom-bar .btn.next")
    else:
        check(False, "苦手の中に計算問題が無い")

    # ホームの予想点(見本データ)
    pg.goto(URL + "?demo=1&exam=nurse&n=200&acc=0.7&premium=1")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    fc = pg.locator(".forecast").inner_text()
    print(fc)
    check("一般・状況設定" in fc and "必修問題" in fc, "予想点に一般・状況設定と必修問題が別に出る")
    check("/ 249点" in fc, "予想点の満点は必修を除いた249点")
    shot(pg, "08_home_forecast")
    w = pg.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1], f"横にはみ出さない {w}")
    b.close()

check(not errors, f"console のエラー 0: {errors[:5]}")
print(f"OK {oks[0]} / NG {len(fails)}")
sys.exit(1 if fails else 0)
