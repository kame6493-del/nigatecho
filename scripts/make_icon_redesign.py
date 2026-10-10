"""2026-10-10 の新しいアイコン(赤いリングノートに「苦」と赤鉛筆。持ち主が用意した絵)を、iOS・Android・ストア・アプリ内に入れる。
python scripts/make_icon_redesign.py <正方形のアイコン 1024px>
- 元のファイルは store/_icon_backup/ に同じ並びで残す(1回目だけ。2回目以降は上書きしない)
- iOS: AppIcon 1024(不透明。角の外の白をカードのクリーム色で埋める)・スプラッシュ
- Android: 適応アイコン(前景=この絵・背景=なじむ単色。安全域 66% の円に絵の中身が入る大きさ)・丸・従来の四角・スプラッシュ
- ストア: store/multi/play/icon_512.png、アプリ内: src/assets/logo.png、PWA: icons/
- 確かめの絵: store/_icon_check.png(安全域の円・丸と角丸と四角で切ったときの見え方)"""
import math
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHELL = os.path.join(ROOT, "exams", "kanri")
RES = os.path.join(SHELL, "android", "app", "src", "main", "res")
XC = os.path.join(SHELL, "ios", "App", "App", "Assets.xcassets")
BACKUP = os.path.join(ROOT, "store", "_icon_backup")
CREAM = (248, 241, 228)      # アイコンのカードの色(適応アイコンの背景もこの色)
BG = (251, 246, 239)         # アプリの地の色(スプラッシュ)
SRC = sys.argv[1]


def backup(path):
    rel = os.path.relpath(path, ROOT)
    dst = os.path.join(BACKUP, rel)
    if os.path.exists(path) and not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)


def save(im, path, **kw):
    backup(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, **kw)


src = Image.open(SRC).convert("RGB").resize((1024, 1024), Image.LANCZOS)

