"""Google Play 用の画像を作る。python scripts/make_play_assets.py kanri
- icon_512.png      アイコン 512x512(App Store と同じ絵を縮める)
- feature.png       フィーチャー グラフィック 1024x500(紙の罫線に見出しとアイコン)
- play_shot_N.png   画面写真。Play は 9:16 ちょうど → 1290x2796 を縮めて左右に紙の色を足し 1080x1920 にする
出力は exams/<試験>/store/play/"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EX = sys.argv[1]
BASE = os.path.join(ROOT, "exams", EX)
OUT = os.path.join(BASE, "store", "play")
os.makedirs(OUT, exist_ok=True)

PAPERS = {"kanri": ((251, 248, 241), (226, 219, 203)), "rinsho": ((236, 242, 247), (204, 216, 228)), "pt": ((238, 245, 236), (206, 222, 202))}
NAMES = {"kanri": "管理栄養士", "rinsho": "臨床検査技師", "pt": "理学療法士"}
RANGES = {"kanri": "第36〜40回", "rinsho": "第68〜72回", "pt": "第57〜61回"}
PAPER, RULE = PAPERS[EX]
INK = (35, 38, 46)
RED = (210, 64, 42)
MARGIN = (232, 160, 148)

icon = Image.open(os.path.join(BASE, "assets", "icon.png")).convert("RGB")
icon.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "icon_512.png"))

# フィーチャー グラフィック
W, H = 1024, 500
fg = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(fg)
for y in range(70, H, 64):
    d.line([(0, y), (W, y)], fill=RULE, width=3)
d.line([(64, 0), (64, H)], fill=MARGIN, width=4)
mincho = "C:/Windows/Fonts/yumindb.ttf"
gothic = "C:/Windows/Fonts/YuGothB.ttc"
f_big = ImageFont.truetype(mincho, 58)
f_mid = ImageFont.truetype(mincho, 58)
f_small = ImageFont.truetype(gothic, 28)
x0 = 100
d.text((x0, 92), "間違えた問題だけが、", font=f_big, fill=INK)
d.text((x0, 172), "残る。", font=f_mid, fill=INK)
# 「残る。」に赤ペンの下線
bb = d.textbbox((x0, 172), "残る。", font=f_mid)
d.line([(bb[0] - 4, bb[3] + 10), (bb[2] + 8, bb[3] + 4)], fill=RED, width=6)
d.text((x0, 300), f"{NAMES[EX]} 過去問 ニガテ帳", font=f_small, fill=INK)
d.text((x0, 346), f"{RANGES[EX]} 1,000問・全問解説つき", font=f_small, fill=(90, 90, 96))
ic = icon.resize((300, 300), Image.LANCZOS)
mask = Image.new("L", ic.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 299, 299], radius=66, fill=255)
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([W - 352 + 8, 100 + 12, W - 52 + 8, 400 + 12], radius=66, fill=(60, 50, 30, 60))
fg.paste(Image.alpha_composite(fg.convert("RGBA"), shadow).convert("RGB"))
fg.paste(ic, (W - 352, 100), mask)
fg.save(os.path.join(OUT, "feature.png"))

# 画面写真
for n in range(1, 6):
    src = os.path.join(BASE, "store", f"shot_{n}.png")
    im = Image.open(src).convert("RGB")
    # Play は 9:16 ちょうどを求める → 高さ 1920 に縮め、左右を紙の色で埋めて 1080x1920
    w, h = im.size
    sw = round(w * 1920 / h)
    im = im.resize((sw, 1920), Image.LANCZOS)
    bg = Image.new("RGB", (1080, 1920), im.getpixel((2, 2)))
    bg.paste(im, ((1080 - sw) // 2, 0))
    bg.save(os.path.join(OUT, f"play_shot_{n}.png"))
print("ok", OUT, os.listdir(OUT))
