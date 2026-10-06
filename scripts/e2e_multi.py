"""試験を選べるようにした版の確認。python scripts/e2e_multi.py [新しい版のURL] [前の版のURL]
- 新しい版: 開発サーバー(npx vite --port 5191)
- 前の版: main を組んだ dist を http.server で出した物(例 python -m http.server 5193)。無ければ前の版の記録の確認を飛ばす
前の版で解いた記録(localStorage)を、そのまま新しい版に入れて開き、管理栄養士の記録が読めるかを見る。
画面写真は scripts/e2e_out/multi/ に置く。"""
import json
import os
import sys
import urllib.request
from playwright.sync_api import sync_playwright

NEW = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5191/"
OLD = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:5193/"
OUT = os.path.join(os.path.dirname(__file__), "e2e_out", "multi")
os.makedirs(OUT, exist_ok=True)
errors, fails = [], []


def check(cond, msg):
    print(("OK  " if cond else "NG  ") + msg)
    if not cond:
        fails.append(msg)


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, name + ".png"), full_page=True)


def up(url):
    try:
        urllib.request.urlopen(url, timeout=3)
        return True
    except Exception:
        return False


def answer_first(page):
    """1つ目の選択肢を押す。2つ選ぶ問題なら2つ目も押して答え合わせ"""
    page.locator(".choice").nth(0).click()
    bar = page.locator(".bottom-bar .btn.primary")
    if page.locator(".verdict").count() == 0:
        page.locator(".choice").nth(1).click()
        bar.click()
    page.wait_for_selector(".verdict")


def solve10(page):
    page.click("text=まず10問解いてみる")
    srcs, wrong = [], 0
    for _ in range(10):
        page.wait_for_selector(".choice")
        srcs.append(page.locator(".q-src").inner_text())
        answer_first(page)
        wrong += page.locator(".verdict.bad").count()
        page.click(".bottom-bar .btn.primary")
    page.wait_for_selector(".result-hero")
    page.click("text=ホームへ")
    page.wait_for_selector(".home")
    return srcs, wrong


def switch(page, dir_):
    page.click(".exam-switch")
    page.wait_for_selector(".ex-list")
    page.click(f".ex-item[data-exam={dir_}]")
    page.wait_for_selector(".home")


def storage(page):
    return page.evaluate("() => Object.fromEntries(Object.entries(localStorage))")


