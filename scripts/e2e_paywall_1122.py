"""買う率の直し(2026-11-22)の確認。python scripts/e2e_paywall_1122.py [URL] [--out DIR] [--exams kanri,nurse]
開発サーバー(npx vite --port 5297)を出しておく。headless Edge(channel="msedge")。共有 Chrome は使わない。
7試験 × 3つの大きさ(390x844・360x640・PC 1280x800)で:
 1 無料の残りが12問: ホームの上に小さく「第N回(無料)は 残り12問」。最初の画面に入る。押すと購入画面(paywall_from=home-near)。
   ×で閉じると消え、開き直しても出ない。急がせる言い回し・値段の文字が無い。
 2 無料の回を解き終えた: ホームの上の1枚に「完全版なら 残りN問」(N は問題データの鍵のかかった数)。知らせは出ない。
   未回答のボタンが押せて「完全版なら残りN問」→ 購入画面(home-unseen)。1枚のボタン → 購入画面(home-finished)。
   入り口ごとの回数 paywall_froms に3つとも残る。
 3 購入画面: 見出しのすぐ下の買うボタンが最初の画面に入る。押すと買える(疑似購入)・bought_button=top。セットのある試験は
   「買い方を選ぶ」で下の選ぶ所へ移り、そこで買っても bought_button=top。
 4 解き終えた1枚は×で閉じられ、開き直しても出ない(未回答のボタンは残る。2026-11-25)。
 console のエラー 0・横にはみ出さない。画面写真は --out(既定 scripts/e2e_out/paywall_1122)。"""
import json
import os
import re
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5297/")
OUT = os.path.join(os.path.dirname(__file__), "e2e_out", "paywall_1122")
EXAMS = ["kanri", "pt", "kaigo", "shakai", "seishin", "nurse", "rinsho"]
for i, a in enumerate(sys.argv):
    if a == "--out":
        OUT = sys.argv[i + 1]
    if a == "--exams":
        EXAMS = sys.argv[i + 1].split(",")
SIZES = [("390", 390, 844), ("375", 375, 667), ("360", 360, 640), ("pc", 1280, 800)]
ok_n = 0
ng = []
errors = []
URGE = re.compile(r"今だけ|限定|お急ぎ|残りわずか|セール|割引|円|¥")


def check(cond, label):
    global ok_n
    if cond:
        ok_n += 1
    else:
        ng.append(label)
        print("NG", label, flush=True)


def shot(pg, tag, exam, name):
    d = os.path.join(OUT, tag, exam)
    os.makedirs(d, exist_ok=True)
    pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(d, f"{name}.png"))


def in_first_view(pg, sel):
    b = pg.locator(sel).first.bounding_box()
    h = pg.evaluate("() => innerHeight")
    return b is not None and b["y"] >= 0 and b["y"] + b["height"] <= h


def no_overflow(pg):
    return pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1")


def attrs(pg):
    return json.loads(pg.evaluate("() => localStorage.getItem('nigatecho.mockAttrs') || '{}'"))


def fresh(pg, exam, left):
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(f"{URL}?demo=1&exam={exam}&n=0&left={left}")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    pg.wait_for_timeout(300)


def close_paywall(pg):
    pg.locator(".paywall .topbar button, .paywall [aria-label='閉じる']").first.click()
    pg.wait_for_selector(".home")
    pg.wait_for_timeout(200)


