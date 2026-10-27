"""完全版の案内の見直し(2026-10-22)の確認。python scripts/e2e_paywall_1022.py [URL] [--exams kaigo,nurse,kanri]
開発サーバー(npx vite --port 5611)を出しておく。headless Edge(channel="msedge")・390x844。共有 Chrome は使わない。

新しい利用者として、試験ごとに最初の10分ほどを遊ぶ:
 はじめて開く → 試験を選ぶ → まず10問 → 結果 → 苦手を解く → 未回答20問 → ホーム(30問を超えた)→ 模試(無料の回)
 → 結果 → 完全版を見る → 購入画面 → 苦手ノート → 成績。続けて、無料の回を解き終えた人のホームと、買った人の画面。
見ること:
 1 はじめて開くと試験を選ぶ画面(閉じるボタン・値段なし)。選んだ試験で開き、開き直しても同じ。前の版の記録がある人は今までどおり
 2 結果の案内は一覧の上。ホームの帯は30問までは一番下、30問からは予想点のすぐ下、解き終えたら上に1枚。苦手ノートと成績に1行
 3 買っていなくても無料の回の模試が解け、結果のすぐ下に「ほかの回は完全版で」。ほかの回には鍵
 5 購入画面の表(過去問・模試)と、本人の記録の行(実際の問題数)。急がせる文が無い
 購入画面は押したときだけ開く(勝手に開かない)。買った人には案内を出さない。console のエラー 0
1.4.2(2026-10-24)で足した所:
 A 練習の結果と苦手ノートに、鍵のかかった回の同じ科目の問題を1問、問題文だけ本物のまま(選択肢・正解・解説は出さない)。
   押したときだけ購入画面へ。値段・急がせる文なし。開き直しても同じ問題
 C 試験を選んだ・購入画面を開いた・買ったときの購入管理の属性(開発では localStorage の nigatecho.mockAttrs)。
   exam・exam_first・paywall_from・paywall_exam・paywall_opened・paywall_seen・bought_exam・bought_from だけ。$ で始まる属性なし
1.4.2 の3つセット(2026-10-24 持ち主「セットは1,500円」):
 S 介護・社会・精神の購入画面だけに「○○だけ」と「3つセット」を並べる(値段はストアの表示。開発では見本の ¥900・¥1,500)。
   管理栄養士・看護師には出さない。3つのどれかを持っている人には出さない。セットを買うと3つとも開き、ほかの試験は開かない。
   bought_exam=set_fukushi。急がせる文なし。セットの場面は run_set(--exams に関係なく 介護・社会・精神 で流す)
画面写真は scripts/e2e_out/paywall_1024/<試験>/ に置く(--out で変えられる。walk.json に順番と説明)。"""
import json
import os
import re
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5611/")
EXAMS = ["kaigo", "nurse", "kanri"]
for i, a in enumerate(sys.argv):
    if a == "--exams":
        EXAMS = sys.argv[i + 1].split(",")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "e2e_out", "paywall_1024")
for i, a in enumerate(sys.argv):
    if a == "--out":
        OUT = sys.argv[i + 1]
NAMES = {"kanri": "管理栄養士", "pt": "理学療法士", "kaigo": "介護福祉士", "shakai": "社会福祉士", "seishin": "精神保健福祉士", "nurse": "看護師"}
errors, fails, oks = [], [], [0]
walk = {}
# 急がせる・だます言い回し(購入の案内に出てはいけない)
PUSHY = re.compile(r"今だけ|期間限定|残り\d+(時間|分|日)|あと\d+(時間|分)で|セール|割引|急いで|お早め")


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


def answer_one(pg, right=None):
    """いまの問題に答えて答え合わせ → 次へ。right=None は1番から順に、押せるまで選ぶ"""
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


def finish_practice(pg, limit=40):
    for _ in range(limit):
        if pg.locator(".page.result").count():
            return
        answer_one(pg)
    pg.wait_for_selector(".page.result")


def first_view_has(pg, sel):
    """その要素が最初の画面(スクロールなし)に入っているか"""
    return pg.evaluate("""(sel) => { window.scrollTo(0, 0); const e = document.querySelector(sel); if (!e) return false;
        const r = e.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }""", sel)


def before(pg, a, b):
    return pg.evaluate("""([a, b]) => { const x = document.querySelector(a), y = document.querySelector(b);
        return !!x && !!y && !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING); }""", [a, b])


