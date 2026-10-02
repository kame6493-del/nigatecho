"""解説を問題データへ差し込み、アプリの public/data/questions.json を作る。
python scripts/merge_expl.py

確かめること:
- 解説の1行目「正答 N」が公式の正答と一致する(除外問題は除く)
- 解説の無い問題の数
- 太字などのマークダウンが混ざっていない
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "app", "public", "data", "questions.json")

qs = json.load(open(os.path.join(DATA, "questions.json"), encoding="utf-8"))
expl = {}
problems = []
for f in sorted(glob.glob(os.path.join(DATA, "expl", "[0-9][0-9].json"))):
    exam = os.path.basename(f)[:2]
    part = json.load(open(f, encoding="utf-8"))
    # 作業者どうしの上書き事故で、ほかの回の解説が混ざったことがある
    for k in part:
        if not k.startswith(exam + "-"):
            problems.append((k, f"{exam}.json にほかの回の id が入っている"))
    expl.update({k: v for k, v in part.items() if k.startswith(exam + "-")})

missing = []
for q in qs:
    t = expl.get(q["id"])
    if not t:
        missing.append(q["id"])
        q.pop("explanation", None)
        continue
    t = t.strip()
    if "**" in t or t.startswith("#"):
        problems.append((q["id"], "マークダウンが混ざっている"))
    if not q["excluded"]:
        m = re.match(r"正答\s*([0-9０-９]+)", t)
        if not m:
            problems.append((q["id"], "1行目が「正答 N」で始まっていない"))
        else:
            n = int(m.group(1).translate(str.maketrans("０１２３４５６７８９", "0123456789")))
            if n not in q["answer"]:
                problems.append((q["id"], f"解説の正答 {n} と公式の正答 {q['answer']} が違う"))
    q["explanation"] = t

json.dump(qs, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"問題 {len(qs)} / 解説あり {len(qs) - len(missing)} / 解説なし {len(missing)}")
for i, msg in problems:
    print("NG", i, msg)
print("書き出し:", OUT, os.path.getsize(OUT) // 1024, "KB")
sys.exit(1 if problems else 0)