# 1) 不透明な正方形: 角の外の白(4つの角につながる白)をクリーム色に
a = np.asarray(src).astype(float)
lum, sat = a.mean(-1), a.max(-1) - a.min(-1)
lab, _ = ndimage.label((lum > 251) & (sat < 6))
ids = {lab[0, 0], lab[0, -1], lab[-1, 0], lab[-1, -1]} - {0}
cm = ndimage.binary_dilation(np.isin(lab, list(ids)), iterations=3)
m = Image.fromarray((cm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
square = Image.composite(Image.new("RGB", src.size, CREAM), src, m)


def rounded(im, r):
    mask = Image.new("L", (im.width * 4, im.height * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, mask.width - 1, mask.height - 1], radius=r * 4, fill=255)
    mask = mask.resize(im.size, Image.LANCZOS)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


# 2) Android 適応アイコンの前景(108dp の画布。絵は中央 52%。中身は安全域 66% の円に入る)
FG_SCALE = 0.52


def foreground(px):
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    s = round(px * FG_SCALE)
    tile = rounded(square.resize((s, s), Image.LANCZOS), round(s * 0.2))
    # 縁をぼかして背景の単色になじませる
    al = tile.getchannel("A").filter(ImageFilter.GaussianBlur(max(1, s / 120)))
    tile.putalpha(al)
    canvas.alpha_composite(tile, ((px - s) // 2, (px - s) // 2))
    return canvas


def composite(px):
    bg = Image.new("RGBA", (px, px), CREAM + (255,))
    bg.alpha_composite(foreground(px))
    return bg


DENS = {"ldpi": 0.75, "mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for d, k in DENS.items():
    folder = os.path.join(RES, f"mipmap-{d}")
    leg = round(48 * k)
    fg_px = round(108 * k)
    save(foreground(fg_px), os.path.join(folder, "ic_launcher_foreground.png"))
    # 従来の四角(Android 7 以前): 角丸の絵
    save(rounded(square.resize((leg, leg), Image.LANCZOS), round(leg * 0.18)), os.path.join(folder, "ic_launcher.png"))
    # 丸: 適応アイコンの見える所(中央 72dp)を丸く切った物
    c = composite(fg_px * 4)
    v = round(fg_px * 4 * 72 / 108)
    o = (fg_px * 4 - v) // 2
    c = c.crop((o, o, o + v, o + v)).resize((leg, leg), Image.LANCZOS)
    mask = Image.new("L", (leg * 4, leg * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, leg * 4 - 1, leg * 4 - 1], fill=255)
    c.putalpha(mask.resize((leg, leg), Image.LANCZOS))
    save(c, os.path.join(folder, "ic_launcher_round.png"))
    bgp = os.path.join(folder, "ic_launcher_background.png")
    if os.path.exists(bgp):
        backup(bgp)
        os.remove(bgp)

XML = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"""
for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    p = os.path.join(RES, "mipmap-anydpi-v26", name)
    backup(p)
    open(p, "w", encoding="utf-8").write(XML)
p = os.path.join(RES, "values", "ic_launcher_background.xml")
backup(p)
open(p, "w", encoding="utf-8").write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>\n' % CREAM)


# 3) スプラッシュ(地の色の真ん中にアイコン)
def splash(w, h):
    im = Image.new("RGB", (w, h), BG)
    s = round(min(w, h) * 0.3)
    t = rounded(square.resize((s, s), Image.LANCZOS), round(s * 0.22))
    im.paste(t, ((w - s) // 2, (h - s) // 2), t)
    return im


for folder in sorted(os.listdir(RES)):
    p = os.path.join(RES, folder, "splash.png")
    if folder.startswith("drawable") and os.path.exists(p):
        w, h = Image.open(p).size
        save(splash(w, h), p)
for f in os.listdir(os.path.join(XC, "Splash.imageset")):
    if f.endswith(".png"):
        p = os.path.join(XC, "Splash.imageset", f)
        w, h = Image.open(p).size
        save(splash(w, h), p)

# 4) iOS アイコン(不透明・アルファなし)
save(square, os.path.join(XC, "AppIcon.appiconset", "AppIcon-512@2x.png"))

# 5) capacitor の素材の元・ストア・アプリ内・PWA
A = os.path.join(SHELL, "assets")
save(square, os.path.join(A, "icon.png"))
save(square, os.path.join(A, "icon-only.png"))
save(foreground(1024).convert("RGBA"), os.path.join(A, "icon-foreground.png"))
save(Image.new("RGB", (1024, 1024), CREAM), os.path.join(A, "icon-background.png"))
save(splash(2732, 2732), os.path.join(A, "splash.png"))
save(splash(2732, 2732), os.path.join(A, "splash-dark.png"))
save(square.resize((512, 512), Image.LANCZOS), os.path.join(ROOT, "store", "multi", "play", "icon_512.png"))
save(square.resize((144, 144), Image.LANCZOS), os.path.join(ROOT, "src", "assets", "logo.png"), optimize=True)
for n in (48, 72, 96, 128, 192, 256, 512):
    save(square.resize((n, n), Image.LANCZOS), os.path.join(ROOT, "icons", f"icon-{n}.webp"), quality=90)

# 6) 確かめの絵: 安全域(66% の円)に中身が入っているか・丸/角丸/四角で切った見え方
px = 432
fg = foreground(px)
al = np.asarray(fg.getchannel("A")) > 30
ys, xs = np.nonzero(al)
r_safe = px * 0.33
# 中身(クリームの縁を除いた所): 色の濃い所だけで測る
rgb = np.asarray(fg.convert("RGB")).astype(float)
dark = al & (np.abs(rgb - np.array(CREAM)).sum(-1) > 60)
ys, xs = np.nonzero(dark)
far = np.sqrt((xs - px / 2) ** 2 + (ys - px / 2) ** 2).max()
print(f"中身のいちばん外側: 中心から {far:.0f}px / 安全域の半径 {r_safe:.0f}px({'入っている' if far <= r_safe else 'はみ出す'})")
check = Image.new("RGB", (px * 4 + 50, px + 60), (90, 90, 90))
comp = composite(px)
dd = ImageDraw.Draw(comp)
dd.ellipse([px / 2 - r_safe, px / 2 - r_safe, px / 2 + r_safe, px / 2 + r_safe], outline=(0, 160, 255, 255), width=2)
check.paste(comp.convert("RGB"), (0, 0))
for i, shape in enumerate(("circle", "squircle", "square")):
    c = composite(px)
    v = round(px * 72 / 108)
    o = (px - v) // 2
    c = c.crop((o, o, o + v, o + v)).resize((px, px), Image.LANCZOS)
    mask = Image.new("L", (px, px), 0)
    if shape == "circle":
        ImageDraw.Draw(mask).ellipse([0, 0, px - 1, px - 1], fill=255)
    elif shape == "squircle":
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, px - 1, px - 1], radius=px * 0.3, fill=255)
    else:
        ImageDraw.Draw(mask).rectangle([0, 0, px - 1, px - 1], fill=255)
    check.paste(c.convert("RGB"), ((px + 10) * (i + 1), 0), mask)
check.save(os.path.join(ROOT, "store", "_icon_check.png"))
print("ok")
