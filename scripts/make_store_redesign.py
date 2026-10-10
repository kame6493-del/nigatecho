"""作り直した見た目(2026-10-10)のストアの画像。python scripts/make_store_redesign.py [URL] [--compose-only]
先に node scripts/use-multi.mjs と開発サーバー(npx vite --port 5291)。見本データ(?demo=1&exam=…)で撮る。
出力(store/multi/。前の物は store/_old_2026-10-10/ に退避済み):
- iphone/1〜6.png 1290x2796 / ipad/1〜5.png 2048x2732(App Store 用。提出はしない)
- play/1〜6.png 1080x1920・play/feature.png 1024x500(Google Play 用)
写真に値段と「無料」を入れない(1.1.0 が 2.3.7 で却下)。撮るときに画面の文字を調べ、入っていたら止める。
撮影途中の画面は store/multi/raw_redesign/(git に入れない)"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5291/")
OUT = os.path.join(APP, "store", "multi")
RAW = os.path.join(OUT, "raw_redesign")
for d in ("raw_redesign", "iphone", "ipad", "play"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
ILL = os.path.join(APP, "src", "assets", "ill")
VIEW = {"viewport": {"width": 430, "height": 932}, "device_scale_factor": 3, "locale": "ja-JP"}

BG = (251, 246, 239)
INK = (43, 37, 35)
INK2 = (100, 91, 86)
RED = (214, 56, 58)
FONT_B = "C:/Windows/Fonts/YuGothB.ttc"
FONT_M = "C:/Windows/Fonts/YuGothM.ttc"

# (撮った画面, 見出し(赤くする語は【】), 小見出し, 添える絵)
SHOTS = [
    ("home_kaigo", "わからないを、\n【できる】に変える。", "あと何問わからないかが、毎日ひと目でわかる", "bird_q"),
    ("note_kanri", "まちがえた問題が\n【苦手ノート】に残る。", "科目ごとに、残っている問題がひと目でわかる", "bird_pencil"),
    ("explain_kaigo", "全問に、\n【なぜ違うか】の解説。", "正答の理由と、ほかの選択肢の誤りを1つずつ", "girl_ok"),
    ("cleared_shakai", "2回続けて正解で、\nノートから【消える】。", "苦手が0問になれば、本番に持っていく苦手はない", "bird_party"),
    ("stats_kaigo", "本番なら【何点】か、\nひと目でわかる。", "直近の合格点と並べて、科目ごとの正答率も", "woman_cheer"),
    ("switch", "【5つの国家試験】から\n選べる。", "介護福祉士・社会福祉士・精神保健福祉士\n管理栄養士・理学療法士", None),
]
BANNED = ("無料", "¥", "円")


def raw(name):
    return os.path.join(RAW, name + ".png")


def demo(pg, exam, extra=""):
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(f"{URL}?demo=1&exam={exam}&n=420&acc=0.68&premium=1{extra}")
    pg.wait_for_selector(".home")
    pg.goto(URL)
    pg.wait_for_selector(".home")


def answer_of(pg, exam):
    return pg.evaluate("""async (dir) => {
        const src = document.querySelector('.q-src').textContent;
        const qs = await (await fetch(`./data/${dir}/questions.json`)).json();
        const m = src.match(/第(\\d+)回 (午前|午後) 問(\\d+)/);
        const q = qs.find(x => x.exam == m[1] && x.session == m[2] && x.no == m[3]); return q.accepted ? q.accepted[0] : q.answer;
    }""", exam)


def solve_right(pg, exam):
    pg.wait_for_selector(".choices .choice")
    for n in answer_of(pg, exam):
        pg.locator(".choices .choice").nth(n - 1).click()
    pg.click(".bottom-bar .btn.next")
    pg.wait_for_selector(".verdict")
    pg.evaluate("() => window.scrollTo(0, 0)")


def snap(pg, name):
    text = pg.evaluate("() => document.body.innerText")
    hit = [w for w in BANNED if w in text]
    if hit:
        raise SystemExit(f"{name}: 写真に入れない文字があります {hit}")
    pg.wait_for_timeout(300)
    pg.screenshot(path=raw(name))


def capture():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_context(**VIEW).new_page()
        demo(pg, "kaigo")
        snap(pg, "home_kaigo")
        pg.click(".tabbar button[data-tab=stats]")
        pg.wait_for_selector(".fc-score")
        snap(pg, "stats_kaigo")
        # 苦手を解く: 先頭は続けて正解した数が 0 の問題 → 正解すると「連続正解 1/2」
        pg.click(".tabbar button[data-tab=home]")
        pg.click(".home > .btn.big")
        solve_right(pg, "kaigo")
        snap(pg, "explain_kaigo")

        demo(pg, "kanri")
        pg.click(".tabbar button[data-tab=note]")
        pg.wait_for_selector(".note-items")
        snap(pg, "note_kanri")

        # warm=1: 苦手がすべて「あと1回正解で消える」状態 → 正解すると克服
        demo(pg, "shakai", "&warm=1")
        pg.click(".home > .btn.big")
        solve_right(pg, "shakai")
        snap(pg, "cleared_shakai")

        demo(pg, "kaigo")
        pg.goto(URL + "?shot=1")
        pg.wait_for_selector(".home")
        pg.click(".exam-card-main")
        pg.wait_for_selector(".ex-list")
        snap(pg, "switch")
        b.close()


def font(path, size):
    return ImageFont.truetype(path, size)


def draw_title(d, x, y, text, size, center_w=None):
    """【】で囲んだ語を赤くして、下に赤鉛筆の線を引く。行ごとに中央そろえ(center_w があるとき)"""
    f = font(FONT_B, size)
    for line in text.split("\n"):
        parts, red = [], False
        buf = ""
        for ch in line:
            if ch in "【】":
                if buf:
                    parts.append((buf, red))
                buf, red = "", ch == "【"
            else:
                buf += ch
        if buf:
            parts.append((buf, red))
        w = sum(d.textlength(t, font=f) for t, _ in parts)
        cx = x + (center_w - w) / 2 if center_w else x
        for t, r in parts:
            tw = d.textlength(t, font=f)
            if r:
                d.line([(cx + 4, y + size * 1.12), (cx + tw - 4, y + size * 1.08)], fill=(239, 140, 135), width=max(6, size // 9))
            d.text((cx, y), t, font=f, fill=RED if r else INK)
            cx += tw
        y += round(size * 1.42)
    return y


def phone(shot, w):
    """画面写真を角丸の黒い縁の中に入れる"""
    s = shot.resize((w, round(shot.height * w / shot.width)), Image.LANCZOS)
    bz = round(w * 0.028)
    fw, fh = w + bz * 2, s.height + bz * 2
    r = round(w * 0.11)
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, fw - 1, fh - 1], radius=r + bz, fill=(38, 34, 33, 255))
    m = Image.new("L", s.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, s.width - 1, s.height - 1], radius=r, fill=255)
    frame.paste(s, (bz, bz), m)
    return frame


def compose(name, title, sub, art, W, H, phone_w, title_size, top):
    im = Image.new("RGBA", (W, H), BG + (255,))
    d = ImageDraw.Draw(im)
    # 地にうすい丸(見本の背景のやわらかい光)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-W * 0.3, -H * 0.12, W * 0.7, H * 0.3], fill=(253, 228, 222, 150))
    gd.ellipse([W * 0.55, H * 0.55, W * 1.4, H * 1.15], fill=(255, 238, 214, 140))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(W * 0.08)))
    d = ImageDraw.Draw(im)
    y = draw_title(d, 0, top, title, title_size, center_w=W)
    fs = font(FONT_M, round(title_size * 0.42))
    for line in sub.split("\n"):
        tw = d.textlength(line, font=fs)
        d.text(((W - tw) / 2, y + title_size * 0.05), line, font=fs, fill=INK2)
        y += round(title_size * 0.62)
    shot = Image.open(raw(name)).convert("RGB")
    fr = phone(shot, phone_w)
    py = round(y + title_size * 0.5)
    # 影
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([(W - fr.width) / 2 + 10, py + 30, (W + fr.width) / 2 + 10, py + fr.height + 30], radius=phone_w * 0.13, fill=(110, 70, 40, 70))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(W * 0.02)))
    im.alpha_composite(fr, ((W - fr.width) // 2, py))
    # 絵は見出しや画面に重なるので、ストアの写真には置かない(画面の中にキャラクターが出ている)
    if art and False:
        a = Image.open(os.path.join(ILL, art + ".webp")).convert("RGBA")
        aw = round(W * 0.2)
        a = a.resize((aw, round(a.height * aw / a.width)), Image.LANCZOS)
        im.alpha_composite(a, (W - aw - round(W * 0.03), max(0, py - a.height + round(W * 0.02))))
    return im.convert("RGB")


def feature():
    W, H = 1024, 500
    im = Image.new("RGBA", (W, H), BG + (255,))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-200, -260, 520, 380], fill=(253, 224, 218, 170))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(60)))
    icon = Image.open(os.path.join(APP, "exams", "kanri", "assets", "icon.png")).convert("RGB").resize((236, 236), Image.LANCZOS)
    m = Image.new("L", icon.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, 235, 235], radius=52, fill=255)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([62, 140, 298, 376], radius=52, fill=(120, 60, 40, 80))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
    im.paste(icon, (54, 124), m)
    d = ImageDraw.Draw(im)
    d.text((330, 96), "わからないを、できるに変える。", font=font(FONT_M, 30), fill=INK2)
    d.text((326, 140), "ニガテ帳", font=font(FONT_B, 104), fill=RED)
    d.text((332, 262), "国家試験の過去問", font=font(FONT_B, 44), fill=INK)
    d.text((332, 330), "間違えた問題だけが残り、2回続けて正解で消える", font=font(FONT_M, 25), fill=INK2)
    x = 332
    for e in ("kaigo", "shakai", "seishin", "kanri", "pt"):
        a = Image.open(os.path.join(ILL, f"exam_{e}.webp")).convert("RGBA")
        a = a.resize((round(a.width * 74 / a.height), 74), Image.LANCZOS)
        im.alpha_composite(a, (x, 384))
        x += a.width + 26
    return im.convert("RGB")


def compose_all():
    for i, (name, title, sub, art) in enumerate(SHOTS, 1):
        compose(name, title, sub, art, 1290, 2796, 1000, 104, 150).save(os.path.join(OUT, "iphone", f"{i}.png"))
        compose(name, title, sub, art, 1080, 1920, 690, 78, 90).save(os.path.join(OUT, "play", f"{i}.png"))
        if i <= 5:
            compose(name, title, sub, art, 2048, 2732, 1010, 118, 140).save(os.path.join(OUT, "ipad", f"{i}.png"))
    feature().save(os.path.join(OUT, "play", "feature.png"))


def check_sizes():
    for dname, size, n in (("iphone", (1290, 2796), 6), ("ipad", (2048, 2732), 5)):
        for i in range(1, n + 1):
            assert Image.open(os.path.join(OUT, dname, f"{i}.png")).size == size, (dname, i)
    for i in range(1, 7):
        assert Image.open(os.path.join(OUT, "play", f"{i}.png")).size == (1080, 1920), i
    assert Image.open(os.path.join(OUT, "play", "feature.png")).size == (1024, 500)
    print("sizes ok")


if __name__ == "__main__":
    if "--compose-only" not in sys.argv:
        capture()
    compose_all()
    check_sizes()
