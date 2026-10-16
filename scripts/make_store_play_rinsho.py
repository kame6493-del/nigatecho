"""臨床検査技師の単体のアプリ(jp.nigatecho.rinshokensa 1.1.0)の Google Play 用の画像。
python scripts/make_store_play_rinsho.py [URL] [--compose-only]
先に node scripts/use-multi.mjs exams/multi.rinsho.json で組み、開発サーバー(npx vite --port 5297)を出しておく。見本データと疑似購入は開発サーバーでだけ動く(ビルドした物では動かない)。
見本データ(?demo=1&exam=rinsho)で撮る。型は make_store_redesign.py(まとめ版)と同じ:
罫線の白い紙(リング・しおりつき)に見出しを置き、その下に黒い縁の電話の画面。
地は赤い表紙ではなく、このアプリの地(淡い青 #edf4f8 の方眼)に合わせた淡い青の方眼にする(生成り・ベージュの無地にしない)。
出力(store/play_rinsho/):
- 1〜6.png 1080x1920(携帯電話のスクリーンショット)
- feature_1024x500.png(フィーチャー グラフィック)
- icon_512.png(アプリに入れたアイコン exams/rinsho/store/play/icon_512.png と同じ物。元は store/icon_source_rinsho.png)
写真に値段・「無料」・購入画面を入れない。撮るときに画面の文字を調べ、入っていたら止める。
撮影途中の画面は store/play_rinsho/raw/(git に入れない)"""
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:5297/")
OUT = os.path.join(APP, "store", "play_rinsho")
RAW = os.path.join(OUT, "raw")
os.makedirs(RAW, exist_ok=True)
ILL = os.path.join(APP, "src", "assets", "ill")
VIEW = {"viewport": {"width": 430, "height": 932}, "device_scale_factor": 3, "locale": "ja-JP"}
EXAM = "rinsho"

BG = (226, 237, 245)         # 地: アプリの淡い青より少し濃く(画面の地と見分けがつくように)
GRID = (205, 222, 236)       # 方眼の線
GRID2 = (190, 210, 228)      # 5目ごとの線
PAGE = (255, 255, 255)
RULE_C = (196, 214, 232)
MARGIN_C = (236, 150, 150)
RING = (58, 58, 62)
INK = (36, 30, 30)
INK2 = (84, 84, 92)
RED = (196, 34, 42)
TEAL = (28, 98, 128)         # アイコンの「臨床検査」の札の色
SHADOW = (20, 40, 70)
FONT_H = "C:/Windows/Fonts/HGRGE.TTC"
FONT_M = "C:/Windows/Fonts/YuGothM.ttc"
FONT_B = "C:/Windows/Fonts/YuGothB.ttc"

# (撮った画面, 見出し(赤くする語は【】), 小見出し)
SHOTS = [
    ("home", "わからないを、\n【できる】に変える。", "あと何問わからないかが、毎日ひと目でわかる"),
    ("question", "臨床検査技師の\n過去問を【1問ずつ】。", "第68回〜第72回の5回分から出題"),
    ("explain", "全問に、\n【なぜ違うか】の解説。", "正答の理由と、ほかの選択肢の誤りを1つずつ"),
    ("note", "まちがえた問題が\n【苦手ノート】に残る。", "2回続けて正解すると、ノートから消える"),
    ("stats", "本番なら【何点】か、\nひと目でわかる。", "合格の線と並べて、科目ごとの正答率も"),
    ("plan", "試験日までの\n【1日の目安】を出す。", "苦手とまだ解いていない問題を、試験日までに終える数"),
]
BANNED = ("無料", "¥", "円", "完全版", "買い切り", "月額", "購入")


def raw(name):
    return os.path.join(RAW, name + ".png")


def demo(pg, extra=""):
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(f"{URL}?demo=1&exam={EXAM}&n=420&acc=0.68&premium=1{extra}")
    pg.wait_for_selector(".home")
    # 単体のアプリでは完全版の見本の鍵が 'nigatecho.mockFull'(billing.ts の mockKey。demo.ts は kanri のときだけこの鍵を使う)
    pg.evaluate("() => localStorage.setItem('nigatecho.mockFull', '1')")
    pg.goto(URL)
    pg.wait_for_selector(".home")


