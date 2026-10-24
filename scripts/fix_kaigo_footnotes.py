"""介護福祉士の問題データで、問題冊子の脚注「（注）…」が最後の選択肢の後ろにつながって入っていたのを、
選択肢から外して footnote に移す(社会福祉士と同じ形。文言は変えない)。2026-10-24 Discord の指摘(総合問題 38-122)。
使い方: python scripts/fix_kaigo_footnotes.py exams/kaigo/data/questions.json
"""
import json, re, sys

p = sys.argv[1]
qs = json.load(open(p, encoding='utf-8'))
n = 0
for q in qs:
    last = q['choices'][-1]
    i = last.find('（注）')
    if i < 0:
        continue
    note = last[i:]
    q['choices'][-1] = last[:i].rstrip()
    # 「（注）1　…。2　…」は番号ごとに改行(社会福祉士の footnote と同じ並び)
    note = re.sub(r'(?<=。)\s*(\d)　', lambda m: '\n' + m.group(1) + '　', note)
    assert not q.get('footnote'), q['id']
    q['footnote'] = note
    n += 1
    print(q['id'], '|', q['choices'][-1], '|', note.replace('\n', ' / ')[:70])
for q in qs:
    for c in q['choices']:
        assert '（注）' not in c, q['id']
with open(p, 'w', encoding='utf-8', newline='\n') as f:
    f.write(json.dumps(qs, ensure_ascii=False, separators=(',', ':')))
print('moved', n)
