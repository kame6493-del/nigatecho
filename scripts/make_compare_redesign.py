"""見本(持ち主が用意した UI の絵)と、作り直したアプリの画面を並べる。python scripts/make_compare_redesign.py
先に scripts/e2e_redesign.py を流しておく(画面は scripts/e2e_out/redesign/430/ を使う)。
出力: docs/compare_redesign_1〜5.png(見本1枚ごと)と docs/compare_redesign_all.png(一覧)"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(os.path.expanduser("~"), "Downloads", "nigatecho_ref_{}_941x1672.png")
SHOT = os.path.join(ROOT, "scripts", "e2e_out", "redesign", "430", "{}", "{}.png")
OUT = os.path.join(ROOT, "docs")
os.makedirs(OUT, exist_ok=True)
F = ImageFont.truetype("C:/Windows/Fonts/YuGothB.ttc", 34)
FS = ImageFont.truetype("C:/Windows/Fonts/YuGothM.ttc", 26)

PAIRS = {
    1: ("ホーム・問題・解説・成績", [("kaigo", "10_home_demo", "ホーム"), ("kaigo", "02_question_picked", "問題を解く"), ("kaigo", "03_explain_wrong", "解説"), ("kaigo", "11_stats_all", "成績・予想点")]),
    2: ("ホームと試験切り替え", [("kaigo", "10_home_demo", "ホーム"), ("kaigo", "15_switch", "試験を切り替える"), ("kaigo", "13_exams", "問題一覧(年度別)"), ("kaigo", "11_stats_plan", "成績・計画(試験日・お知らせ)")]),
    3: ("問題の探し方・解き方", [("kaigo", "12_search", "問題を探す"), ("kaigo", "14_subjects", "科目別"), ("kaigo", "02_question_picked", "問題を解く"), ("kaigo", "05_result", "10問の結果")]),
    4: ("苦手ノートのしくみ", [("kaigo", "07_note", "苦手ノート"), ("kaigo", "03_explain_wrong", "間違えると 0/2"), ("kaigo", "08_note_1of2", "1回目の正解 1/2"), ("kaigo", "09_note_cleared", "2回目の正解で消える")]),
    5: ("成績・予想点・学習分析", [("kaigo", "11_stats_all", "総合"), ("kaigo", "11_stats_subjects", "科目別"), ("kaigo", "11_stats_trend", "推移"), ("kaigo", "11_stats_plan", "計画")]),
}
H = 1672
VIEW_H = 932 * 2  # 430x932 の画面(2倍)の、最初に見える高さ


def make(n):
    title, shots = PAIRS[n]
    ref = Image.open(REF.format(n)).convert("RGB")
    phones = []
    for exam, name, label in shots:
        im = Image.open(SHOT.format(exam, name)).convert("RGB")
        im = im.crop((0, 0, im.width, min(im.height, VIEW_H)))
        w = round(im.width * H / im.height)
        phones.append((im.resize((w, H), Image.LANCZOS), label))
    W = ref.width + 60 + sum(p.width + 24 for p, _ in phones) + 40
    canvas = Image.new("RGB", (W, H + 140), (236, 230, 222))
    d = ImageDraw.Draw(canvas)
    d.text((20, 20), f"見本 {n}: {title}", font=F, fill=(60, 50, 45))
    d.text((ref.width + 80, 20), "作り直したアプリ(介護福祉士・430幅・見本データ)", font=F, fill=(214, 56, 58))
    canvas.paste(ref, (20, 100))
    x = ref.width + 80
    for p, label in phones:
        canvas.paste(p, (x, 100))
        d.text((x, 100 + H + 6), label, font=FS, fill=(60, 50, 45))
        x += p.width + 24
    path = os.path.join(OUT, f"compare_redesign_{n}.png")
    canvas.save(path)
    return canvas


sheets = [make(n) for n in PAIRS]
w = max(s.width for s in sheets)
scale = 0.5
allc = Image.new("RGB", (round(w * scale), round(sum(s.height for s in sheets) * scale)), (236, 230, 222))
y = 0
for s in sheets:
    allc.paste(s.resize((round(s.width * scale), round(s.height * scale)), Image.LANCZOS), (0, y))
    y += round(s.height * scale)
allc.save(os.path.join(OUT, "compare_redesign_all.png"))
print("ok", OUT)
