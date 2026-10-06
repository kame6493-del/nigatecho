"""試験を選べる版の Google Play 画像と App Store のイベント画像。python scripts/make_store_play_events.py [URL] [--compose-only]
先に make_store_multi.py を回して store/multi/raw/ に画面がある状態にする(Play はその画面を使う)。
イベント用の介護福祉士の画面だけはここで撮る(開発サーバー npx vite --port 5191 と node scripts/use-multi.mjs が要る)。
出力:
- store/multi/play/1〜6.png 1080x1920(Play は 9:16 ちょうど。iPhone と同じ見出しで組み直す)
- store/multi/play/feature.png 1024x500
- store/multi/events/<イベント>_card.png 1920x1080 / <イベント>_details.png 1080x1920(文字は入れない。名前と説明はストアが重ねる)
アイコンは管理栄養士のアプリと同じ絵(appExam=kanri)なので、Play の 512 は exams/kanri/store/play/icon_512.png をそのまま使う。"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_store_multi as mm  # noqa: E402  撮り方(demo・press・answer_of)と見出しを同じにする
import make_screenshots as ms  # noqa: E402

APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "store", "multi")
PLAY = os.path.join(OUT, "play")
EV = os.path.join(OUT, "events")
for d in (PLAY, EV):
    os.makedirs(d, exist_ok=True)
INK, MARK, PAPER, RULE, MARGIN = ms.INK, ms.MARK, ms.PAPER, ms.RULE, ms.MARGIN
RED = (210, 64, 42)


def raw(name):
    return os.path.join(mm.RAW, name + ".png")


# ---------- 撮影(介護福祉士) ----------
def capture_kaigo():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_context(**mm.VIEW).new_page()
        # 試験を選ぶ画面(介護福祉士を選んでいる状態)
        mm.demo(pg, "kaigo")
        pg.click(".exam-switch")
        pg.wait_for_selector(".ex-list")
        pg.screenshot(path=raw("e_picker_kaigo"))
        # ホーム(苦手の数)
        mm.demo(pg, "kaigo", "&premium=1")
        pg.screenshot(path=raw("e_home_kaigo"))
        # 苦手を解いた結果
        mm.demo(pg, "kaigo", "&premium=1&warm=1")
        pg.click("text=苦手を解く")
        for i in range(30):
            pg.wait_for_selector(".choice")
            a = mm.answer_of(pg, "kaigo")
            if i == 3:
                a = [n for n in range(1, 6) if n not in a][: len(a)]
            mm.press(pg, a)
            pg.wait_for_selector(".verdict")
            if i == 3:  # 間違えた直後の解説
                pg.evaluate("() => window.scrollTo(0, 0)")
                pg.screenshot(path=raw("e_answer_kaigo"))
            pg.click(".bottom-bar .btn.primary")
            if pg.locator(".result-hero").count():
                break
        pg.wait_for_selector(".result-hero")
        pg.screenshot(path=raw("e_result_kaigo"))
        b.close()


# ---------- 共通の部品 ----------
def paper(w, h, step=80, top=100, margin_x=98):
    img = Image.new("RGB", (w, h), PAPER)
    d = ImageDraw.Draw(img)
    for y in range(top, h, step):
        d.line([(0, y), (w, y)], fill=RULE, width=3)
    d.line([(margin_x, 0), (margin_x, h)], fill=MARGIN, width=4)
    return img


def phone(img, shot_path, x, top, sw, maxh, radius=48, border=7):
    """画面を角丸の黒い縁で紙に置く(下は紙の外へ切れていく形。iPhone の写真と同じ)"""
    W, H = img.size
    shot = Image.open(shot_path).convert("RGB")
    sh = int(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    if sh > maxh:
        shot = shot.crop((0, 0, sw, maxh))
        sh = maxh
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh + 80], radius=radius, fill=255)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x + 6, top + 14, x + sw + 6, top + sh + 100], radius=radius, fill=(60, 50, 30, 60))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    base = img.convert("RGBA")
    base.alpha_composite(shadow)
    img.paste(base.convert("RGB"))
    frame = Image.new("RGB", (sw + 2 * border, sh + 2 * border), INK)
    fm = Image.new("L", frame.size, 0)
    ImageDraw.Draw(fm).rounded_rectangle([0, 0, frame.width, frame.height + 80], radius=radius + border, fill=255)
    img.paste(frame, (x - border, top - border), fm)
    img.paste(shot, (x, top), mask)


# ---------- Google Play 画面写真 1080x1920 ----------
def play_shot(n, name, title, sub):
    W, H = 1080, 1920
    img = paper(W, H)
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(ms.MINCHO, 78)
    f2 = ImageFont.truetype(ms.GOTHIC, 34)
    y = 96
    for ln in title.split("\n"):
        bb = d.textbbox((0, 0), ln, font=f1)
        w = bb[2] - bb[0]
        x = (W - w) // 2
        d.rectangle([x - 10, y + 48, x + w + 10, y + 89], fill=MARK)
        d.text((x - bb[0], y), ln, font=f1, fill=INK)
        y += 104
    bb = d.textbbox((0, 0), sub, font=f2)
    d.text(((W - (bb[2] - bb[0])) // 2, y + 12), sub, font=f2, fill=(91, 95, 105))
    top = y + 92
    sw = 820
    phone(img, raw(name), (W - sw) // 2, top, sw, H - top - 40)
    img.save(os.path.join(PLAY, f"{n}.png"))


def feature():
    W, H = 1024, 500
    img = paper(W, H, step=64, top=70, margin_x=64)
    d = ImageDraw.Draw(img)
    f_name = ImageFont.truetype(ms.MINCHO, 60)
    f_sub = ImageFont.truetype(ms.MINCHO, 46)
    f_small = ImageFont.truetype(ms.GOTHIC, 27)
    x0 = 100
    d.text((x0, 86), "ニガテ帳", font=f_name, fill=INK)
    bb = d.textbbox((x0, 86), "ニガテ帳", font=f_name)
    d.line([(bb[0] - 4, bb[3] + 12), (bb[2] + 8, bb[3] + 6)], fill=RED, width=6)
    d.text((x0, 182), "国家試験の過去問", font=f_sub, fill=INK)
    d.text((x0, 300), "管理栄養士・理学療法士・", font=f_small, fill=INK)
    d.text((x0, 344), "介護福祉士・社会福祉士の過去問", font=f_small, fill=INK)
    icon = Image.open(os.path.join(APP, "exams", "kanri", "assets", "icon.png")).convert("RGB")
    ic = icon.resize((300, 300), Image.LANCZOS)
    mask = Image.new("L", ic.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 299, 299], radius=66, fill=255)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([W - 352 + 8, 100 + 12, W - 52 + 8, 400 + 12], radius=66, fill=(60, 50, 30, 60))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    base = img.convert("RGBA")
    base.alpha_composite(shadow)
    img = base.convert("RGB")
    img.paste(ic, (W - 352, 100), mask)
    img.save(os.path.join(PLAY, "feature.png"))


# ---------- App Store イベント画像 ----------
# Apple はイベント名と短い説明を画像の下側に重ねて出すので、画像に文字は入れず、画面は上寄せに置く。
def event_card(dst, shots):
    W, H = 1920, 1080
    img = paper(W, H, step=72, top=60, margin_x=150)
    sw = 470
    gap = 70
    total = len(shots) * sw + (len(shots) - 1) * gap
    x = (W - total) // 2
    for i, s in enumerate(shots):
        top = 90 if i % 2 == 0 else 150
        phone(img, raw(s), x, top, sw, H - top, radius=34, border=6)
        x += sw + gap
    img.save(dst)


def event_details(dst, shot):
    W, H = 1080, 1920
    img = paper(W, H)
    sw = 860
    phone(img, raw(shot), (W - sw) // 2, 150, sw, H - 150)
    img.save(dst)


IPHONE = mm.IPHONE


def compose():
    for i, (name, title, sub) in enumerate(IPHONE, 1):
        play_shot(i, name, title, sub)
    feature()
    event_card(os.path.join(EV, "kaigo_added_card.png"), ["e_picker_kaigo", "e_home_kaigo", "e_answer_kaigo"])
    event_details(os.path.join(EV, "kaigo_added_details.png"), "e_picker_kaigo")
    event_card(os.path.join(EV, "kaigo39_final_card.png"), ["e_home_kaigo", "e_result_kaigo"])
    event_details(os.path.join(EV, "kaigo39_final_details.png"), "e_result_kaigo")


def check():
    want = {os.path.join(PLAY, f"{i}.png"): (1080, 1920) for i in range(1, 7)}
    want[os.path.join(PLAY, "feature.png")] = (1024, 500)
    for k in ("kaigo_added", "kaigo39_final"):
        want[os.path.join(EV, f"{k}_card.png")] = (1920, 1080)
        want[os.path.join(EV, f"{k}_details.png")] = (1080, 1920)
    for path, size in want.items():
        im = Image.open(path)
        assert im.size == size, (path, im.size)
        assert im.mode == "RGB", (path, im.mode)  # 透過なし
        lo, hi = im.convert("L").getextrema()
        assert hi - lo > 100, (path, lo, hi)
        assert os.path.getsize(path) < 8 * 1024 * 1024, path
        print(os.path.relpath(path, APP), size, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    if "--compose-only" not in sys.argv:
        capture_kaigo()
    compose()
    check()
    print("ok")
