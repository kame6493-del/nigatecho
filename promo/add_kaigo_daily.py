"""今日の1問(X)の下書きに介護福祉士 第38回を足す。python promo/add_kaigo_daily.py [件数]
本文は問題と選択肢(原文のまま)+出典。返信は正答・解説の要点・1問ページのリンク。X の280(日本語は2)に収まる問題だけを選ぶ。"""
import json
import os
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 10
SITE = r"C:\Users\yuichi1\Downloads\カチマケ_2026-09-30\app-ads-site\q\kaigo\38"
p = os.path.join(APP, "promo", "daily_questions.json")
d = json.load(open(p, encoding="utf-8"))
have = {x["id"] for x in d if x["exam"] == "kaigo"}
qs = json.load(open(os.path.join(APP, "public", "data", "kaigo", "questions.json"), encoding="utf-8"))


def w(s):
    return sum(1 if ord(c) < 0x1100 else 2 for c in s)


added = 0
for q in qs:
    if added >= N:
        break
    if q["exam"] != 38 or q.get("figure") or q.get("excluded") or q["id"] in have or len(q["answer"]) != 1:
        continue
    if not os.path.exists(os.path.join(SITE, q["id"], "index.html")):
        continue
    src = f"社会福祉振興・試験センター 第38回介護福祉士国家試験 {q['session']} 問{q['no']}"
    post = "【今日の1問】介護福祉士\n" + q["stem"].strip() + "\n" + "\n".join(f"{i} {c}" for i, c in enumerate(q["choices"], 1)) \
        + f"\n\n{src}\n答えはリプ欄で\n#介護福祉士国家試験"
    if w(post) > 280:
        continue
    a = q["answer"][0]
    lines = [l for l in q["explanation"].split("\n") if l.strip()]
    head = lines[0].split(":", 1)[-1].strip() if lines else ""
    url = f"https://kame6493-del.github.io/q/kaigo/38/{q['id']}/"
    reply = f"正答 {a} {q['choices'][a - 1]}\n{head}"
    while w(reply + "\n\n選択肢ごとの解説と、ほかの問題▼\n") + 23 > 280 and len(head) > 20:
        head = head[:-5] + "…"
        reply = f"正答 {a} {q['choices'][a - 1]}\n{head}"
    reply += f"\n\n選択肢ごとの解説と、ほかの問題▼\n{url}"
    d.append({"exam": "kaigo", "id": q["id"], "subject": q["subject"], "answer": a, "source": src,
              "post": post, "reply": reply, "weight_post": w(post), "weight_reply": w(reply), "reply_has_link": True})
    added += 1
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("added", added, "kaigo total", sum(1 for x in d if x["exam"] == "kaigo"))