def tab(pg, t):
    pg.click(f".tabbar button[data-tab={t}]")


def seen_count(pg, key):
    return pg.evaluate("(k) => Object.keys(JSON.parse(localStorage.getItem(`CapacitorStorage.nigatecho.${k}.v1`) || '{\"records\":{}}').records).length", key)


def no_pushy(pg, exam, where):
    t = pg.locator(".page").first.inner_text()
    check(not PUSHY.search(t), f"{exam} {where}: 急がせる言い回しが無い")


SET_EXAMS = ["kaigo", "shakai", "seishin"]
ALLOWED_ATTRS = {"exam", "exam_first", "paywall_from", "paywall_exam", "paywall_opened", "paywall_seen", "bought_exam", "bought_from"}


def attrs(pg):
    return pg.evaluate("() => JSON.parse(localStorage.getItem('nigatecho.mockAttrs') || '{}')")


def check_attrs(pg, exam, where):
    a = attrs(pg)
    check(set(a) <= ALLOWED_ATTRS, f"{exam} {where}: 属性は決めた名前だけ {sorted(a)}")
    check(not any(k.startswith("$") for k in a), f"{exam} {where}: $ で始まる属性を使わない")
    check(all(re.fullmatch(r"[a-z0-9_-]{1,40}", str(v)) for v in a.values() if v is not None), f"{exam} {where}: 値は英数字だけ(個人の情報なし) {a}")
    return a


def check_preview(pg, exam, sel, where):
    """鍵のかかった回の問題を1問、問題文だけ本物のまま見せているか"""
    check(pg.locator(sel).count() == 1, f"{exam} {where}: 鍵のかかった回の問題を1問見せる")
    if not pg.locator(sel).count():
        return None
    qid = pg.locator(sel).get_attribute("data-qid")
    t = pg.locator(sel).inner_text()
    info = pg.evaluate("""async ([dir, qid]) => {
        const qs = await (await fetch(`./data/${dir}/questions.json`)).json();
        const cfg = (await import('/src/exams.multi.json')).default.exams.find((e) => e.dir === dir);
        const q = qs.find((x) => x.id === qid);
        return q ? { stem: q.stem, choices: q.choices, exam: q.exam, free: cfg.freeExams, figure: q.figure, excluded: q.excluded, case: !!q.case } : null;
    }""", [exam, qid])
    check(info is not None, f"{exam} {where}: 見せた問題 {qid} が問題データにある")
    if not info:
        return qid
    check(info["exam"] not in info["free"], f"{exam} {where}: 見せた問題は鍵のかかった回(第{info['exam']}回)")
    stem = pg.locator(f"{sel} .lp-stem").inner_text()
    check(stem.strip() == info["stem"].strip(), f"{exam} {where}: 問題文は本物のまま")
    check(not any(len(c.strip()) >= 4 and c.strip() in t for c in info["choices"]), f"{exam} {where}: 選択肢を出していない")
    check(not info["figure"] and not info["excluded"] and not info["case"], f"{exam} {where}: 図・事例・採点対象外の問題でない")
    check("¥" not in t and "円" not in t, f"{exam} {where}: 見せる1問に値段が無い")
    check(not PUSHY.search(t), f"{exam} {where}: 急がせる言い回しが無い")
    check(pg.evaluate("(s) => { const e = document.querySelector(s); return !!e && ![...e.querySelectorAll('*')].some((x) => getComputedStyle(x).filter.includes('blur')); }", sel), f"{exam} {where}: ぼかしを使わない")
    check(pg.locator(".paywall").count() == 0, f"{exam} {where}: 購入画面は勝手に開かない")
    return qid


