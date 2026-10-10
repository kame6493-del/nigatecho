"""作り直した見た目(2026-10-10)の全画面の確認。python scripts/e2e_redesign.py [URL] [--widths 375,430] [--exams kanri,pt]
開発サーバー(npx vite --port 5291)を出しておく。5試験すべてで
ホーム(はじめて)→ 問題 → 答え合わせ → 解説(不正解・正解)→ 結果 → ホーム → 苦手ノート → 苦手を2回正解で消す → 成績(4つ)
→ 問題を探す → 年度別・科目別 → 試験の切り替え → 設定 → 完全版、を 375 と 430 の幅で回し、画面写真を scripts/e2e_out/redesign/<幅>/ に置く。
見ること: console のエラー 0・横にはみ出さない・苦手の数がホーム/ノート/タブの印で同じ・2回続けて正解で消える・解説の段の分け方。"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5291/")
WIDTHS = [375, 430]
EXAMS = ["kanri", "pt", "kaigo", "shakai", "seishin"]
for i, a in enumerate(sys.argv):
    if a == "--widths":
        WIDTHS = [int(x) for x in sys.argv[i + 1].split(",")]
    if a == "--exams":
        EXAMS = sys.argv[i + 1].split(",")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "e2e_out", "redesign")
NAMES = {"kanri": "管理栄養士", "pt": "理学療法士", "kaigo": "介護福祉士", "shakai": "社会福祉士", "seishin": "精神保健福祉士"}
errors, fails, oks = [], [], [0]


def check(cond, msg):
    if cond:
        oks[0] += 1
    else:
        print("NG  " + msg)
        fails.append(msg)


def answer_of(pg, exam):
    return pg.evaluate("""async (dir) => {
        const src = document.querySelector('.q-src').textContent;
        const qs = await (await fetch(`./data/${dir}/questions.json`)).json();
        const m = src.match(/第(\\d+)回 (午前|午後) 問(\\d+)/);
        const q = qs.find(x => x.exam == m[1] && x.session == m[2] && x.no == m[3]);
        return { ans: q.accepted ? q.accepted[0] : q.answer, n: q.choices.length, pick: q.pick || 1, excluded: q.excluded, id: q.id, expl: q.explanation || '' };
    }""", exam)


def choose(pg, nums):
    for n in nums:
        pg.locator(".choices .choice").nth(n - 1).click()
    pg.click(".bottom-bar .btn.next")
    pg.wait_for_selector(".verdict")


def wrong_of(info):
    a = info["ans"]
    xs = [n for n in range(1, info["n"] + 1) if n not in a]
    return xs[: info["pick"]] if len(xs) >= info["pick"] else a


def no_overflow(pg, name):
    w = pg.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1], f"{name}: 横にはみ出さない {w}")


def shot(pg, d, name, full=True):
    no_overflow(pg, name)
    pg.screenshot(path=os.path.join(d, name + ".png"), full_page=full)


def tab(pg, t):
    pg.click(f".tabbar button[data-tab={t}]")


def nigate_count(pg, dir_, key):
    return pg.evaluate("""async ([dir, key]) => {
        const d = JSON.parse(localStorage.getItem(`CapacitorStorage.nigatecho.${key}.v1`) || '{"records":{}}');
        const qs = await (await fetch(`./data/${dir}/questions.json`)).json();
        const free = new Set(qs.filter(q => q.exam === Math.max(...qs.map(x => x.exam))).map(q => q.id));
        return Object.entries(d.records).filter(([id, r]) => r.missed && r.streak < 2 && free.has(id)).length;
    }""", [dir_, key])


def run(pg, width, exam, keys):
    d = os.path.join(OUT, str(width), exam)
    os.makedirs(d, exist_ok=True)
    name = NAMES[exam]
    key = keys[exam]
    pg.goto(URL)
    pg.evaluate("(d) => { localStorage.clear(); localStorage.setItem('CapacitorStorage.nigatecho.exam', d) }", exam)
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator(".exam-name").inner_text() == name, f"{exam}: ホームの試験名 {name}")
    check(pg.locator(".tabbar button").count() == 5, f"{exam}: 下のタブが5つ")
    shot(pg, d, "01_home_first")

    # 10問: 1問目と4問目は間違える
    pg.click("text=まず10問解いてみる")
    wrong_ids = []
    for i in range(10):
        pg.wait_for_selector(".choices .choice")
        info = answer_of(pg, exam)
        if i == 0:
            check(pg.locator(".bottom-bar .btn.next").is_disabled(), f"{exam}: 選ぶ前は答え合わせを押せない")
            pg.locator(".choices .choice").nth(0).click()
            check(pg.locator(".choice.is-picked").count() == 1, f"{exam}: 選んだ選択肢に色がつく")
            if info["pick"] == 1:
                shot(pg, d, "02_question_picked", full=False)
            pg.locator(".choices .choice").nth(0).click()  # 2つ選ぶ問題で外す/1つ選ぶ問題は同じ物のまま
        bad = i in (0, 3) and not info["excluded"]
        nums = wrong_of(info) if bad else info["ans"]
        # 1つ選ぶ問題は直前の選択を置き換える。2つ選ぶ問題は一度すべて外してから選ぶ
        for el in pg.locator(".choice.is-picked").all():
            if info["pick"] > 1:
                el.click()
        choose(pg, nums)
        if bad:
            wrong_ids.append(info["id"])
            check(pg.locator(".verdict.bad").count() == 1, f"{exam}: 間違えると不正解の帯")
            check(pg.locator(".status .dots i.on").count() == 0, f"{exam}: 間違えた問題は連続正解 0/2")
        elif not info["excluded"]:
            check(pg.locator(".verdict.good").count() == 1, f"{exam}: 正しく選ぶと正解の帯 {info['id']}")
        # 解説の段: 選択肢の数だけ並び、正答に印、解説の文が落ちていない
        check(pg.locator(".ans-choice").count() == info["n"], f"{exam}: 選択肢ごとの解説が {info['n']}個")
        if info["ans"]:
            check(pg.locator(".ans-choice.is-answer").count() >= 1, f"{exam}: 正答に印")
        text = pg.locator(".explain-page").inner_text().replace("\n", "").replace(" ", "")
        body = info["expl"].split("\n")[0].split(":", 1)[-1].replace(" ", "")[:20]
        check(body in text, f"{exam}: 正答の理由が出ている {info['id']}")
        if i == 0:
            shot(pg, d, "03_explain_wrong")
        if i == 1 and not bad:
            shot(pg, d, "04_explain_right")
        pg.click(".bottom-bar .btn.next")
    pg.wait_for_selector(".result-hero")
    check(pg.locator(".ring").count() == 1, f"{exam}: 結果に丸いグラフ")
    shot(pg, d, "05_result")
    pg.click("text=ホームへ戻る")
    pg.wait_for_selector(".home")
    n_ng = nigate_count(pg, exam, key)
    check(n_ng == len(wrong_ids), f"{exam}: 間違えた {len(wrong_ids)}問が苦手に({n_ng})")
    hero = pg.locator(".stat-card .hero-num b").inner_text()
    check(hero == str(n_ng), f"{exam}: ホームの「あと N問わからない」= {n_ng}({hero})")
    badge = pg.locator(".tab-badge").inner_text() if pg.locator(".tab-badge").count() else "0"
    check(badge == str(n_ng), f"{exam}: タブの印 = {n_ng}({badge})")
    shot(pg, d, "06_home_after")

    # 苦手ノート: 1問を2回続けて正解すると消える
    tab(pg, "note")
    pg.wait_for_selector(".note-page")
    check(pg.locator(".note-items li").count() == n_ng, f"{exam}: ノートに {n_ng}問")
    shot(pg, d, "07_note")
    target = wrong_ids[0]
    for k in range(2):
        pg.click(f".note-items button[data-qid='{target}']")
        pg.wait_for_selector(".choices .choice")
        info = answer_of(pg, exam)
        check(pg.locator(".q-hist.bad").count() == 1, f"{exam}: 苦手の問題には連続正解の表示")
        choose(pg, info["ans"])
        if k == 0:
            check(pg.locator(".status .dots i.on").count() == 1, f"{exam}: 1回目の正解で 1/2")
            check("あと1回" in pg.locator(".status").inner_text(), f"{exam}: あと1回で消えると出る")
            shot(pg, d, "08_note_1of2")
        else:
            check(pg.locator(".status.cleared").count() == 1, f"{exam}: 2回目の正解で克服")
            shot(pg, d, "09_note_cleared")
        pg.click(".bottom-bar .btn.next")
        pg.wait_for_selector(".result-hero")
        pg.click(".topbar .icon")
        pg.wait_for_selector(".note-page")
    check(pg.locator(f".note-items button[data-qid='{target}']").count() == 0, f"{exam}: 2回続けて正解した問題はノートから消える")
    check(nigate_count(pg, exam, key) == n_ng - 1, f"{exam}: 苦手が1つ減る")

    # 成績(見本データで予想点まで出す)
    pg.goto(f"{URL}?demo=1&exam={exam}&n=420&acc=0.68&premium=1")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    shot(pg, d, "10_home_demo")
    tab(pg, "stats")
    pg.wait_for_selector(".stats-page")
    check(pg.locator(".fc-score b").count() == 1, f"{exam}: 成績に予想点")
    for t in ("all", "subjects", "trend", "plan"):
        pg.click(f".seg-tabs button[data-stab={t}]")
        shot(pg, d, f"11_stats_{t}")
    tab(pg, "search")
    pg.wait_for_selector(".find-list")
    shot(pg, d, "12_search")
    pg.click(".find-row[data-find=exams]")
    pg.wait_for_selector(".exam-row")
    shot(pg, d, "13_exams")
    pg.click(".seg-tabs button:text-is('科目別')")
    pg.wait_for_selector(".subj-dot")
    shot(pg, d, "14_subjects")
    pg.click(".topbar .icon")
    tab(pg, "home")
    pg.click(".exam-card-main")
    pg.wait_for_selector(".ex-list")
    check(pg.locator(".ex-item").count() == 5, f"{exam}: 試験は5つ")
    check(pg.locator(".ex-item.on").get_attribute("data-exam") == exam, f"{exam}: いまの試験に印")
    shot(pg, d, "15_switch")
    pg.click(".topbar .icon")
    tab(pg, "settings")
    pg.wait_for_selector(".settings")
    shot(pg, d, "16_settings")
    # 完全版(未購入の見本データで)
    pg.goto(f"{URL}?demo=1&exam={exam}&n=60&acc=0.6")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".unlock")
    pg.click(".unlock")
    pg.wait_for_selector(".paywall")
    shot(pg, d, "17_paywall")


with sync_playwright() as p:
    b = p.chromium.launch()
    keys = {}
    for w in WIDTHS:
        ctx = b.new_context(viewport={"width": w, "height": 812 if w == 375 else 932}, device_scale_factor=2, locale="ja-JP")
        pg = ctx.new_page()
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        if not keys:
            pg.goto(URL)
            pg.wait_for_selector(".home")
            keys = pg.evaluate("async () => (await import('/src/exams.multi.json')).default.exams.reduce((o, e) => (o[e.dir] = e.key, o), {})")
        for e in EXAMS:
            run(pg, w, e, keys)
            print(f"{w} {e} done")
        ctx.close()
    b.close()

check(not errors, f"console のエラー 0: {errors[:5]}")
print(f"OK {oks[0]} / NG {len(fails)}")
sys.exit(1 if fails else 0)