def info_of(pg):
    return pg.evaluate("""async (dir) => {
        const src = document.querySelector('.q-src').textContent;
        const qs = await (await fetch(`./data/${dir}/questions.json`)).json();
        const m = src.match(/第(\\d+)回 (午前|午後) 問(\\d+)/);
        const q = qs.find(x => x.exam == m[1] && x.session == m[2] && x.no == m[3]);
        return { ans: q.accepted ? q.accepted[0] : q.answer, pick: q.pick || 1, text: q.text || q.question || '' };
    }""", EXAM)


def snap(pg, name):
    text = pg.evaluate("() => document.body.innerText")
    hit = [w for w in BANNED if w in text]
    if hit:
        raise SystemExit(f"{name}: 写真に入れない文字があります {hit}")
    pg.wait_for_timeout(400)
    pg.screenshot(path=raw(name))


def capture():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_context(**VIEW).new_page()
        demo(pg)
        snap(pg, "home")
        pg.click(".tabbar button[data-tab=stats]")
        pg.wait_for_selector(".fc-score")
        snap(pg, "stats")
        pg.click(".seg-tabs button[data-stab=plan]")
        pg.wait_for_timeout(300)
        snap(pg, "plan")
        pg.click(".tabbar button[data-tab=note]")
        pg.wait_for_selector(".note-items")
        snap(pg, "note")

        # 問題: 苦手を解く → 1つ選ぶ問題で正答を選んだところ。答え合わせ後の解説
        pg.click(".tabbar button[data-tab=home]")
        pg.click(".home > .btn.big")
        for _ in range(30):
            pg.wait_for_selector(".choices .choice")
            info = info_of(pg)
            if info["pick"] == 1 and pg.locator(".choices .choice").count() == 5:
                break
            # 2つ選ぶ問題などは飛ばす(答えて次へ)
            for n in info["ans"]:
                pg.locator(".choices .choice").nth(n - 1).click()
            pg.click(".bottom-bar .btn.next")
            pg.wait_for_selector(".verdict")
            pg.click(".bottom-bar .btn.next")
        for n in info["ans"]:
            pg.locator(".choices .choice").nth(n - 1).click()
        pg.evaluate("() => window.scrollTo(0, 0)")
        snap(pg, "question")
        pg.click(".bottom-bar .btn.next")
        pg.wait_for_selector(".verdict")
        pg.evaluate("() => window.scrollTo(0, 0)")
        snap(pg, "explain")
        b.close()


def font(path, size):
    return ImageFont.truetype(path, size)


def grid_bg(W, H, step=None):
    """淡い青の方眼(アプリの地に合わせる)。5目ごとに少し濃い線"""
    step = step or max(24, round(min(W, H) * 0.04))
    im = Image.new("RGBA", (W, H), BG + (255,))
    d = ImageDraw.Draw(im)
    lw = max(1, round(min(W, H) * 0.0016))
    for i, x in enumerate(range(0, W, step)):
        d.line([(x, 0), (x, H)], fill=GRID2 if i % 5 == 0 else GRID, width=lw)
    for i, y in enumerate(range(0, H, step)):
        d.line([(0, y), (W, y)], fill=GRID2 if i % 5 == 0 else GRID, width=lw)
    return im


def draw_title(d, y, text, size, center_w, x0):
    f = font(FONT_H, size)
    for line in text.split("\n"):
        parts, red, buf = [], False, ""
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
        cx = x0 + (center_w - w) / 2
        for t, r in parts:
            d.text((cx, y), t, font=f, fill=RED if r else INK)
            cx += d.textlength(t, font=f)
        y += round(size * 1.42)
    return y


