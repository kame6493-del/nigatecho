"""App Store / Google Play の画面写真5枚。python scripts/make_screenshots.py [URL]
1) 見本データ(?demo=1)で画面を撮る  2) ノートの紙に見出しを書いて重ねる
出力: store/raw/*.png と store/shot_1〜5.png(1290x2796)"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5191/"
HERE = os.path.dirname(os.path.abspath(__file__))
import json as _json
EXAM = _json.load(open(os.path.join(os.path.dirname(HERE), "src", "exam.current.json"), encoding="utf-8"))
STORE = os.path.join(os.path.dirname(HERE), "exams", EXAM["dir"], "store")
RAW = os.path.join(STORE, "raw")
os.makedirs(RAW, exist_ok=True)

W, H = 1290, 2796
PAPER = (251, 248, 241)
RULE = (230, 224, 210)
MARGIN = (236, 170, 158)
INK = (35, 38, 46)
RED = (210, 64, 42)
MARK = (255, 226, 77)
MINCHO = "C:/Windows/Fonts/yumindb.ttf"
GOTHIC = "C:/Windows/Fonts/YuGothB.ttc"


def capture():
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 430, "height": 932}, device_scale_factor=3, locale="ja-JP")
        pg = ctx.new_page()

        # 見本データは最初に1回だけ入れ、5枚を同じ記録のまま撮る
        pg.goto(URL + "?demo=1&premium=1&n=420&acc=0.68&warm=1")
        pg.wait_for_selector(".hero-num")
        pg.goto(URL)

        def answer_of():
            return pg.evaluate("""async () => {
                const src = document.querySelector('.q-src').textContent;
                const qs = await (await fetch('./data/questions.json')).json();
                const m = src.match(/第(\d+)回 (午前|午後) 問(\d+)/);
                return qs.find(x => x.exam == m[1] && x.session == m[2] && x.no == m[3]).answer[0];
            }""")

        # 1 ホーム(苦手の数)
        pg.wait_for_selector(".hero-num")
        pg.screenshot(path=os.path.join(RAW, "1_home.png"))

        # 3 予想点(ホームの中ほど)
        pg.evaluate("() => { const e = document.querySelector('.forecast'); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 16) }")
        pg.screenshot(path=os.path.join(RAW, "3_forecast.png"))

        # 5 年度別
        pg.evaluate("() => window.scrollTo(0, 0)")
        pg.click("text=年度別")
        pg.wait_for_selector(".exam-row")
        pg.screenshot(path=os.path.join(RAW, "5_exams.png"))
        pg.click(".topbar .icon")

        # 2 解いた直後(不正解と解説)と 4 結果(苦手から外れた)
        pg.wait_for_selector(".hero-num")
        pg.click("text=苦手を解く")
        for i in range(30):
            pg.wait_for_selector(".choice")
            a = answer_of()
            pick = a if i not in (0, 6) else (1 if a != 1 else 2)
            pg.locator(".choice").nth(pick - 1).click()
            pg.wait_for_selector(".verdict")
            if i == 0:
                pg.evaluate("() => window.scrollTo(0, 0)")
                pg.screenshot(path=os.path.join(RAW, "2_answer.png"))
            pg.click(".bottom-bar .btn.primary")
            if pg.locator(".result-hero").count():
                break
        pg.wait_for_selector(".result-hero")
        pg.screenshot(path=os.path.join(RAW, "4_result.png"))
        b.close()


def paper():
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    for y in range(120, H, 96):
        d.line([(0, y), (W, y)], fill=RULE, width=3)
    d.line([(118, 0), (118, H)], fill=MARGIN, width=4)
    return img


def compose(n, raw, title, sub):
    img = paper()
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(MINCHO, 104)
    f2 = ImageFont.truetype(GOTHIC, 44)
    # 見出し: 蛍光ペンを引いてから墨で書く
    lines = title.split("\n")
    y = 170
    for ln in lines:
        bb = d.textbbox((0, 0), ln, font=f1)
        w = bb[2] - bb[0]
        x = (W - w) // 2
        d.rectangle([x - 14, y + 64, x + w + 14, y + 118], fill=MARK)
        d.text((x - bb[0], y), ln, font=f1, fill=INK)
        y += 138
    bb = d.textbbox((0, 0), sub, font=f2)
    d.text(((W - (bb[2] - bb[0])) // 2, y + 18), sub, font=f2, fill=(91, 95, 105))
    top = y + 120

    # 画面: 角を丸めて、紙に置いた影
    shot = Image.open(raw).convert("RGB")
    sw = 1010
    sh = int(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    maxh = H - top - 60
    if sh > maxh:
        shot = shot.crop((0, 0, sw, maxh))
        sh = maxh
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh + 80], radius=56, fill=255)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([(W - sw) // 2 + 6, top + 14, (W + sw) // 2 + 6, top + sh + 120], radius=56, fill=(60, 50, 30, 60))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    img.paste(shadow, (0, 0), shadow)
    frame = Image.new("RGB", (sw + 16, sh + 16), INK)
    fm = Image.new("L", (sw + 16, sh + 16), 0)
    ImageDraw.Draw(fm).rounded_rectangle([0, 0, sw + 16, sh + 96], radius=64, fill=255)
    img.paste(frame, ((W - sw) // 2 - 8, top - 8), fm)
    img.paste(shot, ((W - sw) // 2, top), mask)
    img.save(os.path.join(STORE, f"shot_{n}.png"))


if __name__ == "__main__":
    if "--compose-only" not in sys.argv:
        capture()
    compose(1, os.path.join(RAW, "1_home.png"), "間違えた問題だけが、\n残る。", "苦手はノートに残り、本番までに減らしていく")
    compose(2, os.path.join(RAW, "2_answer.png"), "全問に、\nなぜ違うかの解説。", "正答の理由と、ほかの選択肢の誤りを1つずつ")
    compose(3, os.path.join(RAW, "3_forecast.png"), "本番なら何点か、\n毎日わかる。", "合格基準の6割と並べて、科目ごとの正答率も")
    compose(4, os.path.join(RAW, "4_result.png"), "2回続けて正解したら、\n消える。", "苦手が0問になったら、本番に持っていく苦手はない")
    compose(5, os.path.join(RAW, "5_exams.png"), f"第{EXAM['latestExam'] - 4}〜{EXAM['latestExam']}回\n1,000問を収録。", "厚生労働省の公表した正答に合わせた過去問")
    print("ok")
