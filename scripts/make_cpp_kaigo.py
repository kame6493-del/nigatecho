"""App Store のカスタムプロダクトページ「介護福祉士」用の写真。python scripts/make_cpp_kaigo.py
撮影済みの store/multi/raw/ の介護福祉士の画面を使い、見出しを付けて書き出す(値段・「無料」は入れない。2.3.7)。
出力: store/multi/cpp_kaigo/iphone/1〜4.png 1290x2796 / ipad/1〜4.png 2048x2732"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_screenshots as ms  # noqa: E402
import make_store_multi as mm  # noqa: E402

OUT = os.path.join(os.path.dirname(HERE), "store", "multi", "cpp_kaigo")
SHOTS = [
    ("e_home_kaigo", "介護福祉士の過去問、\n間違えた問題だけ残る。", "第33回〜第38回の750問・全問に解説つき"),
    ("e_answer_kaigo", "事例問題も、\nなぜ違うかの解説。", "正答の理由と、ほかの選択肢の誤りを1つずつ"),
    ("4_forecast_kaigo", "本番なら何点か、\n毎日わかる。", "合格基準と並べて、科目ごとの正答率も"),
    ("e_result_kaigo", "2回続けて正解したら、\n消える。", "苦手が0問になったら、本番に持っていく苦手はない"),
]
for d in ("iphone", "ipad"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
ms.STORE = os.path.join(OUT, "iphone")
for i, (name, title, sub) in enumerate(SHOTS, 1):
    ms.compose(i, mm.raw(name), title, sub)
    os.replace(os.path.join(ms.STORE, f"shot_{i}.png"), os.path.join(ms.STORE, f"{i}.png"))
    mm.ipad(os.path.join(OUT, "iphone", f"{i}.png"), os.path.join(OUT, "ipad", f"{i}.png"))
print("ok", OUT)