with sync_playwright() as p:
    b = p.chromium.launch()

    def new_ctx():
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP")
        pg = ctx.new_page()
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        return ctx, pg

    # ---------- 1. 前の版(公開中の管理栄養士 1.0)で解いた記録 ----------
    old_store = None
    if up(OLD):
        ctx, page = new_ctx()
        page.goto(OLD)
        page.wait_for_selector(".home")
        _, old_wrong = solve10(page)
        # しるしを1つ・文字を「大」に
        page.click("text=ランダム10問")
        page.wait_for_selector(".choice")
        page.click(".star")
        page.click(".topbar .icon")
        page.click("button[aria-label=設定]")
        page.click(".seg button:text-is('大')")
        page.click(".topbar .icon")
        page.wait_for_selector(".home")
        shot(page, "00_old_version_home")
        old_store = {k: v for k, v in storage(page).items() if k.startswith("CapacitorStorage.")}
        check("CapacitorStorage.nigatecho.kanri-eiyoushi.v1" in old_store, "前の版は nigatecho.kanri-eiyoushi.v1 に記録している")
        old_data = json.loads(old_store["CapacitorStorage.nigatecho.kanri-eiyoushi.v1"])
        ctx.close()
    else:
        print("前の版のサーバーが無いので、前の版の記録の確認は飛ばす")

    # ---------- 2. はじめて入れた人: 管理栄養士で開く ----------
    ctx, page = new_ctx()
    page.goto(NEW)
    page.wait_for_selector(".home")
    check(page.locator(".brand-sub").inner_text() == "管理栄養士 過去問", "はじめて開くと管理栄養士")
    check(page.locator("text=間違えた問題だけが、ここに残ります。").count() == 1, "はじめては説明が出る")
    shot(page, "01_fresh_install_kanri")
    ctx.close()

    # ---------- 3. 前の版から上げた人: 記録をそのまま読む ----------
    ctx, page = new_ctx()
    if old_store:
        page.add_init_script("""(s) => { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }""".replace("(s) =>", "((s) =>") + ")(" + json.dumps(old_store) + ")")
    page.goto(NEW)
    page.wait_for_selector(".home")
    kanri_nigate = None
    if old_store:
        check(page.locator(".brand-sub").inner_text() == "管理栄養士 過去問", "前の版から上げた人も管理栄養士で開く")
        want = sum(1 for r in old_data["records"].values() if r["missed"] and r["streak"] < 2)
        kanri_nigate = page.locator(".hero-num b").inner_text()
        check(kanri_nigate == str(want), f"前の版の苦手の数がそのまま出る({kanri_nigate} = {want})")
        check(page.locator(".menu >> text=しるし").locator("..").locator("span").inner_text() == f"{len(old_data['marks'])}問", "しるしもそのまま")
        fs = page.evaluate("() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--fs')")
        check(fs.strip() == "1.15", f"文字の大きさもそのまま({fs})")
        shot(page, "02_upgraded_user_kanri")
    else:
        _, w = solve10(page)
        kanri_nigate = page.locator(".hero-num b").inner_text()
    before_kanri = storage(page).get("CapacitorStorage.nigatecho.kanri-eiyoushi.v1")

    # ---------- 4. 試験の切り替え画面 ----------
    page.click(".exam-switch")
    page.wait_for_selector(".ex-list")
    check(page.locator(".ex-item").count() == 4, "4つの試験から選べる")
    shot(page, "03_exam_switch")
    page.click(".topbar .icon")

    # ---------- 5. 理学療法士 ----------
    switch(page, "pt")
    check(page.locator(".brand-sub").inner_text() == "理学療法士 過去問", "理学療法士に替わる")
    check(page.locator("text=間違えた問題だけが、ここに残ります。").count() == 1, "理学療法士の記録は空(管理栄養士の記録が混ざらない)")
    check(page.locator(".unlock").count() == 1, "理学療法士は完全版の案内が出る(管理栄養士とは別の購入)")
    fs = page.evaluate("() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--fs')").strip()
    if old_store:
        check(fs == "1.15", f"文字の大きさは引き継ぐ({fs})")
    shot(page, "04_pt_home_first")
    srcs, pt_wrong = solve10(page)
    check(all(s.startswith("第61回") for s in srcs), f"無料は第61回だけ: {srcs[:3]}")
    shot(page, "05_pt_home_after")
    page.click("text=年度別")
    page.wait_for_selector(".exam-row")
    rows = page.locator(".exam-row")
    check(rows.count() == 5, "理学療法士は5回分")
    check(rows.first.locator("text=午前").count() == 1, "第61回は無料で開く")
    check(rows.nth(1).locator("text=完全版で解く").count() == 1, "第60回は完全版")
    shot(page, "06_pt_exams_locked")
    rows.nth(1).locator("text=完全版で解く").click()
    page.wait_for_selector(".paywall")
    check("理学療法士 完全版" in page.locator(".topbar h1").inner_text(), "購入画面は理学療法士の完全版")
    check(page.locator("text=¥980 で買う").count() == 1, "理学療法士は ¥980")
    shot(page, "07_pt_paywall")
    page.click(".topbar .icon")
    page.click(".topbar .icon")
    page.click("text=出典と参考文献・医療に関するご注意")
    page.wait_for_selector(".sources")
    hrefs = page.eval_on_selector_all(".sources a.ext", "els => els.map(e => e.href)")
    check(any("mhlw.go.jp" in h and "tp260424-08_09" in h for h in hrefs), "理学療法士の出典は厚生労働省の第61回のページ")
    check(not any("sssc" in h for h in hrefs), "理学療法士の出典にセンターは出ない")
    shot(page, "08_pt_sources")
    page.click(".topbar .icon")

    # ---------- 6. 介護福祉士 ----------
    switch(page, "kaigo")
    check(page.locator(".brand-sub").inner_text() == "介護福祉士 過去問", "介護福祉士に替わる")
    check(page.locator("text=間違えた問題だけが、ここに残ります。").count() == 1, "介護福祉士の記録は空")
    check(page.locator(".unlock").count() == 1, "介護福祉士は完全版の案内が出る")
    shot(page, "09_kaigo_home")
    page.click("text=年度別")
    page.wait_for_selector(".exam-row")
    check(page.locator(".exam-row").count() == 6, "介護福祉士は6回分(第33〜38回)")
    check(page.locator(".exam-row").first.locator("text=午前").count() == 1, "第38回は無料")
    check(page.locator(".exam-row").nth(1).locator("text=完全版で解く").count() == 1, "第37回は完全版")
    shot(page, "10_kaigo_exams_locked")
    page.click(".topbar .icon")
    page.click("text=出典と参考文献・ご注意")
    page.wait_for_selector(".sources")
    hrefs = page.eval_on_selector_all(".sources a.ext", "els => els.map(e => e.href)")
    body = page.locator(".sources").inner_text()
    check(any("sssc.or.jp/kaigo/past_exam" in h for h in hrefs), "介護福祉士の出典はセンターの過去の試験問題のページ")
    check(any("sssc.or.jp/pastissues" in h for h in hrefs), "利用の条件はセンターの留意事項")
    check(not any("mhlw.go.jp" in h or "digital.go.jp" in h for h in hrefs), "介護福祉士に厚生労働省・公共データ利用規約のリンクは出ない")
    check("社会福祉振興・試験センターとは関係ありません" in body and "法改正" in body, "センターの留意事項(関係が無いこと・法改正)を出す")
    check("第33〜35回" in body, "第33〜35回の掲載の説明")
    shot(page, "11_kaigo_sources")
    page.click(".topbar .icon")
    # 事例文と図: しるしに入れて開く
    page.evaluate("""() => { const k = 'CapacitorStorage.nigatecho.kaigo-fukushishi.v1'; const d = JSON.parse(localStorage.getItem(k) || '{"version":1,"records":{},"marks":[],"mocks":[],"settings":{},"daily":{}}'); d.marks = ['38-110', '38-049']; localStorage.setItem(k, JSON.stringify(d)); }""")
    page.reload()
    page.wait_for_selector(".home")
    check(page.locator(".brand-sub").inner_text() == "介護福祉士 過去問", "開き直しても最後に選んだ試験(介護福祉士)で開く")
    page.click(".menu >> text=しるし")
    page.wait_for_selector(".choice")
    check(page.locator(".case").count() == 1, "事例問題は事例文が出る")
    answer_first(page)
    shot(page, "12_kaigo_case")
    src_text = page.locator(".source").inner_text()
    check("社会福祉振興・試験センター「第38回介護福祉士国家試験」" in src_text and "センターとは関係ありません" in src_text, f"問題の下の出典はセンター: {src_text[:60]}")
    page.click(".bottom-bar .btn.primary")
    page.wait_for_selector(".choice")
    try:
        page.wait_for_function("() => { const i = document.querySelector('.figure'); return i && i.complete && i.naturalWidth > 0 }", timeout=10000)
        ok = True
    except Exception:
        ok = False
    check(ok, "介護福祉士の図(38-049)が読み込まれる")
    shot(page, "13_kaigo_figure")
    page.click(".topbar .icon")

    # ---------- 7. 社会福祉士 ----------
    switch(page, "shakai")
    check(page.locator(".brand-sub").inner_text() == "社会福祉士 過去問", "社会福祉士に替わる")
    check(page.locator(".unlock").count() == 1, "社会福祉士は完全版の案内が出る")
    shot(page, "14_shakai_home")
    page.click("text=年度別")
    page.wait_for_selector(".exam-row")
    check(page.locator(".exam-row").count() == 2, "社会福祉士は2回分")
    check(page.locator(".exam-row").nth(1).locator("text=完全版で解く").count() == 1, "第37回は完全版")
    page.click(".topbar .icon")
    page.evaluate("""() => { const k = 'CapacitorStorage.nigatecho.shakai-fukushishi.v1'; const d = JSON.parse(localStorage.getItem(k) || '{"version":1,"records":{},"marks":[],"mocks":[],"settings":{},"daily":{}}'); d.marks = ['38-022']; localStorage.setItem(k, JSON.stringify(d)); }""")
    page.reload()
    page.wait_for_selector(".home")
    page.click(".menu >> text=しるし")
    page.wait_for_selector(".choice")
    check(page.locator(".pick-note").inner_text() == "2つ選ぶ問題です", "2つ選ぶ問題の表示")
    check(page.locator(".footnote").count() == 1, "選択肢の後ろの注が出る")
    page.locator(".choice").nth(0).click()
    check(page.locator(".bottom-bar .btn.primary").is_disabled(), "1つだけでは答え合わせできない")
    ans = page.evaluate("""async () => (await (await fetch('./data/shakai/questions.json')).json()).find(x => x.id === '38-022').answer""")
    page.locator(".choice").nth(0).click()  # いったん外す
    for n in ans:
        page.locator(".choice").nth(n - 1).click()
    page.click(".bottom-bar .btn.primary")
    page.wait_for_selector(".verdict")
    check(page.locator(".verdict.good").count() == 1, f"正答の組 {ans} を選ぶと正解")
    shot(page, "15_shakai_pick2_footnote")
    page.click(".topbar .icon")
    page.click("text=出典と参考文献・ご注意")
    hrefs = page.eval_on_selector_all(".sources a.ext", "els => els.map(e => e.href)")
    check(any("sssc.or.jp/shakai/past_exam" in h for h in hrefs), "社会福祉士の出典はセンターの社会福祉士のページ")
    shot(page, "16_shakai_sources")
    page.click(".topbar .icon")

    # ---------- 8. 理学療法士だけ買う(開発用の疑似購入)→ほかは開かない ----------
    switch(page, "pt")
    check(page.locator(".hero-num b").count() == 1 if pt_wrong else True, "理学療法士の記録は残っている")
    if pt_wrong:
        check(page.locator(".hero-num b").inner_text() == str(pt_wrong), f"理学療法士の苦手 {pt_wrong} のまま")
    page.click(".unlock")
    page.wait_for_selector(".paywall")
    page.click(".pw-cta .btn.primary")
    page.wait_for_selector(".home")
    check(page.locator(".unlock").count() == 0, "理学療法士を買うと理学療法士の案内が消える")
    page.click("text=年度別")
    check(page.locator(".exam-row >> text=完全版で解く").count() == 0, "理学療法士は全部の回が開く")
    page.click(".topbar .icon")
    page.click(".exam-switch")
    page.wait_for_selector(".ex-list")
    check("購入済み" in page.locator(".ex-item[data-exam=pt]").inner_text(), "切り替え画面で理学療法士は購入済み")
    check("購入済み" not in page.locator(".ex-item[data-exam=kanri]").inner_text(), "管理栄養士は購入済みにならない")
    shot(page, "17_switch_after_pt_bought")
    page.click(".ex-item[data-exam=kaigo]")
    page.wait_for_selector(".home")
    check(page.locator(".unlock").count() == 1, "介護福祉士は開かない")

    # ---------- 9. 管理栄養士に戻る: 記録が変わっていない ----------
    switch(page, "kanri")
    check(page.locator(".brand-sub").inner_text() == "管理栄養士 過去問", "管理栄養士に戻る")
    check(page.locator(".unlock").count() == 1, "管理栄養士は買っていないまま")
    if kanri_nigate is not None:
        check(page.locator(".hero-num b").inner_text() == kanri_nigate, f"管理栄養士の苦手 {kanri_nigate} のまま")
    after = storage(page).get("CapacitorStorage.nigatecho.kanri-eiyoushi.v1")
    ka = json.loads(after)
    kb = json.loads(before_kanri)
    check(ka["records"] == kb["records"] and ka["marks"] == kb["marks"], "ほかの試験を解いても管理栄養士の記録は変わらない")
    check(all(i.split("-")[0] in ("36", "37", "38", "39", "40") for i in ka["records"]), "管理栄養士の記録に他の試験の問題が入っていない")
    shot(page, "18_back_to_kanri")
    keys = sorted(k for k in storage(page) if k.startswith("CapacitorStorage.nigatecho."))
    print("保存先:", keys)
    ctx.close()
    b.close()

print("console errors:", len(errors))
for e in errors[:10]:
    print("  ", e)
print("FAILS:", len(fails))
sys.exit(1 if fails or errors else 0)