def phone(shot, w):
    s = shot.resize((w, round(shot.height * w / shot.width)), Image.LANCZOS)
    bz = round(w * 0.028)
    fw, fh = w + bz * 2, s.height + bz * 2
    r = round(w * 0.11)
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, fw - 1, fh - 1], radius=r + bz, fill=(38, 38, 42, 255))
    m = Image.new("L", s.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, s.width - 1, s.height - 1], radius=r, fill=255)
    frame.paste(s, (bz, bz), m)
    return frame


def page_card(im, box, rule_step, rings=True, ribbon=True):
    """白い罫線の紙(左にリング、右上に赤いしおり)。返り値は紙の左の赤い縦線の位置(紙の中の x)"""
    W, H = im.size
    x0, y0, x1, y1 = [round(v) for v in box]
    r = round(min(W, H) * 0.012) + 4
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x0 + 6, y0 + 14, x1 + 6, y1 + 18], radius=r, fill=SHADOW + (70,))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(max(6, min(W, H) * 0.012))))
    pg = Image.new("RGBA", (x1 - x0, y1 - y0), PAGE + (255,))
    pd = ImageDraw.Draw(pg)
    lw = max(2, round(min(W, H) * 0.0018))
    for y in range(round(rule_step * 1.2), pg.height - round(rule_step * 0.3), rule_step):
        pd.line([(0, y), (pg.width, y)], fill=RULE_C, width=lw)
    mx = round(pg.width * 0.085) if rings else round(pg.width * 0.05)
    pd.line([(mx, 0), (mx, pg.height)], fill=MARGIN_C, width=lw + 1)
    m = Image.new("L", pg.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, pg.width - 1, pg.height - 1], radius=r, fill=255)
    im.paste(pg, (x0, y0), m)
    d = ImageDraw.Draw(im)
    u = min(W, H)
    if ribbon:
        rw = round(u * 0.045)
        rx = x1 - round((x1 - x0) * 0.09)
        rl = round((y1 - y0) * 0.34)
        d.polygon([(rx, y0 - round(rw * 0.3)), (rx + rw, y0 - round(rw * 0.3)), (rx + rw, y0 + rl),
                   (rx + rw / 2, y0 + rl - rw * 0.45), (rx, y0 + rl)], fill=(196, 40, 46))
    if rings:
        hr = round(u * 0.011)
        n = max(2, round((y1 - y0) / (u * 0.085)))
        gap = (y1 - y0) / (n + 1)
        hx = x0 + round((x1 - x0) * 0.04)
        for i in range(1, n + 1):
            cy = round(y0 + gap * i)
            rw2 = round(u * 0.05)
            d.rounded_rectangle([hx - rw2, cy - round(hr * 1.7), hx + round(hr * 0.4), cy + round(hr * 0.5)],
                                radius=round(hr * 1.2), outline=RING, width=max(4, round(u * 0.007)))
            d.ellipse([hx - hr, cy - hr, hx + hr, cy + hr], fill=(150, 165, 180))
    return mx


def put_phone(im, fr, x, y):
    W, H = im.size
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x + 8, y + 24, x + fr.width + 8, y + fr.height + 24], radius=fr.width * 0.13, fill=SHADOW + (110,))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(min(W, H) * 0.018)))
    im.alpha_composite(fr, (x, y))