def run(pg, exam, key):
    name = NAMES[exam]
    # ---------- 1 はじめて開く ----------
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(URL)
    pg.wait_for_selector(".first-pick")
    check(pg.locator(".home").count() == 0, f"{exam}: はじめて開くとホームの前に試験を選ぶ")
    check(pg.locator(".first-pick [aria-label='閉じる']").count() == 0, f"{exam}: 試験を選ぶ画面に閉じるボタンが無い")
    t = pg.locator(".first-pick").inner_text()
    check("¥" not in t and "円" not in t, f"{exam}: 試験を選ぶ画面に値段が無い")
    check(pg.locator(".first-pick .ex-item.on").count() == 0, f"{exam}: どれも選ばれていない")
    check("どの試験を受けますか" in t, f"{exam}: 「どの試験を受けますか」")
    order = pg.eval_on_selector_all(".first-pick button[data-exam]", "bs => bs.map(b => b.dataset.exam)")
    check(order == ["kaigo", "nurse", "shakai", "seishin", "kanri", "pt"], f"{exam}: 並びは 介護→看護→社会→精神→管理栄養士→理学 {order}")
    check(pg.evaluate("() => { const r = document.querySelector('.first-pick button[data-exam=nurse]').getBoundingClientRect(); return r.bottom <= window.innerHeight; }"), f"{exam}: 看護師まで動かさずに見える")
    shot(pg, exam, "01_first_pick", "はじめて開いた画面: 受ける試験を選ぶ")
    pg.click(f".first-pick button[data-exam={exam}]")
    pg.wait_for_selector(".home")
    check(pg.locator(".exam-name").inner_text() == name, f"{exam}: 選んだ試験({name})のホーム")
    check(pg.evaluate("() => localStorage.getItem('CapacitorStorage.nigatecho.exam')") == exam, f"{exam}: 選んだ試験が残る")
    check(pg.locator(".paywall").count() == 0, f"{exam}: 購入画面は勝手に開かない")
    a = check_attrs(pg, exam, "試験を選んだあと")
    check(a.get("exam") == exam and a.get("exam_first") == exam, f"{exam}: 試験を選ぶと exam・exam_first が入る {a}")
    check("paywall_from" not in a, f"{exam}: 購入画面を開くまで paywall_from は入らない")
    shot(pg, exam, "02_home_first", "選んだ試験のホーム(はじめて)")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator(".first-pick").count() == 0 and pg.locator(".exam-name").inner_text() == name, f"{exam}: 開き直しても{name}で開く")

    # ---------- まず10問(1問目は間違えるように最後の選択肢) ----------
    # 1.4.5: 看護師は「まず必修問題を10問」が先頭。この台本は今までどおりランダムの10問で回す(必修の入口は e2e_sales_1027.py)
    pg.click("text=ほかの問題もまぜて10問" if pg.locator("[data-home=sub-first]").count() else "text=まず10問解いてみる")
    finish_practice(pg)
    check(pg.locator("[data-upsell=result]").count() == 1, f"{exam}: 10問の結果に完全版の案内が1枚")
    check(before(pg, "[data-upsell=result]", ".result-list"), f"{exam}: 結果の案内は一覧の上")
    check(pg.locator(".paywall").count() == 0, f"{exam}: 結果でも購入画面は勝手に開かない")
    shot(pg, exam, "03_result10", "10問の結果(最初の画面)")
    pg.evaluate("() => document.querySelector('[data-upsell=result]').scrollIntoView({block: 'center'})")
    shot(pg, exam, "04_result10_note", "結果の案内(正解・不正解の数のすぐ下)")
    check_preview(pg, exam, "[data-upsell=result-preview]", "10問の結果")
    check(pg.locator("[data-upsell=result] [data-upsell=result-preview]").count() == 1, f"{exam}: 見せる1問は結果の案内の中(案内は1枚のまま)")
    pg.evaluate("() => document.querySelector('[data-upsell=result-preview]').scrollIntoView({block: 'center'})")
    shot(pg, exam, "04b_result10_preview", "結果の案内: 鍵のかかった回の同じ科目の問題(問題文だけ)")
    pg.click("[data-upsell=result-preview] button")
    pg.wait_for_selector(".paywall")
    pg.wait_for_timeout(200)
    a = check_attrs(pg, exam, "結果の1問から購入画面")
    check(a.get("paywall_from") == "result-preview" and a.get("paywall_exam") == exam and a.get("paywall_opened") == "1", f"{exam}: 結果の1問から開くと paywall_from=result-preview・回数1 {a}")
    check(int(a.get("paywall_seen", "0")) >= 10, f"{exam}: paywall_seen は解いた数 {a.get('paywall_seen')}")
    pg.click(".topbar [aria-label='閉じる']")
    pg.wait_for_selector(".home")
    check(pg.locator("[data-upsell=home-bottom]").count() == 1, f"{exam}: 10問ではホームの帯は一番下のまま")

    # ---------- 苦手を解く → 未回答 ----------
    if pg.locator("[data-home=nigate]").count() and not pg.locator("[data-home=nigate]").is_disabled():
        pg.click("[data-home=nigate]")
        finish_practice(pg)
        pg.click(".topbar [aria-label='閉じる']")
        pg.wait_for_selector(".home")
    pg.click(".quick.menu button:has-text('未回答')")
    finish_practice(pg)
    shot(pg, exam, "05_result_unseen", "未回答20問の結果")
    pg.click(".topbar [aria-label='閉じる']")
    pg.wait_for_selector(".home")
    n = seen_count(pg, key)
    check(n >= 30, f"{exam}: 30問を超えた({n}問)")
    check(pg.locator("[data-upsell=home-raised]").count() == 1, f"{exam}: 30問を超えたらホームの帯が上がる")
    check(pg.evaluate("() => { const f = document.querySelector('.forecast'); return !!f && f.nextElementSibling?.matches('[data-upsell=home-raised]'); }"), f"{exam}: 帯は予想点のすぐ下")
    pg.evaluate("() => document.querySelector('.forecast').scrollIntoView({block: 'start'})")
    pg.evaluate("() => window.scrollBy(0, -70)")
    shot(pg, exam, "06_home_raised", f"{n}問のあとのホーム: 予想点のすぐ下に完全版の帯")
    no_pushy(pg, exam, "ホーム")

    # ---------- 模試(無料の回) ----------
    pg.evaluate("() => window.scrollTo(0, 0)")
    pg.click(".quick.menu button:has-text('模試')")
    pg.wait_for_selector(".list-page")
    check(pg.locator(".paywall").count() == 0, f"{exam}: 買っていなくても模試の一覧が開く(購入画面へ飛ばない)")
    starts = pg.locator("[data-mock-start]")
    check(starts.count() == 1, f"{exam}: 解ける模試は無料の回の1回だけ({starts.count()})")
    check(pg.locator(".exam-row.locked").count() >= 1, f"{exam}: ほかの回には鍵")
    shot(pg, exam, "07_mock_list", "模試の一覧: 無料の回は始められる・ほかの回は完全版")
    starts.first.click()
    pg.wait_for_selector(".page.quiz")
    for _ in range(5):
        if pg.locator(".calc").count():
            pg.locator(".calc-row").first.locator(".calc-d").nth(1).click()
        else:
            pg.locator(".choices .choice").first.click()
        pg.click(".bottom-bar .btn.primary")
    pg.click(".submit-early")
    pg.click(".sheet .btn.primary")
    pg.wait_for_selector(".page.result")
    check(pg.locator("[data-upsell=mock-result]").count() == 1, f"{exam}: 模試の結果に「ほかの回は完全版で」")
    check(before(pg, "[data-upsell=mock-result]", ".subject-table"), f"{exam}: 模試の案内は科目の表の上")
    check("ほかの回" in pg.locator("[data-upsell=mock-result]").inner_text(), f"{exam}: 模試の案内の文")
    shot(pg, exam, "08_mock_result", "無料の回の模試の結果")
    pg.evaluate("() => document.querySelector('[data-upsell=mock-result]').scrollIntoView({block: 'center'})")
    shot(pg, exam, "09_mock_result_note", "模試の結果の案内")
    check(pg.locator("[data-upsell=mock-result] [data-upsell=result-preview]").count() == 0, f"{exam}: 模試の結果には1問を出さない")
    pg.click("[data-upsell=mock-result] button")
    pg.wait_for_selector(".paywall")
    pg.wait_for_timeout(200)
    a = check_attrs(pg, exam, "模試の結果から購入画面")
    check(a.get("paywall_from") == "mock-result" and a.get("paywall_opened") == "2", f"{exam}: 模試の結果から開くと paywall_from=mock-result・回数2 {a}")

    # ---------- 購入画面 ----------
    pw = pg.locator(".paywall").inner_text()
    check(pg.locator("[data-upsell=paywall-mine]").count() == 1, f"{exam}: 購入画面に本人の記録の行")
    mine = pg.locator("[data-upsell=paywall-mine]").inner_text()
    m = re.search(r"いま (\d+)問 → 完全版で (\d+)問", mine)
    check(bool(m) and int(m.group(2)) > int(m.group(1)), f"{exam}: 本人の科目の問題数が増える形 {mine!r}")
    if m:
        # 実際の問題数と同じか(その科目の採点対象の問題の数)
        subj = re.search(r"(?:苦手の多い|正答率の低い) (.+?)\n", mine + "\n")
        real = pg.evaluate("""async ([dir, now, full]) => {
            const qs = await (await fetch(`./data/${dir}/questions.json`)).json();
            const latest = Math.max(...qs.map(q => q.exam));
            const by = {};
            for (const q of qs) { if (q.excluded) continue; const s = (by[q.subject] ??= [0, 0]); s[1]++; if (q.exam === latest) s[0]++; }
            return Object.values(by).some(([a, b]) => a === now && b === full);
        }""", [exam, int(m.group(1)), int(m.group(2))])
        check(real, f"{exam}: 本人の行の数は実際の問題数({m.group(1)}→{m.group(2)})")
    rows = pg.locator(".pw-table tbody tr").all_inner_texts()
    check(len(rows) == 3, f"{exam}: 表は3行(過去問・模試・どちらも同じ) {rows}")
    check(any("模試" in r and "1回分" in r for r in rows), f"{exam}: 表の模試の無料は1回分")
    check("¥" in pw, f"{exam}: 値段はストアの表示(開発では見本の値)")
    check(not PUSHY.search(pw), f"{exam}: 購入画面に急がせる言い回しが無い")
    check(pg.locator(".pw-cta button:has-text('購入の復元')").count() == 1, f"{exam}: 購入の復元がある")
    has_set = exam in SET_EXAMS
    check(pg.locator("[data-set]").count() == (1 if has_set else 0), f"{exam}: 3つセットは介護・社会・精神の購入画面だけに出す")
    if has_set:
        opts = pg.locator("[data-set]").inner_text()
        check(f"{name}だけ" in opts and "3つセット" in opts, f"{exam}: 「{name}だけ」と「3つセット」を並べる {opts!r}")
        check("¥900" in opts and "¥1,500" in opts, f"{exam}: 単品とセットの値段(開発の見本の値) {opts!r}")
        check(all(NAMES[d] in opts for d in SET_EXAMS), f"{exam}: セットに入る3つの試験の名前")
        check(not PUSHY.search(opts), f"{exam}: セットの所に急がせる言い回しが無い")
    shot(pg, exam, "10_paywall", "購入画面(上)")
    shot(pg, exam, "11_paywall_full", "購入画面(全体)", full=True)
    pg.click(".topbar [aria-label='閉じる']")

    # ---------- 苦手ノート・成績 ----------
    pg.goto(URL)
    pg.wait_for_selector(".home")
    tab(pg, "note")
    pg.wait_for_selector(".note-page")
    check(pg.locator("[data-upsell=note]").count() == 1, f"{exam}: 苦手ノートに完全版の1行")
    shot(pg, exam, "12_note", "苦手ノートの1行")
    nq = check_preview(pg, exam, "[data-upsell=note-preview]", "苦手ノート")
    pg.evaluate("() => document.querySelector('[data-upsell=note-preview]').scrollIntoView({block: 'center'})")
    shot(pg, exam, "12b_note_preview", "苦手ノートの下: 鍵のかかった回の問題(問題文だけ)")
    tab(pg, "home")
    pg.wait_for_selector(".home")
    tab(pg, "note")
    pg.wait_for_selector(".note-page")
    check(pg.locator("[data-upsell=note-preview]").get_attribute("data-qid") == nq, f"{exam}: 開き直しても同じ1問(変わって迷わせない)")
    pg.click("[data-upsell=note-preview] button")
    pg.wait_for_selector(".paywall")
    pg.wait_for_timeout(200)
    a = check_attrs(pg, exam, "苦手ノートの1問から購入画面")
    check(a.get("paywall_from") == "note-preview" and a.get("paywall_opened") == "3", f"{exam}: 苦手ノートの1問から開くと paywall_from=note-preview・回数3 {a}")
    pg.click(".topbar [aria-label='閉じる']")
    pg.wait_for_selector(".note-page")
    check(pg.locator(".tabbar").count() == 1, f"{exam}: 苦手ノートから開いた購入画面を閉じると苦手ノートに戻る")
    tab(pg, "stats")
    pg.wait_for_selector(".stats-page")
    check(pg.locator("[data-upsell=stats]").count() == 1, f"{exam}: 成績に完全版の1行")
    shot(pg, exam, "13_stats", "成績の1行(予想点の下)")
    pg.click("[data-upsell=stats] button")
    pg.wait_for_selector(".paywall")
    pg.click(".topbar [aria-label='閉じる']")
    pg.wait_for_selector(".stats-page")
    check(pg.locator(".tabbar").count() == 1, f"{exam}: 成績から開いた購入画面を閉じると成績に戻る")

    # ---------- 買う(開発の疑似購入)→ bought_exam・bought_from ----------
    pg.click("[data-upsell=stats] button")
    pg.wait_for_selector(".paywall")
    pg.click("[data-buy=single]" if exam in SET_EXAMS else ".pw-cta .btn.primary")
    pg.wait_for_selector(".stats-page")
    pg.wait_for_timeout(300)
    a = check_attrs(pg, exam, "買ったあと")
    check(a.get("bought_exam") == exam and a.get("bought_from") == "stats", f"{exam}: 買うと bought_exam・bought_from=stats {a}")
    check(pg.locator("[data-upsell]").count() == 0, f"{exam}: 買った直後の成績に案内が無い")
    tab(pg, "note")
    pg.wait_for_selector(".note-page")
    check(pg.locator("[data-upsell]").count() == 0, f"{exam}: 買った直後の苦手ノートに1問も案内も無い")
    if exam in SET_EXAMS:
        # 単品を買った人には、ほかの2つの試験の購入画面にもセットを出さない(二重に払わせない)
        for d in SET_EXAMS:
            if d == exam:
                continue
            pg.evaluate("(d) => localStorage.setItem('CapacitorStorage.nigatecho.exam', d)", d)
            pg.goto(URL)
            pg.wait_for_selector(".home")
            pg.click("[data-upsell^=home-] button, button[data-upsell^=home-]")
            pg.wait_for_selector(".paywall")
            check(pg.locator("[data-set]").count() == 0, f"{exam}: {NAMES[exam]}を買った人には{NAMES[d]}の購入画面にもセットを出さない")
            check(pg.locator(".pw-cta .btn.primary").count() == 1, f"{exam}: {NAMES[d]}は単品だけ買える")
            if d == SET_EXAMS[-1] or (exam == SET_EXAMS[-1] and d == SET_EXAMS[-2]):
                shot(pg, exam, f"13b_paywall_{d}_after_single", f"{NAMES[exam]}を買った後の{NAMES[d]}の購入画面(セットなし)")
        pg.evaluate("(d) => localStorage.setItem('CapacitorStorage.nigatecho.exam', d)", exam)
    pg.evaluate("(d) => { localStorage.removeItem(d === 'kanri' ? 'nigatecho.mockFull' : `nigatecho.mockFull.${d}`); }", exam)

    # ---------- 無料の回を解き終えた人 ----------
    pg.goto(f"{URL}?demo=1&exam={exam}&n=4000&acc=0.7")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator("[data-upsell=home-finished]").count() == 1, f"{exam}: 解き終えたらホームの上に1枚")
    check(first_view_has(pg, "[data-upsell=home-finished]"), f"{exam}: 解き終えた1枚は最初の画面に入る")
    check(pg.locator(".unlock").count() == 0, f"{exam}: 解き終えたら下の帯は重ねて出さない")
    shot(pg, exam, "14_home_finished", "無料の回を解き終えたホーム")

    # ---------- 買った人 ----------
    pg.goto(f"{URL}?demo=1&exam={exam}&n=200&acc=0.7&premium=1")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator("[data-upsell]").count() == 0, f"{exam}: 買った人のホームに案内が無い")
    tab(pg, "note")
    check(pg.locator("[data-upsell]").count() == 0, f"{exam}: 買った人の苦手ノートに案内が無い")
    tab(pg, "stats")
    check(pg.locator("[data-upsell]").count() == 0, f"{exam}: 買った人の成績に案内が無い")

    # ---------- 前の版から使っている人(記録はあるが、選んだ試験の記録が無い) ----------
    pg.evaluate("() => { const k = 'CapacitorStorage.nigatecho.kanri-eiyoushi.v1'; const keep = JSON.stringify({ records: { x: { n: 1, ok: 1, at: 1, streak: 1, missed: false } } }); localStorage.clear(); localStorage.setItem(k, keep); }")
    pg.goto(URL)
    pg.wait_for_selector(".home, .first-pick")
    check(pg.locator(".first-pick").count() == 0 and pg.locator(".exam-name").inner_text() == "管理栄養士", f"{exam}: 前の版の記録がある人は今までどおり管理栄養士で開く")


