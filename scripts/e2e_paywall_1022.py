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
画面写真は scripts/e2e_out/paywall_1022/<試験>/ に置く(walk.json に順番と説明)。"""
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
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "e2e_out", "paywall_1022")
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
    shot(pg, exam, "01_first_pick", "はじめて開いた画面: 受ける試験を選ぶ")
    pg.click(f".first-pick button[data-exam={exam}]")
    pg.wait_for_selector(".home")
    check(pg.locator(".exam-name").inner_text() == name, f"{exam}: 選んだ試験({name})のホーム")
    check(pg.evaluate("() => localStorage.getItem('CapacitorStorage.nigatecho.exam')") == exam, f"{exam}: 選んだ試験が残る")
    check(pg.locator(".paywall").count() == 0, f"{exam}: 購入画面は勝手に開かない")
    shot(pg, exam, "02_home_first", "選んだ試験のホーム(はじめて)")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    check(pg.locator(".first-pick").count() == 0 and pg.locator(".exam-name").inner_text() == name, f"{exam}: 開き直しても{name}で開く")

    # ---------- まず10問(1問目は間違えるように最後の選択肢) ----------
    pg.click("text=まず10問解いてみる")
    finish_practice(pg)
    check(pg.locator("[data-upsell=result]").count() == 1, f"{exam}: 10問の結果に完全版の案内が1枚")
    check(before(pg, "[data-upsell=result]", ".result-list"), f"{exam}: 結果の案内は一覧の上")
    check(pg.locator(".paywall").count() == 0, f"{exam}: 結果でも購入画面は勝手に開かない")
    shot(pg, exam, "03_result10", "10問の結果(最初の画面)")
    pg.evaluate("() => document.querySelector('[data-upsell=result]').scrollIntoView({block: 'center'})")
    shot(pg, exam, "04_result10_note", "結果の案内(正解・不正解の数のすぐ下)")
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
    pg.click("[data-upsell=mock-result] button")
    pg.wait_for_selector(".paywall")

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
    tab(pg, "stats")
    pg.wait_for_selector(".stats-page")
    check(pg.locator("[data-upsell=stats]").count() == 1, f"{exam}: 成績に完全版の1行")
    shot(pg, exam, "13_stats", "成績の1行(予想点の下)")
    pg.click("[data-upsell=stats] button")
    pg.wait_for_selector(".paywall")
    pg.click(".topbar [aria-label='閉じる']")
    pg.wait_for_selector(".stats-page")
    check(pg.locator(".tabbar").count() == 1, f"{exam}: 成績から開いた購入画面を閉じると成績に戻る")

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
    b.close()

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "walk.json"), "w", encoding="utf-8") as f:
    json.dump(walk, f, ensure_ascii=False, indent=1)
check(not errors, f"console のエラー 0: {errors[:5]}")
print(f"OK {oks[0]} / NG {len(fails)}")
sys.exit(1 if fails else 0)
