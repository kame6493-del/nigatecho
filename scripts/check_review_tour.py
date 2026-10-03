"""録画用の自動操作(src/dev/reviewTour.ts)が最後まで進むかを手元のブラウザで確かめる。
先に VITE_REVIEW_TOUR=1 で vite を立てておく: VITE_REVIEW_TOUR=1 npx vite --port 5199 --strictPort
python scripts/check_review_tour.py → 通った画面の見出しを順に出し、promo/review_tour_check.webm に録画を残す"""
import os
import time
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "promo")
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 393, "height": 852}, device_scale_factor=2, record_video_dir=OUT, record_video_size={"width": 393, "height": 852})
    pg = ctx.new_page()
    pg.goto("http://localhost:5199/")
    seen = []
    t0 = time.time()
    while time.time() - t0 < 110:
        txt = pg.evaluate("document.body.innerText.slice(0,60).replace(/\\s+/g,' ')")
        if not seen or seen[-1] != txt:
            seen.append(txt)
            print(round(time.time() - t0), txt)
        if "買い切り" in txt and time.time() - t0 > 30:
            time.sleep(8)
            break
        time.sleep(1)
    path = pg.video.path()
    ctx.close()
    b.close()
    os.replace(path, os.path.join(OUT, "review_tour_check.webm"))
    print("video", os.path.join(OUT, "review_tour_check.webm"))