def run_set(pg, exam):
    """3つセットを買う: 3つとも開き、ほかの試験は開かない"""
    pg.goto(URL)
    pg.evaluate("(d) => { localStorage.clear(); localStorage.setItem('CapacitorStorage.nigatecho.exam', d); }", exam)
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator(".exam-name").inner_text() == NAMES[exam], f"set {exam}: {NAMES[exam]}のホーム")
    check(pg.locator(".paywall").count() == 0, f"set {exam}: 購入画面は勝手に開かない")
    pg.click("[data-upsell^=home-] button, button[data-upsell^=home-]")
    pg.wait_for_selector(".paywall")
    check(pg.locator("[data-set=fukushi]").count() == 1, f"set {exam}: どれも持っていなければセットを出す")
    pg.evaluate("() => document.querySelector('[data-set]').scrollIntoView({block: 'center'})")
    shot(pg, "set_" + exam, "01_paywall_set", f"{NAMES[exam]}の購入画面: 単品と3つセット")
    pg.click("[data-buy=set]")
    pg.wait_for_selector(".home")
    pg.wait_for_timeout(300)
    a = check_attrs(pg, exam, "セットを買ったあと")
    check(a.get("bought_exam") == "set_fukushi" and a.get("bought_from", "").startswith("home"), f"set {exam}: bought_exam=set_fukushi {a}")
    owned = pg.evaluate("() => Object.fromEntries(['kanri','pt','kaigo','shakai','seishin','nurse'].map((d) => [d, localStorage.getItem(d === 'kanri' ? 'nigatecho.mockFull' : `nigatecho.mockFull.${d}`) === '1']))")
    check(all(owned[d] for d in SET_EXAMS), f"set {exam}: セットで介護・社会・精神の3つが開く {owned}")
    check(not any(owned[d] for d in ["kanri", "pt", "nurse"]), f"set {exam}: ほかの試験は開かない {owned}")
    for d in SET_EXAMS:
        pg.evaluate("(d) => localStorage.setItem('CapacitorStorage.nigatecho.exam', d)", d)
        pg.goto(URL)
        pg.wait_for_selector(".home")
        check(pg.locator("[data-upsell]").count() == 0, f"set {exam}: 買ったあと{NAMES[d]}のホームに案内が無い")
    # 看護師は今までどおり単品だけ(セットは出さない)
    pg.evaluate("() => localStorage.setItem('CapacitorStorage.nigatecho.exam', 'nurse')")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    pg.click("[data-upsell^=home-] button, button[data-upsell^=home-]")
    pg.wait_for_selector(".paywall")
    check(pg.locator("[data-set]").count() == 0 and pg.locator(".pw-cta .btn.primary").count() == 1, f"set {exam}: 看護師はセットなしの単品だけ")


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    for e in EXAMS:
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
        pg = ctx.new_page()
        pg.on("console", lambda m: errors.append(f"{m.text} {m.location}") if m.type == "error" and "favicon.ico" not in str(m.location) else None)
        pg.on("pageerror", lambda x: errors.append(str(x)))
        pg.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 and not r.url.endswith("favicon.ico") else None)
        pg.goto(URL)
        pg.wait_for_selector(".home, .first-pick")
        key = pg.evaluate("async (d) => (await import('/src/exams.multi.json')).default.exams.find((e) => e.dir === d).key", e)
        run(pg, e, key)
        print(f"{e} done")
        ctx.close()
    for e in SET_EXAMS:
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
        pg = ctx.new_page()
        pg.on("console", lambda m: errors.append(f"{m.text} {m.location}") if m.type == "error" and "favicon.ico" not in str(m.location) else None)
        pg.on("pageerror", lambda x: errors.append(str(x)))
        pg.goto(URL)
        pg.wait_for_selector(".home, .first-pick")
        run_set(pg, e)
        print(f"set {e} done")
        ctx.close()
    b.close()

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "walk.json"), "w", encoding="utf-8") as f:
    json.dump(walk, f, ensure_ascii=False, indent=1)
check(not errors, f"console のエラー 0: {errors[:5]}")
print(f"OK {oks[0]} / NG {len(fails)}")
sys.exit(1 if fails else 0)
