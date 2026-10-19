import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ExamConfig, Question } from './types';
import { inSubPass, isAnswered, isCorrect, mainView, pickCount, subEstimate } from './study';

const cfg: ExamConfig = JSON.parse(readFileSync('exams/nurse/exam.json', 'utf8'));
const qs: Question[] = JSON.parse(readFileSync('exams/nurse/data/questions.json', 'utf8'));
const byId = new Map(qs.map((q) => [q.id, q]));

describe('看護師(第115回)のデータ', () => {
  it('240問・必修50(1点)・一般130(1点)・状況設定60(2点)。除外を引いた満点は必修50・一般+状況設定249(合格発表と同じ)', () => {
    expect(qs.length).toBe(240);
    const by = (p: string) => qs.filter((q) => q.part === p);
    expect([by('必修問題').length, by('一般問題').length, by('状況設定問題').length]).toEqual([50, 130, 60]);
    expect(by('状況設定問題').every((q) => q.points === 2)).toBe(true);
    const pts = (xs: Question[]) => xs.filter((q) => !q.excluded).reduce((t, q) => t + (q.points ?? 1), 0);
    expect(pts(by('必修問題'))).toBe(50);
    expect(pts(qs.filter((q) => q.part !== '必修問題'))).toBe(249);
    expect(qs.filter((q) => q.subject === '必修問題').map((q) => q.part)).toEqual(Array(50).fill('必修問題'));
  });

  it('状況設定問題は事例文(case)が3問で同じ', () => {
    const s = qs.filter((q) => q.part === '状況設定問題');
    expect(s.every((q) => q.case)).toBe(true);
    expect(new Set(s.map((q) => q.case)).size).toBe(20);
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
    expect(qs.filter((q) => inSubPass(q, cfg)).length).toBe(50);
    expect(mainView(cfg).subjects).not.toContain('必修問題');
    expect(mainView(cfg).subjects.length).toBe(cfg.subjects.length - 1);
    expect(cfg.passScores).toEqual({ '115': 166 });
  });
  it('必修問題の予想: 解いた必修の正答率 × 50点', () => {
    const data = { records: {} as Record<string, { n: number; ok: number; streak: number; at: number }> } as unknown as Parameters<typeof subEstimate>[2];
    const hs = qs.filter((q) => q.part === '必修問題');
    hs.slice(0, 10).forEach((q, k) => { (data.records as Record<string, unknown>)[q.id] = { n: 1, ok: k < 8 ? 1 : 0, streak: k < 8 ? 1 : 0, at: 0 }; });
    const s = subEstimate(qs, qs, data, cfg)!;
    expect([s.score, s.total, s.pass]).toEqual([40, 50, 40]);
  });
});
