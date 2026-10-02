"""告知画像の空いた右側に、実物のアプリ画面を傾けて貼る。
python scripts/fix_promo.py <右側を空けた元画像> <出力> [試験 kanri|rinsho|pt]
(ChatGPT に描かせたアプリ画面は架空の UI だったので、右側を紙だけにしてもらい、ここで実物を貼る)"""
import sys
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
EXAM = sys.argv[3] if len(sys.argv) > 3 else "kanri"
RAW = rf"C:\Users\yuichi1\Downloads\管理栄養士国試アプリ_2026-10-01\app\exams\{EXAM}\store\raw\1_home.png"

img = Image.open(SRC).convert("RGB")
W, H = img.size  # 1672x941

# 貼る場所: 赤い丸(右端 x≒1105)と右下の行(y≒870〜)にかからない右側
AREA_X0, AREA_X1, AREA_Y0, AREA_Y1 = 1150, 1640, 34, 846

# 実物の画面(ホームの上から「本番の予想点」まで)
shot = Image.open(RAW).convert("RGB")
card_w = 440
card_h = 760
src_h = int(shot.width * card_h / card_w)
shot = shot.crop((0, 0, shot.width, min(src_h, shot.height))).resize((card_w, card_h), Image.LANCZOS)

# 角丸のカード + 薄い縁
mask = Image.new("L", (card_w, card_h), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, card_w - 1, card_h - 1], radius=26, fill=255)
framed = Image.new("RGBA", (card_w + 10, card_h + 10), (0, 0, 0, 0))
ImageDraw.Draw(framed).rounded_rectangle([0, 0, card_w + 9, card_h + 9], radius=31, fill=(214, 207, 193, 255))
framed.paste(shot, (5, 5), mask)

# 少し傾ける(元の偽の画面と同じく右へ約3度)
rot = framed.rotate(-3.0, resample=Image.BICUBIC, expand=True)
assert rot.width <= AREA_X1 - AREA_X0 + 20 and rot.height <= AREA_Y1 - AREA_Y0 + 20, rot.size

# 紙に置いた影
alpha = rot.split()[3]
shadow = Image.new("RGBA", rot.size, (70, 55, 35, 0))
shadow.putalpha(alpha.point(lambda a: int(a * 0.32)))
shadow = shadow.filter(ImageFilter.GaussianBlur(16))

x = AREA_X0 + (AREA_X1 - AREA_X0 - rot.width) // 2
y = AREA_Y0 + (AREA_Y1 - AREA_Y0 - rot.height) // 2
img.paste(shadow, (x + 12, y + 18), shadow)
img.paste(rot, (x, y), rot)
img.save(OUT)
print("ok", img.size, "card at", (x, y, x + rot.width, y + rot.height), OUT)
