"""X(@apkderete)用のアプリ宣伝投稿を作る。python promo/make_ad_posts.py → promo/ad_posts.json
3試験 × 3本。画像は exams/<試験>/store/shot_N.png(App Store の画面写真)。リンクは公開ページ(承認後は App Store に替える)。
X の重み(日本語2・URL 23)で 280 以内か確かめる。"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = "https://kame6493-del.github.io/nigatecho-site/"
EX = {
    "kanri": ("管理栄養士", "第36〜40回", "第40回", SITE, "#管理栄養士国家試験"),
    "rinsho": ("臨床検査技師", "第68〜72回", "第72回", SITE + "rinsho/", "#臨床検査技師国家試験"),
    "pt": ("理学療法士", "第57〜61回", "第61回", SITE + "pt/", "#理学療法士国家試験"),
}
TEMPLATES = [
    (1, "{name}国試の過去問アプリ「ニガテ帳」\n\n間違えた問題だけが残って、2回続けて正解すると消える。\n苦手が0になったら、本番に持っていく苦手はありません。\n\n{range}の1,000問・全問解説つき\n{link}\n{tag}"),
    (3, "{name}国試、いま受けたら何点?\n\n「ニガテ帳」は科目ごとの正答率から本番の予想点を出して、合格ラインと並べて見せます。\n\n{free}の200問は解説まで無料。広告なし・登録なし\n{link}\n{tag}"),
    (4, "どの科目で落としているか、ひと目で。\n\n{name}国試の過去問アプリ「ニガテ帳」\n・{range}の1,000問\n・全問解説\n・苦手だけを解き直す\n・買い切りで月額なし\n\n{link}\n{tag}"),
]


def weight(s):
    urls = re.findall(r"https?://\S+", s)
    rest = re.sub(r"https?://\S+", "", s)
    return 23 * len(urls) + sum(1 if ord(c) < 0x1100 else 2 for c in rest)


posts = []
for i, (shot, tpl) in enumerate(TEMPLATES):
    for ex, (name, rng, free, link, tag) in EX.items():
        text = tpl.format(name=name, range=rng, free=free, link=link, tag=tag)
        w = weight(text)
        assert w <= 280, (ex, i, w)
        img = os.path.join(ROOT, "exams", ex, "store", f"shot_{shot}.png")
        assert os.path.exists(img), img
        posts.append({"key": f"{ex}-{i + 1}", "exam": ex, "text": text, "image": img, "weight": w})
# 試験が続かないように並べる(テンプレ順 × 試験順)
json.dump(posts, open(os.path.join(HERE, "ad_posts.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for p in posts:
    print(p["key"], p["weight"], round(os.path.getsize(p["image"]) / 1e6, 2), "MB")
