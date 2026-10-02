"""解説を問題データへ差し込み、exams/<試験>/data/questions.json を作る。
python scripts/merge_expl.py kanri   C:/Users/yuichi1/Downloads/管理栄養士国試アプリ_2026-10-01/data
python scripts/merge_expl.py rinsho  C:/Users/yuichi1/Downloads/臨床検査技師国試アプリ_2026-10-02/data
(第2引数は、問題データ questions.json と解説 expl/NN.json のある元のフォルダ)

確かめること:
- 解説の1行目「正答 …」の番号の集合が、公式の正答と一致する(除外問題は除く)
- 各 expl/NN.json に、ほかの回の id が混ざっていない
- 解説の無い問題の数
- 太字などのマークダウンが混ざっていない
差し込んだ後は node scripts/use-exam.mjs <試験> で public/data に写す。
"""
import glob
import json
import os
import re
import shutil
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
exam_dir, src = sys.argv[1], sys.argv[2]
OUT_DIR = os.path.join(APP, "exams", exam_dir, "data")
os.makedirs(OUT_DIR, exist_ok=True)

qs = json.load(open(os.path.join(src, "questions.json"), encoding="utf-8"))
expl = {}
problems = []
for f in sorted(glob.glob(os.path.join(src, "expl", "[0-9][0-9].json"))):
    exam = os.path.basename(f)[:2]
    part = json.load(open(f, encoding="utf-8"))
    # 作業者どうしの上書き事故で、ほかの回の解説が混ざったことがある
    for k in part:
        if not k.startswith(exam + "-"):
            problems.append((k, f"{exam}.json にほかの回の id が入っている"))
    expl.update({k: v for k, v in part.items() if k.startswith(exam + "-")})

Z2H = str.maketrans("０１２３４５６７８９", "0123456789")
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
        m = re.match(r"正答\s*([0-9０-９]+(?:\s*[・,、]\s*[0-9０-９]+)*)", t)
        if not m:
            problems.append((q["id"], "1行目が「正答 N」で始まっていない"))
        else:
            got = sorted(int(x.translate(Z2H)) for x in re.findall(r"[0-9０-９]+", m.group(1)))
            if got != sorted(q["answer"]):
                problems.append((q["id"], f"解説の正答 {got} と公式の正答 {sorted(q['answer'])} が違う"))
    q["explanation"] = t

json.dump(qs, open(os.path.join(OUT_DIR, "questions.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# 図: 元のフォルダの fig を写す。150KB を超える図は WebP(幅は最大1400px)にして軽くする
# (臨床検査技師の顕微鏡写真は PNG で 92MB あった)。問題データの figure も書き換える。
from PIL import Image

fig_src, fig_dst = os.path.join(src, "fig"), os.path.join(OUT_DIR, "fig")
BIG = 150 * 1024
if os.path.isdir(fig_src):
    os.makedirs(fig_dst, exist_ok=True)
    for q in qs:
        if not q.get("figure"):
            continue
        name = os.path.basename(q["figure"])
        s_path = os.path.join(fig_src, name)
        if os.path.getsize(s_path) > BIG:
            out_name = os.path.splitext(name)[0] + ".webp"
            d_path = os.path.join(fig_dst, out_name)
            if not os.path.exists(d_path) or os.path.getmtime(s_path) > os.path.getmtime(d_path):
                im = Image.open(s_path).convert("RGB")
                if im.width > 1400:
                    im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
                im.save(d_path, "WEBP", quality=82, method=6)
            q["figure"] = "fig/" + out_name
        else:
            d_path = os.path.join(fig_dst, name)
            if not os.path.exists(d_path) or os.path.getmtime(s_path) > os.path.getmtime(d_path):
                shutil.copyfile(s_path, d_path)
    json.dump(qs, open(os.path.join(OUT_DIR, "questions.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

print(f"問題 {len(qs)} / 解説あり {len(qs) - len(missing)} / 解説なし {len(missing)}")
for i, msg in problems:
    print("NG", i, msg)
print("書き出し:", OUT_DIR)
sys.exit(1 if problems else 0)