def run(pg, tag, exam):
    # ---------- 1 無料の残りが12問 ----------
    fresh(pg, exam, 12)
    # 問題データの回(鍵のかかった数を数える)
    meta = pg.evaluate("async (d) => (await (await fetch(`./data/${d}/questions.json`)).json()).map((q) => [q.exam, !!q.excluded])", exam)
    near = pg.locator("[data-upsell=home-near]")
    check(near.count() == 1, f"{tag}/{exam}: 残り12問で知らせが出る")
    if near.count():
        t = near.inner_text()
        check("残り" in t and "12" in t, f"{tag}/{exam}: 知らせの数 12 [{t}]")
        check(not URGE.search(t), f"{tag}/{exam}: 知らせに急がせる言葉・値段が無い [{t}]")
        check(in_first_view(pg, "[data-upsell=home-near]"), f"{tag}/{exam}: 知らせは最初の画面")
        locked = int(re.sub(r"[^0-9]", "", re.search(r"([\d,]+)問は完全版", t).group(1)))
        free_rounds = re.search(r"第([\d・]+)回", t).group(1).split("・")
        expect_locked = sum(1 for e, _ in meta if str(e) not in free_rounds)
        check(locked == expect_locked, f"{tag}/{exam}: 知らせの完全版の数 {locked} = 問題データ {expect_locked}")
    check(pg.locator("[data-upsell=home-finished]").count() == 0, f"{tag}/{exam}: 残りがあるうちは解き終えた1枚を出さない")
    check(pg.locator("[data-upsell=home-unseen]").count() == 0, f"{tag}/{exam}: 残りがあるうちは未回答は普通のボタン")
    check(no_overflow(pg), f"{tag}/{exam}: ホーム(知らせ)が横にはみ出さない")
    shot(pg, tag, exam, "1_home_near")
    if near.count():
        pg.click("[data-upsell=home-near] .near-main")
        pg.wait_for_selector(".paywall")
        pg.wait_for_timeout(300)
        a = attrs(pg)
        check(a.get("paywall_from") == "home-near", f"{tag}/{exam}: 知らせから開くと paywall_from=home-near {a.get('paywall_from')}")
        check(a.get("paywall_first_from") == "home-near", f"{tag}/{exam}: 初めての入り口 {a.get('paywall_first_from')}")
        close_paywall(pg)
        pg.click("[data-near=close]")
        pg.wait_for_timeout(200)
        check(pg.locator("[data-upsell=home-near]").count() == 0, f"{tag}/{exam}: ×で消える")
        pg.goto(URL)
        pg.wait_for_selector(".home")
        pg.wait_for_timeout(300)
        check(pg.locator("[data-upsell=home-near]").count() == 0, f"{tag}/{exam}: 閉じたら開き直しても出ない")

    # ---------- 2 解き終えた ----------
    fresh(pg, exam, 0)
    fin = pg.locator("[data-upsell=home-finished]")
    check(fin.count() == 1, f"{tag}/{exam}: 解き終えた1枚")
    check(pg.locator("[data-upsell=home-near]").count() == 0, f"{tag}/{exam}: 解き終えたら知らせは出さない")
    if fin.count():
        t = fin.inner_text()
        check("完全版なら" in t and "残り" in t, f"{tag}/{exam}: 1枚に「完全版なら 残り」 [{t[:60]}]")
        check(not URGE.search(t), f"{tag}/{exam}: 1枚に急がせる言葉・値段が無い")
        check(in_first_view(pg, "[data-upsell=home-finished] .done-left"), f"{tag}/{exam}: 残りの数は最初の画面")
    un = pg.locator("[data-upsell=home-unseen]")
    check(un.count() == 1 and un.is_enabled(), f"{tag}/{exam}: 未回答のボタンが押せる")
    if un.count():
        ut = un.inner_text()
        check("完全版なら残り" in ut, f"{tag}/{exam}: 未回答のボタンの文 [{ut}]")
    check(no_overflow(pg), f"{tag}/{exam}: ホーム(解き終えた)が横にはみ出さない")
    shot(pg, tag, exam, "2_home_finished")
    pg.evaluate("() => document.querySelector('[data-upsell=home-unseen]')?.scrollIntoView({block: 'center'})")
    shot(pg, tag, exam, "3_home_unseen_button")
    if un.count():
        un.click()
        pg.wait_for_selector(".paywall")
        pg.wait_for_timeout(300)
        check(attrs(pg).get("paywall_from") == "home-unseen", f"{tag}/{exam}: 未回答から paywall_from=home-unseen")
        close_paywall(pg)
    if fin.count():
        pg.click("[data-upsell=home-finished] .btn.primary")
        pg.wait_for_selector(".paywall")
        pg.wait_for_timeout(300)
        a = attrs(pg)
        check(a.get("paywall_from") == "home-finished", f"{tag}/{exam}: 1枚から paywall_from=home-finished")
        fr = a.get("paywall_froms", "")
        check("home-finished:1" in fr and "home-unseen:1" in fr, f"{tag}/{exam}: 入り口ごとの回数 [{fr}]")
        check(a.get("paywall_opened") == "2", f"{tag}/{exam}: 開いた回数 {a.get('paywall_opened')}")

    # ---------- 3 購入画面の上のボタン ----------
    check(pg.locator("[data-paywall=top-cta]").count() == 1, f"{tag}/{exam}: 見出しの下に買うボタン")
    check(in_first_view(pg, "[data-paywall=top-cta] button"), f"{tag}/{exam}: 上の買うボタンは最初の画面")
    check(no_overflow(pg), f"{tag}/{exam}: 購入画面が横にはみ出さない")
    shot(pg, tag, exam, "4_paywall_first_view")
    pg.screenshot(path=os.path.join(OUT, tag, exam, "5_paywall_full.png"), full_page=True)
    if pg.locator("[data-buy=top]").count():
        pg.click("[data-buy=top]")
    else:
        pg.click("[data-buy=top-choose]")
        pg.wait_for_timeout(700)
        check(in_first_view(pg, "[data-buy=single]"), f"{tag}/{exam}: 「買い方を選ぶ」で選ぶ所へ移る")
        shot(pg, tag, exam, "6_paywall_choose")
        pg.click("[data-buy=single]")
    pg.wait_for_selector(".home")
    pg.wait_for_timeout(300)
    a = attrs(pg)
    check(a.get("bought_button") == "top" and a.get("bought_from") == "home-finished" and a.get("bought_exam") == exam,
          f"{tag}/{exam}: 上のボタンで買った記録 {a.get('bought_button')} {a.get('bought_from')} {a.get('bought_exam')}")
    check(pg.locator("[data-upsell=home-finished], [data-upsell=home-unseen], [data-upsell=home-near]").count() == 0,
          f"{tag}/{exam}: 買ったらホームの案内は消える")



