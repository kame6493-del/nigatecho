"""試験を選べる版(まとめアプリ)のストア写真。python scripts/make_store_multi.py [URL] [--compose-only]
先に node scripts/use-multi.mjs と開発サーバー(npx vite --port 5191)。見本データ(?demo=1&exam=…)で撮る。
出力(store/multi/):
- iphone/1〜6.png 1290x2796(1枚目は試験を選ぶ画面)
- ipad/1〜5.png 2048x2732(iPhone の1〜5枚目を、ぼかした同じ絵の上に置く。ios_release/ipad_shots と同じ形)
- iap/<試験>.png 1290x2796(App内課金の審査用。各試験の購入画面。精神保健福祉士を含む5枚)
撮影途中の画面は store/multi/raw/(git に入れない)"""
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import make_screenshots as ms  # 紙の見出しの描き方(compose)を同じにする

URL = next((a for a in sys.argv[1:] if not a.startswith("--")), "http://localhost:5191/")
OUT = os.path.join(APP, "store", "multi")
RAW = os.path.join(OUT, "raw")
for d in ("raw", "iphone", "ipad", "iap"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
VIEW = {"viewport": {"width": 430, "height": 932}, "device_scale_factor": 3, "locale": "ja-JP"}


def fresh(pg):
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")


def demo(pg, exam, extra=""):
    fresh(pg)
    pg.goto(f"{URL}?demo=1&exam={exam}&n=420&acc=0.68{extra}")
    pg.wait_for_selector(".hero-num")
    pg.goto(URL)
    pg.wait_for_selector(".hero-num")


def answer_of(pg, exam):
    return pg.evaluate("""async (dir) => {
        const src = document.querySelector('.q-src').textContent;
        const qs = await (await fetch(`./data/${dir}/questions.json`)).json();
        const m = src.match(/第(\\d+)回 (午前|午後) 問(\\d+)/);
        const q = qs.find(x => x.exam == m[1] && x.session == m[2] && x.no == m[3]); return q.accepted ? q.accepted[0] : q.answer;
    }""", exam)


def press(pg, nums):
    for n in nums:
        b = pg.locator(".choice").nth(n - 1)
        if b.is_enabled():
            b.click()
    bar = pg.locator(".bottom-bar .btn.primary")
    if pg.locator(".verdict").count() == 0 and bar.count() and bar.is_enabled():
        bar.click()


def raw(name):
    return os.path.join(RAW, name + ".png")


def capture():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_context(**VIEW).new_page()

        # 1 試験を選ぶ画面(どれも未購入。値段が出る)
        demo(pg, "kanri")
        pg.click(".exam-switch")
        pg.wait_for_selector(".ex-list")
        pg.screenshot(path=raw("1_picker"))

        # 2 ホーム(管理栄養士の苦手の数)
        demo(pg, "kanri", "&premium=1")
        pg.screenshot(path=raw("2_home_kanri"))

        # 4 予想点(介護福祉士)
        demo(pg, "kaigo", "&premium=1")
        pg.evaluate("() => { const e = document.querySelector('.forecast'); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 16) }")
        pg.screenshot(path=raw("4_forecast_kaigo"))

        # 6 年度別(理学療法士)
        demo(pg, "pt", "&premium=1")
        pg.click("text=年度別")
        pg.wait_for_selector(".exam-row")
        pg.screenshot(path=raw("6_exams_pt"))

        # 3 解いた直後の解説(理学療法士)・5 苦手から外れた結果(社会福祉士)。warm=1 の見本データ
        for exam, wrong_at, ans_name in (("pt", 0, "3_answer_pt"), ("shakai", 0, None)):
            demo(pg, exam, "&premium=1&warm=1")
            pg.click("text=苦手を解く")
            for i in range(30):
                pg.wait_for_selector(".choice")
                a = answer_of(pg, exam)
                if exam == "pt" and i == wrong_at:
                    a = [n for n in range(1, 6) if n not in a][: len(a)]
                elif exam == "shakai" and i in (0, 6):
                    a = [n for n in range(1, 6) if n not in a][: len(a)]
                press(pg, a)
                pg.wait_for_selector(".verdict")
                if ans_name and i == wrong_at:
                    pg.evaluate("() => window.scrollTo(0, 0)")
                    pg.screenshot(path=raw(ans_name))
                    break
                pg.click(".bottom-bar .btn.primary")
                if pg.locator(".result-hero").count():
                    break
            if exam == "shakai":
                pg.wait_for_selector(".result-hero")
                pg.screenshot(path=raw("5_result_shakai"))

        # App内課金の審査用: 各試験の購入画面(未購入)
        for exam in ("kanri", "pt", "kaigo", "shakai", "seishin"):
            fresh(pg)
            pg.evaluate("(d) => localStorage.setItem('CapacitorStorage.nigatecho.exam', d)", exam)
            pg.goto(URL)
            pg.wait_for_selector(".unlock")
            pg.click(".unlock")
            pg.wait_for_selector(".paywall")
            pg.evaluate("() => window.scrollTo(0, 0)")
            pg.screenshot(path=os.path.join(OUT, "iap", f"{exam}.png"))
        b.close()
    # 1・2枚目の介護福祉士の画面(ホーム・解説)は Play・イベントの画像と同じ撮り方
    import make_store_play_events as pe
    pe.capture_kaigo()


# 写真に値段・「無料」を書かない(2026-10-07 1.1.0 が 2.3.7 で却下: 試験選びの画面の「完全版 ¥980」「無料」と6枚目の見出し)。
# 試験選びの画面は値段が映るので使わない。受験生の多い介護福祉士を先頭に置く。
IPHONE = [
    ("e_home_kaigo", "介護福祉士も、\n1つのアプリで。", "介護福祉士・社会福祉士・精神保健福祉士ほか"),
    ("e_answer_kaigo", "全問に、\nなぜ違うかの解説。", "正答の理由と、ほかの選択肢の誤りを1つずつ"),
    ("4_forecast_kaigo", "本番なら何点か、\n毎日わかる。", "直近の合格点と並べて、科目ごとの正答率も"),
    ("2_home_kanri", "間違えた問題だけが、\n残る。", "苦手はノートに残り、本番までに減らしていく"),
    ("5_result_shakai", "2回続けて正解したら、\n消える。", "苦手が0問になったら、本番に持っていく苦手はない"),
    ("6_exams_pt", "5試験 計3,272問。\n年度別にも解ける。", "精神保健福祉士・管理栄養士・理学療法士ほか"),
]


def compose_all():
    # make_screenshots.compose は STORE/shot_<n>.png に書くので、出力先を差し替えて使う
    ms.STORE = os.path.join(OUT, "iphone")
    for i, (name, title, sub) in enumerate(IPHONE, 1):
        ms.compose(i, raw(name), title, sub)
        os.replace(os.path.join(ms.STORE, f"shot_{i}.png"), os.path.join(ms.STORE, f"{i}.png"))
    for i in range(1, 6):
        ipad(os.path.join(OUT, "iphone", f"{i}.png"), os.path.join(OUT, "ipad", f"{i}.png"))


def ipad(src, dst):
    W, H = 2048, 2732
    shot = Image.open(src).convert("RGB")
    # 背景: 同じ絵を画面いっぱいに広げてぼかし、明るくする
    s = max(W / shot.width, H / shot.height)
    bg = shot.resize((round(shot.width * s), round(shot.height * s)), Image.LANCZOS)
    left, top = (bg.width - W) // 2, (bg.height - H) // 2
    bg = bg.crop((left, top, left + W, top + H)).filter(ImageFilter.GaussianBlur(48))
    bg = Image.blend(bg, Image.new("RGB", (W, H), (251, 248, 241)), 0.35)
    # 前: iPhone の写真を縦いっぱいに近く置き、影をつける
    fh = 2576
    fw = round(shot.width * fh / shot.height)
    fg = shot.resize((fw, fh), Image.LANCZOS)
    x, y = (W - fw) // 2, (H - fh) // 2
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([x + 10, y + 24, x + fw + 10, y + fh + 24], fill=(60, 50, 30, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(30))
    bg = bg.convert("RGBA")
    bg.alpha_composite(sh)
    bg = bg.convert("RGB")
    bg.paste(fg, (x, y))
    bg.save(dst)


def check_sizes():
    for d, size, n in (("iphone", (1290, 2796), 6), ("ipad", (2048, 2732), 5), ("iap", (1290, 2796), 5)):
        files = sorted(os.listdir(os.path.join(OUT, d)))
        assert len(files) == n, (d, files)
        for f in files:
            im = Image.open(os.path.join(OUT, d, f))
            assert im.size == size, (d, f, im.size)
            # 真っ白・真っ黒でないこと(明るさのばらつき)
            st = ImageEnhance.Brightness(im.convert("L")).enhance(1).getextrema()
            assert st[1] - st[0] > 100, (d, f, st)
        print(d, len(files), size)


if __name__ == "__main__":
    if "--compose-only" not in sys.argv:
        capture()
    compose_all()
    check_sizes()
    print("ok")
