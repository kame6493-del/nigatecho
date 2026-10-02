"""アイコン: ノートの紙に墨の「苦」、赤ペンの二重線で消す。
python scripts/make_icon.py → assets/icon.png(1024) と assets/icon_preview.png"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "assets")
os.makedirs(OUT, exist_ok=True)
S = 1024
PAPER = (251, 248, 241)
RULE = (226, 219, 203)
MARGIN = (232, 160, 148)
INK = (35, 38, 46)
RED = (210, 64, 42)

img = Image.new("RGB", (S, S), PAPER)
d = ImageDraw.Draw(img)

# 罫線と余白線
for y in range(150, S, 118):
    d.line([(0, y), (S, y)], fill=RULE, width=5)
d.line([(170, 0), (170, S)], fill=MARGIN, width=6)

# 墨の「苦」
font = ImageFont.truetype("C:/Windows/Fonts/yumindb.ttf", 640)
txt = "苦"
bb = d.textbbox((0, 0), txt, font=font)
w, h = bb[2] - bb[0], bb[3] - bb[1]
cx, cy = S // 2 + 40, S // 2 + 10
d.text((cx - w / 2 - bb[0], cy - h / 2 - bb[1]), txt, font=font, fill=INK)

# 赤ペンの二重線(少し右上がり・手で引いた揺れ)
layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ld = ImageDraw.Draw(layer)
rnd = random.Random(7)


def stroke(y0, tilt, width):
    pts = []
    x0, x1 = 150, 930
    for i in range(41):
        t = i / 40
        x = x0 + (x1 - x0) * t
        y = y0 - tilt * t + math.sin(t * 5.2 + y0) * 4 + rnd.uniform(-1.2, 1.2)
        pts.append((x, y))
    ld.line(pts, fill=RED + (240,), width=width, joint="curve")
    # 端を丸く
    for (x, y) in (pts[0], pts[-1]):
        ld.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=RED + (240,))


stroke(cy - 20, 46, 44)
stroke(cy + 62, 40, 40)
layer = layer.filter(ImageFilter.GaussianBlur(0.8))
img.paste(layer, (0, 0), layer)

img.save(os.path.join(OUT, "icon.png"))

# 角丸で見たときの確認用
prev = Image.new("RGBA", (S, S), (0, 0, 0, 0))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=230, fill=255)
prev.paste(img, (0, 0), mask)
board = Image.new("RGB", (S * 2 + 120, S + 80), (60, 60, 66))
board.paste(prev, (40, 40), prev)
small = prev.resize((180, 180), Image.LANCZOS)
board.paste(small, (S + 200, 120), small)
small2 = prev.resize((120, 120), Image.LANCZOS)
board.paste(small2, (S + 420, 150), small2)
board.save(os.path.join(OUT, "icon_preview.png"))
print("ok")
