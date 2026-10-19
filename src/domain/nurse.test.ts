import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ExamConfig, Question } from './types';
import { calcText, inSubPass, isAnswered, isCorrect, isLocked, mainView, pickCount, subEstimate } from './study';

const cfg: ExamConfig = JSON.parse(readFileSync('exams/nurse/exam.json', 'utf8'));
const qs: Question[] = JSON.parse(readFileSync('exams/nurse/data/questions.json', 'utf8'));
const byId = new Map(qs.map((q) => [q.id, q]));

// 合格発表ページの満点(採点除外の後): 必修問題, 一般+状況設定
const FULL: Record<number, [number, number]> = { 111: [50, 250], 112: [50, 249], 113: [49, 250], 114: [50, 250], 115: [50, 249] };

describe('看護師(第111〜115回)のデータ', () => {
  it('5回×240問・必修50(1点)・一般130(1点)・状況設定60(2点)。除外を引いた満点は合格発表と同じ', () => {
    expect(qs.length).toBe(1200);
    for (const ex of [111, 112, 113, 114, 115]) {
      const xs = qs.filter((q) => q.exam === ex);
      expect(xs.length, String(ex)).toBe(240);
      const by = (p: string) => xs.filter((q) => q.part === p);
      expect([by('必修問題').length, by('一般問題').length, by('状況設定問題').length]).toEqual([50, 130, 60]);
      expect(by('状況設定問題').every((q) => q.points === 2)).toBe(true);
      const pts = (ys: Question[]) => ys.filter((q) => !q.excluded).reduce((t, q) => t + (q.points ?? 1), 0);
      expect([pts(by('必修問題')), pts(xs.filter((q) => q.part !== '必修問題'))], String(ex)).toEqual(FULL[ex]);
    }
    expect(qs.filter((q) => q.subject === '必修問題').every((q) => q.part === '必修問題')).toBe(true);
    expect(qs.every((q) => cfg.subjects.includes(q.subject))).toBe(true);
  });

  it('状況設定問題は事例文(case)がある。第111回午後は2問・1問の事例もある', () => {
    const s = qs.filter((q) => q.part === '状況設定問題');
    expect(s.every((q) => q.case)).toBe(true);
    const n115 = new Set(s.filter((q) => q.exam === 115).map((q) => q.case)).size;
    expect(n115).toBe(20);
  });

  it('無料は第115回、第111〜114回は完全版(看護師の商品)で開く', () => {
    expect(cfg.freeExams).toEqual([115]);
    expect(isLocked(byId.get('115-001')!, false, cfg)).toBe(false);
    expect(isLocked(byId.get('111-001')!, false, cfg)).toBe(true);
    expect(isLocked(byId.get('111-001')!, true, cfg)).toBe(false);
    expect(cfg.productId).toBe('nigatecho_multi_nurse_full');
    expect(cfg.entitlement).toBe('nurse_full');
  });

  it('第112回の正誤表(午後26の選択肢1)を直してある', () => {
    expect(byId.get('112-146')!.choices[0]).toBe('僧帽弁は開いている。');
  });
});

describe('計算問題', () => {
  const q = byId.get('115-090')!;
  it('欄2つ・答えは 4 と 2 の順(42滴/分)', () => {
    expect(q.calc).toEqual({ slots: 2, unit: '滴/分' });
    expect(q.choices).toEqual([]);
    expect(pickCount(q)).toBe(2);
  });
  it('数字の順まで一致したときだけ正解', () => {
    expect(isCorrect(q, [4, 2])).toBe(true);
    expect(isCorrect(q, [2, 4])).toBe(false);
    expect(isCorrect(q, [4])).toBe(false);
    expect(isCorrect(q, [4, 2, 0])).toBe(false);
  });
  it('2つの欄に数字が入るまで答え合わせできない', () => {
    const half: (number | undefined)[] = [];
    half[1] = 2;
    expect(isAnswered(q, half as number[])).toBe(false);
    expect(isAnswered(q, [4, 2])).toBe(true);
    expect(isAnswered(q, [0, 0])).toBe(true);
  });
  it('選択肢の問題はこれまでどおり(2つ選ぶ問題は組で)', () => {
    const p2 = qs.find((x) => x.pick === 2 && !x.calc && !x.accepted)!;
    expect(isCorrect(p2, [...p2.answer].reverse())).toBe(true);
    expect(isAnswered(p2, [p2.answer[0]])).toBe(false);
  });
});

describe('合格基準: 必修問題 8割と、一般・状況設定の合格点を別々に', () => {
  it('必修問題が別の基準(subPass)で、合格点を数える側からは外れる', () => {
    expect(cfg.subPass).toMatchObject({ label: '必修問題', ratio: 0.8, separate: true });
    expect(qs.filter((q) => inSubPass(q, cfg)).length).toBe(250);
    expect(mainView(cfg).subjects).not.toContain('必修問題');
    expect(mainView(cfg).subjects.length).toBe(cfg.subjects.length - 1);
    expect(cfg.passScores).toEqual({ '111': 167, '112': 152, '113': 158, '114': 148, '115': 166 });
  });
  it('必修問題の予想: 解いた必修の正答率 × 50点', () => {
    const data = { records: {} as Record<string, { n: number; ok: number; streak: number; at: number }> } as unknown as Parameters<typeof subEstimate>[2];
    const hs = qs.filter((q) => q.part === '必修問題');
    hs.slice(0, 10).forEach((q, k) => { (data.records as Record<string, unknown>)[q.id] = { n: 1, ok: k < 8 ? 1 : 0, streak: k < 8 ? 1 : 0, at: 0 }; });
    const s = subEstimate(qs, qs, data, cfg)!;
    expect([s.score, s.total, s.pass]).toEqual([40, 50, 40]);
  });
});

describe('計算問題の欄の並び(回で違う)', () => {
  it('第111回は小数点つき「①.②mL」、答えの表示は 3.8mL', () => {
    const q = byId.get('111-090')!;
    expect(q.calc).toEqual({ slots: 2, unit: 'mL', tpl: '①.②mL' });
    expect(calcText(q, q.answer)).toBe('3.8mL');
    expect(calcText(q, [3], '−')).toBe('3.−mL');
  });
  it('第113回は日付「2023年①②月③④日」', () => {
    const q = byId.get('113-106')!;
    expect(q.calc!.slots).toBe(4);
    expect(calcText(q, q.answer)).toBe('2023年11月12日');
  });
  it('第115回は今までどおり(tpl なし)', () => {
    const q = byId.get('115-090')!;
    expect(calcText(q, q.answer)).toBe('42滴/分');
  });
});
