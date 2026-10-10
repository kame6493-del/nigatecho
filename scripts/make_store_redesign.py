"""作り直した見た目(2026-10-10)のストアの画像。python scripts/make_store_redesign.py [URL] [--compose-only]
先に node scripts/use-multi.mjs と開発サーバー(npx vite --port 5291)。見本データ(?demo=1&exam=…)で撮る。
出力(store/multi/。前の物は store/_old_2026-10-10/ に退避済み):
- iphone/1〜6.png 1290x2796 / ipad/1〜5.png 2048x2732(App Store 用。提出はしない)
- play/1〜6.png 1080x1920・play/feature.png 1024x500(Google Play 用)
写真に値段と「無料」を入れない(1.1.0 が 2.3.7 で却下)。撮るときに画面の文字を調べ、入っていたら止める。
撮影途中の画面は store/multi/raw_redesign/(git に入れない)
2026-10-10 持ち主「Claude 特有の背景をなくして」: 生成りの無地+うすい丸をやめ、赤いノートの表紙(布目)の地に
白い罫線の紙(リング・しおりつき)を重ね、その上に見出しを置く。見出しは HGゴシックE。前の物は store/_cream_backup_2026-10-10/。
同じ地で App Store のカスタムプロダクトページ(介護福祉士 cpp_kaigo/)とイベント画像(events/)も作る(--compose-only で撮影なし)"""
import os
import sys

import numpy as np

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

COVER = (178, 36, 42)       # ノートの表紙の赤(アイコンの赤に合わせる)
PAGE = (255, 255, 255)       # 紙は白(生成りにしない)
RULE_C = (196, 214, 232)     # 罫線(うすい青)
MARGIN_C = (236, 150, 150)   # 左の赤い縦線
RING = (58, 58, 62)
INK = (36, 30, 30)
INK2 = (92, 84, 84)
RED = (196, 34, 42)
FONT_H = "C:/Windows/Fonts/HGRGE.TTC"   # 見出し: HGゴシックE(ほかのアプリと書体を分ける)
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


def draw_title(d, x, y, text, size, center_w=None, x0=0):
    """【】で囲んだ語を赤くする(線は引かない)。行ごとに中央そろえ(center_w があるとき)"""
    f = font(FONT_H, size)
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
        cx = x0 + (center_w - w) / 2 if center_w else x
        for t, r in parts:
            tw = d.textlength(t, font=f)
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


def cover(W, H, seed=7):
    """赤いノートの表紙: 布目(細かい縦横の筋)と、ふちを少し暗く"""
    rng = np.random.default_rng(seed)
    base = np.zeros((H, W, 3), np.float32) + np.array(COVER, np.float32)
    n = rng.normal(0, 1, (H, W)).astype(np.float32)
    rows = rng.normal(0, 1, (H, 1)).astype(np.float32)
    cols = rng.normal(0, 1, (1, W)).astype(np.float32)
    base += (n * 5 + rows * 4 + cols * 4)[..., None]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.45) / (H * 0.62)) ** 2)
    base *= (1 - np.clip(r - 0.55, 0, 1) * 0.45)[..., None]
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGBA")


def page_card(im, box, rule_step, rings=True, ribbon=True):
    """白い罫線の紙を表紙の上に置く(左にリング、右上にしおり)。返り値は紙の左の赤い縦線の位置(紙の中の x)"""
    W, H = im.size
    x0, y0, x1, y1 = [round(v) for v in box]
    r = round(min(W, H) * 0.012) + 4
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x0 + 6, y0 + 14, x1 + 6, y1 + 18], radius=r, fill=(40, 0, 0, 120))
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
                   (rx + rw / 2, y0 + rl - rw * 0.45), (rx, y0 + rl)], fill=(150, 22, 30))
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
            d.ellipse([hx - hr, cy - hr, hx + hr, cy + hr], fill=(110, 20, 26))  # 穴(リングが入っていく)
    return mx


def put_phone(im, fr, x, y):
    W, H = im.size
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x + 8, y + 24, x + fr.width + 8, y + fr.height + 24], radius=fr.width * 0.13, fill=(30, 0, 0, 140))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(min(W, H) * 0.018)))
    im.alpha_composite(fr, (x, y))


