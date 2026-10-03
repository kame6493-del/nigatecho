"""App Review 用の録画を整える。python scripts/trim_review_video.py
購入のサインイン画面(下半分が暗くなる)が出てから8秒後で切り、幅 600 に縮めて promo/review_video/<試験>.mp4 に書く。"""
import os
import subprocess
from PIL import Image, ImageStat

D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "promo", "review_video")


def frame(src, t, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t}", "-i", src, "-frames:v", "1", "-vf", "scale=120:-1", out], check=True)
    return Image.open(out).convert("L")


for ex in ("kanri", "rinsho", "pt"):
    src = os.path.join(D, ex, f"review-{ex}.mp4")
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).decode().strip())
    tmp = os.path.join(D, ex, "probe.png")
    t_sheet = None
    for t in range(40, int(dur)):
        im = frame(src, t, tmp)
        w, h = im.size
        bottom = ImageStat.Stat(im.crop((0, int(h * 0.65), w, h))).mean[0]
        if bottom < 90:  # 明るい紙色(約245)から暗いキーボード面に変わった
            t_sheet = t
            break
    end = min(dur, (t_sheet or dur) + 8)
    out = os.path.join(D, f"{ex}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-t", f"{end}", "-vf", "scale=600:-2,fps=30",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", out], check=True)
    print(ex, "sheet at", t_sheet, "end", round(end, 1), "size", round(os.path.getsize(out) / 1e6, 2), "MB")
