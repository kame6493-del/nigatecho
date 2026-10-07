"""ブラウザで実際に押して回る確認。python scripts/e2e.py [URL]
結果の画面写真は scripts/e2e_out/ に置く。"""
import os
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5191/"
import json as _json
EXAM = _json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "exam.current.json"), encoding="utf-8"))
LATEST = EXAM["latestExam"]


def js(src):
    """まとめアプリでは問題は public/data/<試験>/ にある"""
    return src.replace("__DIR__", EXAM["dir"])

OUT = os.path.join(os.path.dirname(__file__), "e2e_out", EXAM["dir"])
os.makedirs(OUT, exist_ok=True)
errors = []
fails = []


def check(cond, msg):
    print(("OK  " if cond else "NG  ") + msg)
    if not cond:
        fails.append(msg)


def answer(page, nums):
    """番号を順に押す。2つ選ぶ問題なら最後に「答え合わせ」を押す(1つ選ぶ問題は1つ目で答え合わせになり、残りは押せない)。"""
    for n in nums:
        btn = page.locator(".choice").nth(n - 1)
        if btn.is_enabled():
            btn.click()
    bar = page.locator(".bottom-bar .btn.primary")
    if page.locator(".verdict").count() == 0 and bar.count() and bar.is_enabled():
        bar.click()
    page.wait_for_selector(".verdict")


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, name + ".png"), full_page=True)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    # 1. はじめて開いた所
    page.goto(URL)
    page.wait_for_selector(".home")
    shot(page, "01_home_first")
    check(page.locator("text=間違えた問題だけが、ここに残ります。").count() == 1, "初回は説明が出る")
    check(page.locator(".unlock").count() == 1, "無料のときは完全版の案内が出る")

    # 2. 10問解く。わざと全部 1 を選ぶ
    page.click("text=まず10問解いてみる")
    picks = 0
    wrong = 0
    for i in range(10):
        page.wait_for_selector(".choice")
        src = page.locator(".q-src").inner_text()
        check(src.startswith(f"第{LATEST}回"), f"無料の回(第{LATEST}回)だけ出る: {src}")
        answer(page, [1, 2])
        if page.locator(".verdict.bad").count():
            wrong += 1
        if i == 0:
            shot(page, "02_quiz_answered")
        picks += 1
        page.click(".bottom-bar .btn.primary")
    page.wait_for_selector(".result-hero")
    shot(page, "03_result")
    score = page.locator(".result-score b").inner_text()
    check(int(score) == 10 - wrong, f"結果の正解数 {score} = 10 - 不正解 {wrong}")
    newn = page.locator(".result-moves li").nth(1).locator("b").inner_text()
    check(newn == f"{wrong}問", f"新しく苦手に入った数 {newn} = {wrong}")
    # 無料の回を解き終えたら、結果の下に完全版の案内が1枚だけ出る
    want_note = page.evaluate(js("""async () => {
        const qs = await (await fetch('./data/__DIR__/questions.json')).json();
        const free = __FREE__;
        const locked = qs.filter(x => !free.includes(x.exam));
        const ex = locked.map(x => x.exam);
        const lo = Math.min(...ex), hi = Math.max(...ex);
        return { range: lo === hi ? `第${lo}回` : `第${lo}〜${hi}回`, n: locked.length.toLocaleString('ja-JP') };
    }""").replace("__FREE__", _json.dumps(EXAM["freeExams"])))
    note = page.locator(".full-note")
    check(note.count() == 1, "無料の結果画面に完全版の案内が1枚出る")
    note_text = note.inner_text()
    check(f"{EXAM['name']}の{want_note['range']}({want_note['n']}問)と本番形式の模試は、完全版で解けます" in note_text, f"案内の文: {note_text.splitlines()[0]}")
    note.scroll_into_view_if_needed()
    note.screenshot(path=os.path.join(OUT, "03b_result_full_note.png"))
    page.screenshot(path=os.path.join(OUT, "03c_result_full_note_view.png"))
    check(page.locator(".sheet-backdrop").count() == 0, "案内はポップアップにしない")
    note.locator("text=完全版を見る").click()
    page.wait_for_selector(".paywall")
    check(f"{EXAM['name']} 完全版" in page.locator(".topbar h1").inner_text(), "完全版を見るで購入画面が開く")
    page.click(".topbar .icon")
    page.wait_for_selector(".home")
    check(page.locator(".home").count() == 1, "購入画面を閉じるとホームへ(同じ問題の1問目に戻らない)")
    page.wait_for_selector(".home")

    # 3. ホームに苦手の数が出る
    if wrong:
        check(page.locator(".hero-num b").inner_text() == str(wrong), "ホームの苦手の数")
    shot(page, "04_home_after")

    def review_state():
        v = page.evaluate("() => localStorage.getItem('CapacitorStorage.nigatecho.review')")
        return _json.loads(v) if v else {"sessions": 0, "askedAt": 0}

    check(review_state() == {"sessions": 1, "askedAt": 0}, f"1回目を解き終えた: 評価はお願いしない {review_state()}")

    # 4. 苦手を解いて、正解を2回選ぶと消える
    if wrong:
        for rnd in range(2):
            page.click("text=苦手を解く")
            for _ in range(wrong):
                page.wait_for_selector(".choice")
                # 正答の番号を問題データから引く
                qid = page.evaluate("""() => document.querySelector('.q-src').textContent""")
                ans = page.evaluate(js("""async (src) => {
                    const qs = await (await fetch('./data/__DIR__/questions.json')).json();
                    const m = src.match(/第(\\d+)回 (午前|午後) 問(\\d+)/);
                    const q = qs.find(x => x.exam == m[1] && x.session == m[2] && x.no == m[3]);
                    return q.accepted ? q.accepted[0] : q.answer;
                }"""), qid)
                answer(page, ans)
                page.wait_for_selector(".verdict.good")
                page.click(".bottom-bar .btn.primary")
            page.wait_for_selector(".result-hero")
            rs = review_state()
            if rnd == 0:
                check(rs["sessions"] == 2 and rs["askedAt"] == 0, f"苦手が1回正解しただけ(まだ外れない)ならお願いしない {rs}")
            else:
                check(rs["sessions"] == 3 and rs["askedAt"] > 0, f"最後の苦手を片づけた直後にお願いする {rs}")
                shot(page, "04b_nigate_cleared_result")
            page.click("text=ホームへ")
            page.wait_for_selector(".home")
        check(page.locator(".hero-num b").inner_text() == "0", "2回続けて正解すると苦手が0になる")

    # 5. 完全版の画面(開発用の疑似購入)
    page.click(".unlock")
    page.wait_for_selector(".paywall")
    shot(page, "05_paywall")
    page.click(".pw-cta .btn.primary")
    page.wait_for_selector(".home")
    check(page.locator(".unlock").count() == 0, "買ったら案内が消える")
    # 買った人には、結果画面の完全版の案内を出さない
    page.click("text=ランダム10問")
    for _ in range(10):
        page.wait_for_selector(".choice")
        answer(page, [1, 2])
        page.click(".bottom-bar .btn.primary")
    page.wait_for_selector(".result-hero")
    check(page.locator(".full-note").count() == 0, "買った人の結果画面には完全版の案内が出ない")
    shot(page, "05b_result_premium")
    page.click("text=ホームへ")
    page.wait_for_selector(".home")

    # 6. 年度別で第36回が開ける
    page.click("text=年度別")
    page.wait_for_selector(".exam-row")
    shot(page, "06_exams")
    check(page.locator(".exam-row").count() == 5, "5回分ある")
    page.locator(".exam-row").last.locator("text=午前").click()
    page.wait_for_selector(".choice")
    check(page.locator(".q-src").inner_text().startswith(f"第{LATEST - 4}回 午前 問1"), f"第{LATEST - 4}回の午前1問目から始まる")
    page.click(".topbar .icon")
    page.click(".topbar .icon")

    # 7. 図のある問題が表示される(40-193)
    page.goto(URL + "?")
    page.wait_for_selector(".home")
    page.evaluate("() => 0")

    # 8. 模試: 第40回を最後まで飛ばして採点
    page.click("text=本番形式の模試")
    page.wait_for_selector(".exam-row")
    page.locator(".exam-row").first.locator("text=始める").click()
    page.wait_for_selector(".choice")
    for i in range(5):
        page.locator(".choice").nth(1).click()
        page.click(".bottom-bar .btn.primary")
    shot(page, "07_mock")
    page.click("text=ここで採点する")
    page.click(".sheet .btn.primary")
    page.wait_for_selector(".subject-table")
    shot(page, "08_mock_result")
    check(page.locator(".full-note").count() == 0, "買った人の模試の結果にも案内は出ない")
    total = page.locator(".result-score span").inner_text()
    # 満点は、いちばん新しい回の採点対象の配点の合計(理学療法士は実地問題が3点)
    want = page.evaluate(js("""async (latest) => {
        const qs = await (await fetch('./data/__DIR__/questions.json')).json();
        return qs.filter(x => x.exam === latest && !x.excluded).reduce((t, x) => t + (x.points ?? 1), 0);
    }"""), LATEST)
    check(f"/ {want} 点" in total, f"模試の満点は配点の合計 {want}点: {total}")

    # 9. 設定
    page.click("text=ホームへ")
    page.click("button[aria-label=設定]")
    page.wait_for_selector(".settings")
    shot(page, "09_settings")

    # 10. 見本データで予想点が出る
    page.goto(URL + "?demo=1&premium=1&n=400")
    page.wait_for_selector(".forecast")
    check(page.locator(".fc-score b").count() == 1, "解いた数が多いと予想点が出る")
    # 管理栄養士は合格基準が6割で決まっている。線は 200点満点の 120点のまま
    check(page.locator(".fc-bar em span").inner_text() == "合格 120", f"管理栄養士の線は 合格 120: {page.locator('.fc-bar em span').inner_text()}")
    check(page.locator(".fc-line").count() == 0, "管理栄養士に直近の合格点の行は出ない")
    check("合格基準の6割" in page.locator(".subjects + p").inner_text(), "管理栄養士の科目の点線は合格基準の6割")
    shot(page, "10_home_demo")

    # 11. 図の問題: 無料の回で図のある最初の問題まで進む
    page.goto(URL)
    page.wait_for_selector(".home")
    first_fig = page.evaluate(js("""async (latest) => {
        const qs = await (await fetch('./data/__DIR__/questions.json')).json();
        const q = qs.filter(x => x.exam === latest && x.figure).sort((a, b) => a.no - b.no)[0];
        return q ? { session: q.session, idx: qs.filter(x => x.exam === latest && x.session === q.session && x.no < q.no).length } : null;
    }"""), LATEST)
    page.click("text=年度別")
    page.locator(".exam-row").first.locator(f"text={first_fig['session']}").click()
    page.wait_for_selector(".choice")
    for _ in range(first_fig["idx"]):
        page.locator(".choice").first.click()
        if page.locator(".bottom-bar .btn.primary").is_disabled():  # 2つ選ぶ問題
            page.locator(".choice").nth(1).click()
            page.locator(".bottom-bar .btn.primary").click()
        page.click(".bottom-bar .btn.primary")
    try:
        page.wait_for_function("() => { const i = document.querySelector('.figure'); return i && i.complete && i.naturalWidth > 0 }", timeout=10000)
        ok = True
    except Exception:
        ok = False
    check(ok, "図の画像が読み込まれる")
    shot(page, "11_figure")

    b.close()

print("console errors:", len(errors))
for e in errors[:10]:
    print("  ", e)
print("FAILS:", len(fails))
sys.exit(1 if fails or errors else 0)
