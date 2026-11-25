"""受験票の発送までの日数(2026-11-25)の確認。python scripts/e2e_admit_1125.py [URL] [--out DIR]
開発サーバー(npx vite --port 5297)を出しておく。headless Edge(channel="msedge")。共有 Chrome は使わない。
7試験 × 390x844・375x667 で、時計を 2026-11-25 9:00 に止めて:
 1 ホームの試験日の1枚に受験票の行。介護・社会・精神は「受験票の発送まで あと16日 12月11日」、管理栄養士は「あと77日 2027年2月10日」、
   看護は「1月中旬に発送の予定」、理学・臨床は「1月下旬に発送の予定」。試験日まであと○日も同じ1枚に出ている。
 2 横にはみ出さない・値段や急がせる言葉が無い。
 3 時計を 2026-12-11 にすると介護は「今日発送」、12-12 にすると出ない。
 4 はじめて開いた人(試験を選ぶ前)には出ない。
console のエラー 0。画面写真は --out(既定 scripts/e2e_out/admit_1125)。"""
import datetime
import os
import re
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5297/")
OUT = os.path.join(os.path.dirname(__file__), "e2e_out", "admit_1125")
for i, a in enumerate(sys.argv):
    if a == "--out":
        OUT = sys.argv[i + 1]
SIZES = [("390", 390, 844), ("375", 375, 667)]
WANT = {
    "kaigo": ("days", "16", "12月11日"), "shakai": ("days", "16", "12月11日"), "seishin": ("days", "16", "12月11日"),
    "kanri": ("days", "77", "2027年2月10日"),
    "nurse": ("about", "1月中旬", None), "pt": ("about", "1月下旬", None), "rinsho": ("about", "1月下旬", None),
}
URGE = re.compile(r"今だけ|限定|お急ぎ|残りわずか|セール|割引|円|¥|無料")
ok_n = 0
ng = []
errors = []


def check(cond, label):
    global ok_n
    if cond:
        ok_n += 1
    else:
        ng.append(label)
        print("NG", label, flush=True)


def at(y, m, d):
    return datetime.datetime(y, m, d, 9, 0)


def fresh(pg, exam, n=40):
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(f"{URL}?demo=1&exam={exam}&n={n}")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")
    pg.wait_for_timeout(300)


def shot(pg, tag, name, full=False):
    d = os.path.join(OUT, tag)
    os.makedirs(d, exist_ok=True)
    pg.wait_for_timeout(250)
    pg.screenshot(path=os.path.join(d, f"{name}.png"), full_page=full)


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    for tag, w, h in SIZES:
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
        pg = ctx.new_page()
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in (m.location or {}).get("url", "") else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        pg.clock.set_fixed_time(at(2026, 11, 25))

        # 4 はじめて開いた人(試験を選ぶ前)
        pg.goto(URL)
        pg.evaluate("() => localStorage.clear()")
        pg.goto(URL)
        pg.wait_for_timeout(800)
        check(pg.locator(".home").count() == 0, f"{tag}: はじめては試験を選ぶ画面")
        check(pg.locator("[data-admit]").count() == 0, f"{tag}: 試験を選ぶ前は受験票の行を出さない")
        shot(pg, tag, "0_first_pick")

        for exam, (kind, num, day) in WANT.items():
            fresh(pg, exam)
            row = pg.locator("[data-admit]")
            check(row.count() == 1, f"{tag}/{exam}: 受験票の行が1つ")
            if row.count():
                t = row.inner_text().replace("\n", " ")
                check(row.get_attribute("data-admit") == kind, f"{tag}/{exam}: 種類 {row.get_attribute('data-admit')}")
                if kind == "days":
                    check("受験票の発送まで" in t and f"あと {num} 日" in t and day in t, f"{tag}/{exam}: 文 [{t}]")
                else:
                    check(f"受験票は{num}に発送の予定" in t, f"{tag}/{exam}: 文 [{t}]")
                check(not URGE.search(t), f"{tag}/{exam}: 値段・急がせる言葉が無い [{t}]")
                card = pg.locator(".date-card-wrap").first.inner_text()
                check("試験日まで" in card and "あと" in card, f"{tag}/{exam}: 同じ1枚に試験日まで")
            check(pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1"), f"{tag}/{exam}: 横にはみ出さない")
            shot(pg, tag, f"{exam}_1_home_top")
            pg.evaluate("() => document.querySelector('.date-card-wrap')?.scrollIntoView({block: 'center'})")
            shot(pg, tag, f"{exam}_2_date_card")

        # 3 発送の当日と翌日(介護)
        pg.clock.set_fixed_time(at(2026, 12, 11))
        fresh(pg, "kaigo")
        t = pg.locator("[data-admit]").first.inner_text() if pg.locator("[data-admit]").count() else ""
        check("今日" in t and "12月11日" in t, f"{tag}/kaigo: 当日は今日発送 [{t}]")
        pg.evaluate("() => document.querySelector('.date-card-wrap')?.scrollIntoView({block: 'center'})")
        shot(pg, tag, "kaigo_3_send_day")
        pg.clock.set_fixed_time(at(2026, 12, 12))
        fresh(pg, "kaigo")
        check(pg.locator("[data-admit]").count() == 0, f"{tag}/kaigo: 発送日を過ぎたら出さない")
        check(pg.locator(".date-card-wrap").count() >= 1, f"{tag}/kaigo: 試験日の1枚は残る")
        ctx.close()
    b.close()
check(not errors, f"console のエラー 0 {errors[:3]}")
print(f"OK {ok_n} / NG {len(ng)}")
sys.exit(1 if ng else 0)