def run_close(pg, tag, exam):
    # ---------- 4 解き終えた1枚は×で閉じられる(2026-11-25) ----------
    fresh(pg, exam, 0)
    x = pg.locator("[data-finished=close]")
    check(x.count() == 1, f"{tag}/{exam}: 解き終えた1枚に×")
    if x.count():
        check(in_first_view(pg, "[data-finished=close]"), f"{tag}/{exam}: ×は最初の画面")
        x.click()
        pg.wait_for_timeout(200)
        check(pg.locator("[data-upsell=home-finished]").count() == 0, f"{tag}/{exam}: ×で1枚が消える")
        pg.goto(URL)
        pg.wait_for_selector(".home")
        pg.wait_for_timeout(300)
        check(pg.locator("[data-upsell=home-finished]").count() == 0, f"{tag}/{exam}: 閉じたら開き直しても出ない")
        check(pg.locator("[data-upsell=home-unseen]").count() == 1, f"{tag}/{exam}: 閉じても未回答のボタンから完全版を見られる")
        check(no_overflow(pg), f"{tag}/{exam}: 閉じたあとのホームが横にはみ出さない")
        shot(pg, tag, exam, "7_home_finished_closed")


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    for tag, w, h in SIZES:
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if tag != "pc" else 1)
        pg = ctx.new_page()
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in (m.location or {}).get("url", "") else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        for ex in EXAMS:
            run(pg, tag, ex)
            run_close(pg, tag, ex)
        ctx.close()
    b.close()
check(not errors, f"console のエラー 0 {errors[:3]}")
print(f"OK {ok_n} / NG {len(ng)}")
sys.exit(1 if ng else 0)
