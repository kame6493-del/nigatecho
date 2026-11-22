import { EXAM, selectExam } from '../domain/exam';
import { emptyData } from '../domain/data';
import { record, rng } from '../domain/study';
import type { Question } from '../domain/types';

/**
 * 画面写真用の見本データ。?demo=1&n=解いた数&acc=正答率&premium=1&exam=試験(kanri・pt・kaigo・shakai。省略は管理栄養士)
 * 本番のビルドには入らない(main.tsx が DEV のときだけ読む)。
 */
export async function installDemo(params: URLSearchParams) {
  selectExam(params.get('exam'));
  localStorage.setItem('CapacitorStorage.nigatecho.exam', EXAM.dir);
  const qs: Question[] = await (await fetch(`./data/${EXAM.dir}/questions.json`)).json();
  const n = Number(params.get('n') ?? 260);
  const acc = Number(params.get('acc') ?? 0.66);
  const rand = rng(20261001);
  const pool = qs.filter((q) => !q.excluded && (params.get('premium') === '1' || EXAM.freeExams.includes(q.exam)));
  let d = emptyData();
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const q = pool[Math.floor(rand() * pool.length)];
    // 科目ごとに得意不得意をつける
    const bias = (EXAM.subjects.indexOf(q.subject) % 4) * 0.07 - 0.1;
    const day = Math.floor((n - i) / 40);
    d = record(d, q, rand() < acc + bias, now - day * 86400000 - (n - i) * 1000);
  }
  // left=N: 無料の回を、採点される問題が N問だけ残るまで解いた状態にする(無料の残りの知らせ・解き終えた画面の写真用。2026-11-22)
  if (params.get('left') !== null) {
    const keep = Number(params.get('left'));
    const free = qs.filter((q) => !q.excluded && EXAM.freeExams.includes(q.exam));
    free.forEach((q, i) => {
      if (i < free.length - keep && !d.records[q.id]) d = record(d, q, rand() < acc, now - 86400000 - i * 1000);
    });
  }
  // warm=1: 苦手をすべて「あと1回正解すれば外れる」状態にする(結果画面の写真用。苦手は続けて正解した数の少ない順に出るため、全部そろえる)
  if (params.get('warm') === '1') {
    for (const r of Object.values(d.records)) if (r.missed && r.streak < 2) r.streak = 1;
  }
  d.marks = pool.slice(0, 6).map((q) => q.id);
  localStorage.setItem(`CapacitorStorage.nigatecho.${EXAM.key}.v1`, JSON.stringify(d));
  const mockKey = EXAM.dir === 'kanri' ? 'nigatecho.mockFull' : `nigatecho.mockFull.${EXAM.dir}`;
  if (params.get('premium') === '1') localStorage.setItem(mockKey, '1');
  else localStorage.removeItem(mockKey);
}