def compose(name, title, sub, W=1080, H=1920, phone_w=690, title_size=78, top=90):
    im = grid_bg(W, H)
    inner_w = round(W * 0.9 * 0.78)
    probe = ImageDraw.Draw(im)
    while title_size > 40 and max(probe.textlength(ln.replace("【", "").replace("】", ""), font=font(FONT_H, title_size))
                                  for ln in title.split("\n")) > inner_w:
        title_size -= 2
    nl = title.count("\n") + 1
    sub_lines = sub.split("\n")
    th = round(title_size * 1.42) * nl
    sh_ = round(title_size * 0.62) * len(sub_lines)
    px0, px1 = round(W * 0.05), round(W * 0.95)
    py0 = round(top * 0.55)
    py1 = top + th + sh_ + round(title_size * 0.45)
    page_card(im, (px0, py0, px1, py1), rule_step=round(title_size * 0.71))
    d = ImageDraw.Draw(im)
    inner_x0 = px0 + round((px1 - px0) * 0.105)
    y = draw_title(d, top, title, title_size, inner_w, inner_x0)
    ss = round(title_size * 0.42)
    while ss > 20 and max(d.textlength(ln, font=font(FONT_M, ss)) for ln in sub_lines) > inner_w * 0.96:
        ss -= 1
    fs = font(FONT_M, ss)
    for line in sub_lines:
        tw = d.textlength(line, font=fs)
        d.text((inner_x0 + (inner_w - tw) / 2, y + title_size * 0.05), line, font=fs, fill=INK2)
        y += round(title_size * 0.62)
    fr = phone(Image.open(raw(name)).convert("RGB"), phone_w)
    put_phone(im, fr, (W - fr.width) // 2, round(py1 + title_size * 0.75))
    return im.convert("RGB")


def main_part(a):
    """絵のまわりに散っている小さな点を除き、いちばん大きなかたまりだけを残して切り抜く"""
    from scipy import ndimage
    al = np.asarray(a.getchannel("A")) > 20
    lab, n = ndimage.label(ndimage.binary_dilation(al, iterations=3))
    if n > 1:
        big = np.argmax(ndimage.sum(al, lab, range(1, n + 1))) + 1
        arr = np.asarray(a).copy()
        arr[..., 3] = np.where(lab == big, arr[..., 3], 0)
        a = Image.fromarray(arr)
    return a.crop(a.getbbox())


def feature():
    W, H = 1024, 500
    im = grid_bg(W, H, step=25)
    icon = Image.open(os.path.join(APP, "exams", EXAM, "store", "play", "icon_512.png")).convert("RGB").resize((220, 220), Image.LANCZOS)
    m = Image.new("L", icon.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, 219, 219], radius=48, fill=255)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([46, 152, 266, 372], radius=48, fill=SHADOW + (110,))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
    im.paste(icon, (38, 140), m)
    mx = page_card(im, (300, 34, 990, 466), rule_step=44, ribbon=True)
    d = ImageDraw.Draw(im)
    x = 300 + mx + 26
    d.text((x, 62), "わからないを、できるに変える。", font=font(FONT_M, 26), fill=INK2)
    d.text((x - 4, 100), "ニガテ帳", font=font(FONT_H, 100), fill=RED)
    d.text((x, 222), "臨床検査技師の過去問", font=font(FONT_H, 44), fill=TEAL)
    d.text((x, 290), "間違えた問題だけが残り、2回続けて正解で消える", font=font(FONT_M, 22), fill=INK2)
    d.text((x, 330), "第68回〜第72回・全問に解説つき", font=font(FONT_M, 22), fill=INK2)
    # アプリの中の絵(ひよこ・チューリップ)を右下に
    xr = 960
    for n, h in (("tulip", 84), ("bird_pencil", 100)):
        a = main_part(Image.open(os.path.join(ILL, f"{n}.webp")).convert("RGBA"))
        a = a.resize((round(a.width * h / a.height), h), Image.LANCZOS)
        xr -= a.width
        im.alpha_composite(a, (xr, 450 - h))
        xr -= 14
    return im.convert("RGB")


def compose_all():
    for i, (name, title, sub) in enumerate(SHOTS, 1):
        compose(name, title, sub).save(os.path.join(OUT, f"{i}.png"))
    feature().save(os.path.join(OUT, "feature_1024x500.png"))
    shutil.copyfile(os.path.join(APP, "exams", EXAM, "store", "play", "icon_512.png"), os.path.join(OUT, "icon_512.png"))


def check_sizes():
    for i in range(1, 7):
        assert Image.open(os.path.join(OUT, f"{i}.png")).size == (1080, 1920), i
    assert Image.open(os.path.join(OUT, "feature_1024x500.png")).size == (1024, 500)
    assert Image.open(os.path.join(OUT, "icon_512.png")).size == (512, 512)
    print("sizes ok")


if __name__ == "__main__":
    if "--compose-only" not in sys.argv:
        capture()
    compose_all()
    check_sizes()
