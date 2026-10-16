"""臨床検査技師の単体のアプリのアイコンの元を、まとめ版の新しいアイコン(store/icon_source_2026-10-10.png)から作る。
新しく絵は描かない。赤いリングノートの「苦」はそのままにして、
- クリームの紙と外側の地を淡い青に替える(赤と鉛筆はそのまま)
- 下の赤い線の所に「臨床検査」の札を置く
python scripts/make_icon_source_rinsho.py → store/icon_source_rinsho.png"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(ROOT, "store", "icon_source_2026-10-10.png")).convert("RGB").resize((1024, 1024), Image.LANCZOS)
a = np.asarray(src).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = a.mean(-1)
sat = a.max(-1) - a.min(-1)

# クリームの所(紙と外側の地。どちらも同じクリーム)を、明るさを保ったまま淡い青へ。
# 赤(ノート・字・鉛筆)と鉛筆の木の色(彩度が高い)は変えない。影の濃淡は残る
w = np.clip((80 - sat) / 30, 0, 1) * np.clip((70 - (r - g)) / 20, 0, 1)
L = (0.30 * r + 0.59 * g + 0.11 * b)[..., None]
tint = np.array([0.905, 0.955, 0.985])
recol = (L * tint + np.array([0, 0, 6])).clip(0, 255)
m = w[..., None]
out = a * (1 - m) + recol * m
# 札の下になる赤い線(鉛筆の手前まで)を紙の色で消す。はみ出た線が札の縁から見えないように
box = (slice(760, 925), slice(210, 738))
sub = out[box]
red = (sub[..., 0] - sub[..., 1]) > 25
# 「苦」の下の端も箱に入る。字の下の縁と線の上の縁のあいだ(右下がりの斜めの線)より下の赤だけ消す
yy, xx = np.mgrid[760:925, 210:738]
sep = 818 - (xx - 350) * 52 / 350
red = red & (yy > sep)
red = ndimage.binary_dilation(red, iterations=3)
paper = np.median(out[735:760, 255:300].reshape(-1, 3), axis=0)
sub[red] = paper
out[box] = sub
im = Image.fromarray(out.astype(np.uint8))

# 下の赤い線の上に「臨床検査」の札
d = ImageDraw.Draw(im)
x0, y0, x1, y1 = 236, 806, 716, 912
sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
ImageDraw.Draw(sh).rounded_rectangle([x0 + 4, y0 + 8, x1 + 4, y1 + 8], radius=56, fill=(20, 60, 80, 70))
sh = sh.filter(ImageFilter.GaussianBlur(8))
im = im.convert("RGBA")
im.alpha_composite(sh)
# 札と字は4倍で描いて縮める(縁のぎざぎざを出さない)
K = 4
layer = Image.new("RGBA", (im.width * K, im.height * K), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
d.rounded_rectangle([x0 * K, y0 * K, x1 * K, y1 * K], radius=56 * K, fill=(24, 104, 134, 255))
font = ImageFont.truetype("C:/Windows/Fonts/YuGothB.ttc", 78 * K)
t = "臨床検査"
bb = d.textbbox((0, 0), t, font=font)
tw, th = bb[2] - bb[0], bb[3] - bb[1]
d.text(((x0 + x1) / 2 * K - tw / 2 - bb[0], (y0 + y1) / 2 * K - th / 2 - bb[1]), t, font=font, fill=(255, 255, 255, 255))
im.alpha_composite(layer.resize(im.size, Image.LANCZOS))
out_path = os.path.join(ROOT, "store", "icon_source_rinsho.png")
im.convert("RGB").save(out_path)
print(out_path)