def compose(name, title, sub, art, W, H, phone_w, title_size, top):
    im = cover(W, H)
    # 見出しは紙の内側(リングとしおりを避けた幅)に収まるまで小さくする
    inner_w = round(W * 0.9 * 0.78)
    probe = ImageDraw.Draw(im)
    while title_size > 40 and max(probe.textlength(ln.replace("【", "").replace("】", ""), font=font(FONT_H, title_size))
                                  for ln in title.split("\n")) > inner_w:
        title_size -= 2
    # 見出しと添え書きの高さを先に測って、紙の大きさを決める
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
    y = draw_title(d, 0, top, title, title_size, center_w=inner_w, x0=inner_x0)
    ss = round(title_size * 0.42)
    while ss > 20 and max(d.textlength(ln, font=font(FONT_M, ss)) for ln in sub_lines) > inner_w * 0.96:
        ss -= 1
    fs = font(FONT_M, ss)
    for line in sub_lines:
        tw = d.textlength(line, font=fs)
        d.text((inner_x0 + (inner_w - tw) / 2, y + title_size * 0.05), line, font=fs, fill=INK2)
        y += round(title_size * 0.62)
    shot = Image.open(raw(name)).convert("RGB")
    fr = phone(shot, phone_w)
    py = round(py1 + title_size * 0.75)
    put_phone(im, fr, (W - fr.width) // 2, py)
    return im.convert("RGB")


def feature():
    W, H = 1024, 500
    im = cover(W, H)
    icon = Image.open(os.path.join(APP, "exams", "kanri", "assets", "icon.png")).convert("RGB").resize((220, 220), Image.LANCZOS)
    m = Image.new("L", icon.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, 219, 219], radius=48, fill=255)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([46, 152, 266, 372], radius=48, fill=(30, 0, 0, 150))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
    im.paste(icon, (38, 140), m)
    mx = page_card(im, (300, 34, 990, 466), rule_step=44, ribbon=True)
    d = ImageDraw.Draw(im)
    x = 300 + mx + 26
    d.text((x, 62), "わからないを、できるに変える。", font=font(FONT_M, 26), fill=INK2)
    d.text((x - 4, 100), "ニガテ帳", font=font(FONT_H, 100), fill=RED)
    d.text((x, 222), "国家試験の過去問", font=font(FONT_H, 44), fill=INK)
    d.text((x, 290), "間違えた問題だけが残り、2回続けて正解で消える", font=font(FONT_M, 22), fill=INK2)
    for e in ("kaigo", "shakai", "seishin", "kanri", "pt"):
        a = Image.open(os.path.join(ILL, f"exam_{e}.webp")).convert("RGBA")
        a = a.resize((round(a.width * 76 / a.height), 76), Image.LANCZOS)
        im.alpha_composite(a, (x, 354))
        x += a.width + 28
    return im.convert("RGB")


# ---------- App Store のカスタムプロダクトページ(介護福祉士)・イベント画像 ----------
# 前は古い見た目の画面(store/multi/raw/)で作っていた。今の見た目の画面(raw_redesign)で作り直す。
# 前のイベント画像には値段の映る試験選びの画面が入っていたので、値段の無い今の画面に替えた(2.3.7)。
CPP = [
    ("home_kaigo", "介護福祉士の過去問、\n【間違えた問題】だけ残る。", "第33回〜第38回の750問・全問に解説つき"),
    ("explain_kaigo", "事例問題も、\n【なぜ違うか】の解説。", "正答の理由と、ほかの選択肢の誤りを1つずつ"),
    ("stats_kaigo", "本番なら【何点】か、\n毎日わかる。", "合格基準と並べて、科目ごとの正答率も"),
    ("cleared_shakai", "2回続けて正解したら、\n【消える】。", "苦手が0問になったら、本番に持っていく苦手はない"),
]


def phone_top(im, name, x, top, sw, maxh):
    """イベント画像用: 画面を上寄せに置き、下は画像の外へ切る"""
    fr = phone(Image.open(raw(name)).convert("RGB"), sw)
    if fr.height > maxh:
        fr = fr.crop((0, 0, fr.width, maxh))
    put_phone(im, fr, x, top)


def event_card(dst, shots):
    # Apple がイベント名と説明を下側に重ねるので文字は入れない
    W, H = 1920, 1080
    im = cover(W, H)
    sw, gap = 440, 90
    x = (W - (len(shots) * (sw + round(sw * 0.056)) + (len(shots) - 1) * gap)) // 2
    for i, s in enumerate(shots):
        top = 80 if i % 2 == 0 else 150
        phone_top(im, s, x, top, sw, H - top)
        x += sw + round(sw * 0.056) + gap
    im.convert("RGB").save(dst)


def event_details(dst, shot):
    W, H = 1080, 1920
    im = cover(W, H)
    sw = 820
    phone_top(im, shot, (W - sw - round(sw * 0.056)) // 2, 150, sw, H - 150)
    im.convert("RGB").save(dst)


def compose_extra():
    cpp = os.path.join(OUT, "cpp_kaigo")
    for d in ("iphone", "ipad"):
        os.makedirs(os.path.join(cpp, d), exist_ok=True)
    for i, (name, title, sub) in enumerate(CPP, 1):
        compose(name, title, sub, None, 1290, 2796, 1000, 104, 150).save(os.path.join(cpp, "iphone", f"{i}.png"))
        compose(name, title, sub, None, 2048, 2732, 1010, 118, 140).save(os.path.join(cpp, "ipad", f"{i}.png"))
    ev = os.path.join(OUT, "events")
    event_card(os.path.join(ev, "kaigo_added_card.png"), ["switch", "home_kaigo", "explain_kaigo"])
    event_details(os.path.join(ev, "kaigo_added_details.png"), "switch")
    event_card(os.path.join(ev, "kaigo39_final_card.png"), ["home_kaigo", "cleared_shakai"])
    event_details(os.path.join(ev, "kaigo39_final_details.png"), "cleared_shakai")


def compose_all():
    for i, (name, title, sub, art) in enumerate(SHOTS, 1):
        compose(name, title, sub, art, 1290, 2796, 1000, 104, 150).save(os.path.join(OUT, "iphone", f"{i}.png"))
        compose(name, title, sub, art, 1080, 1920, 690, 78, 90).save(os.path.join(OUT, "play", f"{i}.png"))
        if i <= 5:
            compose(name, title, sub, art, 2048, 2732, 1010, 118, 140).save(os.path.join(OUT, "ipad", f"{i}.png"))
    feature().save(os.path.join(OUT, "play", "feature.png"))
    compose_extra()


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
