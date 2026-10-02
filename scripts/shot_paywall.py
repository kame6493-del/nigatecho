"""App内課金の審査用の写真(購入画面)を iPhone の画面の寸法 1290x2796 で撮る。
python scripts/shot_paywall.py [URL] → exams/<試験>/store/iap_review.png
(ページ全体を撮ると縦の長さがまちまちになり、Apple に IMAGE_INCORRECT_DIMENSIONS で落とされた)"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5191/"
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXAM = json.load(open(os.path.join(APP, "src", "exam.current.json"), encoding="utf-8"))
OUT = os.path.join(APP, "exams", EXAM["dir"], "store", "iap_review.png")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 430, "height": 932}, device_scale_factor=3, locale="ja-JP").new_page()
    pg.goto(URL)
    pg.evaluate("() => localStorage.clear()")
    pg.goto(URL)
    pg.wait_for_selector(".unlock")
    pg.click(".unlock")
    pg.wait_for_selector(".paywall")
    pg.screenshot(path=OUT)  # 画面の大きさだけ(full_page にしない)
    b.close()

from PIL import Image
w, h = Image.open(OUT).size
print(EXAM["dir"], w, h, OUT)
assert (w, h) == (1290, 2796), (w, h)
