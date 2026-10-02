import { describe, expect, it } from 'vitest';
import { emptyData, normalize } from './data';
import { DEFAULT_EXAM_DATE, EXAM } from './exam';
import { daysLeft, estimate, subEstimate, isCorrect, isLocked, isNigate, nigateOrder, record, rng, shuffle, streakDays, subjectStats, subjectWeights, toggleMark, unseen } from './study';
import type { Question } from './types';

const q = (id: string, subject: string, answer = [1], excluded = false): Question => ({
  id, exam: Number(id.split('-')[0]), session: '午前', no: Number(id.split('-')[1]), subject,
  stem: 's', choices: ['a', 'b', 'c', 'd', 'e'], answer, excluded, note: '', figure: null, source: '',
});

const T0 = new Date(2026, 9, 1, 12).getTime();
const DAY = 86400000;

describe('答え合わせ', () => {
  it('正答が複数ある問題は、どれを選んでも正解', () => {
    const x = q('40-001', '基礎栄養学', [2, 4]);
    expect(isCorrect(x, 2)).toBe(true);
    expect(isCorrect(x, 4)).toBe(true);
    expect(isCorrect(x, 1)).toBe(false);
  });

  it('2つ選ぶ問題は、組が完全に一致したときだけ正解(順番は問わない)', () => {
    const x = { ...q('72-010', '臨床化学', [2, 5]), pick: 2 };
    expect(isCorrect(x, [5, 2])).toBe(true);
    expect(isCorrect(x, [2])).toBe(false);
    expect(isCorrect(x, [2, 4])).toBe(false);
    expect(isCorrect(x, [2, 4, 5])).toBe(false);
    expect(isCorrect(x, 2)).toBe(false);
  });

  it('公式が複数の組を正解とした問題は、そのどれでも正解(69-182 の形)', () => {
    const x = { ...q('69-182', '臨床化学', [3, 4, 5]), pick: 2, accepted: [[3, 4], [3, 5], [4, 5]] };
    expect(isCorrect(x, [3, 4])).toBe(true);
    expect(isCorrect(x, [5, 3])).toBe(true);
    expect(isCorrect(x, [4, 5])).toBe(true);
    expect(isCorrect(x, [1, 3])).toBe(false);
    expect(isCorrect(x, [3])).toBe(false);
    // 1つ選ぶ問題で「どれでも正解」(68-050 の形)
    const y = { ...q('68-050', '臨床化学', [2, 4]), accepted: [[2], [4]] };
    expect(isCorrect(y, 2)).toBe(true);
    expect(isCorrect(y, 4)).toBe(true);
    expect(isCorrect(y, [2, 4])).toBe(false);
  });
});

describe('苦手の出入り', () => {
  it('間違えたら苦手。2回続けて正解したら外れる。途中で間違えたら数え直し', () => {
    const x = q('40-001', '基礎栄養学');
    let d = record(emptyData(), x, true, T0);
    expect(isNigate(d.records[x.id])).toBe(false); // 一度も間違えていない
    d = record(d, x, false, T0 + 1);
    expect(isNigate(d.records[x.id])).toBe(true);
    d = record(d, x, true, T0 + 2);
    expect(isNigate(d.records[x.id])).toBe(true);
    d = record(d, x, false, T0 + 3);
    d = record(d, x, true, T0 + 4);
    expect(isNigate(d.records[x.id])).toBe(true);
    d = record(d, x, true, T0 + 5);
    expect(isNigate(d.records[x.id])).toBe(false);
    expect(d.records[x.id]).toMatchObject({ n: 6, ok: 4, streak: 2, missed: true });
  });

  it('除外問題は記録しない', () => {
    const x = q('40-002', '基礎栄養学', [1], true);
    const d = record(emptyData(), x, false, T0);
    expect(d.records[x.id]).toBeUndefined();
    expect(d.daily).toEqual({});
  });

  it('苦手の順番: 続けて正解した数が少ない → 間違いの割合が高い → 古い', () => {
    const a = q('40-001', 'x'), b = q('40-002', 'x'), c = q('40-003', 'x'), e = q('40-004', 'x');
    let d = emptyData();
    d = record(d, a, false, T0 + 10); d = record(d, a, true, T0 + 11); // streak1
    d = record(d, b, false, T0 + 20); // streak0, 誤答率1
    d = record(d, c, true, T0 + 1); d = record(d, c, false, T0 + 2); // streak0, 誤答率0.5
    d = record(d, e, false, T0 + 5); // streak0, 誤答率1, b より古い
    expect(nigateOrder([a, b, c, e], d).map((x) => x.id)).toEqual(['40-004', '40-002', '40-003', '40-001']);
  });
});

describe('鍵', () => {
  it('無料の回だけ買わずに解ける', () => {
    // どの試験に切り替えても通るよう、無料の回は設定から読む
    const free = EXAM.freeExams[0];
    expect(isLocked(q(`${free}-001`, 'x'), false, EXAM)).toBe(false);
    expect(isLocked(q(`${free - 1}-001`, 'x'), false, EXAM)).toBe(true);
    expect(isLocked(q(`${free - 1}-001`, 'x'), true, EXAM)).toBe(false);
  });
});

describe('集計と推定', () => {
  const qs: Question[] = [];
  EXAM.subjects.forEach((s, i) => { for (let k = 0; k < 20; k++) qs.push(q(`40-${String(i * 20 + k + 1).padStart(3, '0')}`, s)); });

  it('科目の配点は最新の回の問題数', () => {
    const w = subjectWeights(qs, EXAM);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(200);
    expect(w[EXAM.subjects[3]]).toBe(20);
  });

  it('解いた数が少ないうちは推定しない', () => {
    const st = subjectStats(qs, emptyData(), EXAM);
    expect(estimate(st, subjectWeights(qs, EXAM), EXAM)).toBeNull();
  });

  it('全部正解なら満点、半分の科目だけ解いたら残りは平均で埋める', () => {
    let d = emptyData();
    for (const x of qs) d = record(d, x, true, T0);
    let est = estimate(subjectStats(qs, d, EXAM), subjectWeights(qs, EXAM), EXAM)!;
    expect(est).toMatchObject({ score: 200, pass: 120, total: 200, coverage: 1 });

    d = emptyData();
    // 前半5科目だけ、各科目20問中10問正解
    for (const x of qs.slice(0, 100)) d = record(d, x, Number(x.id.slice(3)) % 2 === 0, T0);
    est = estimate(subjectStats(qs, d, EXAM), subjectWeights(qs, EXAM), EXAM)!;
    expect(est.score).toBe(100);
    expect(est.coverage).toBe(0.5);
  });

  it('まだ解いていない問題(除外は数えない)', () => {
    const extra = q('40-201', '基礎栄養学', [1], true);
    const d = record(emptyData(), qs[0], true, T0);
    expect(unseen([...qs, extra], d).length).toBe(199);
  });
});

describe('配点', () => {
  it('配点のある試験では、科目の重みは配点の合計(実地問題3点)', () => {
    const xs = [q('61-001', 'A'), { ...q('61-002', 'A'), points: 3 }, q('61-003', 'B'), q('60-001', 'A')];
    const w = subjectWeights(xs, { ...EXAM, subjects: ['A', 'B'] });
    expect(w).toEqual({ A: 4, B: 1 });
    // 採点除外の問題は満点に数えない(模試の満点と合わせる)
    const w2 = subjectWeights([...xs, { ...q('61-004', 'B', [], true), points: 3 }], { ...EXAM, subjects: ['A', 'B'] });
    expect(w2).toEqual({ A: 4, B: 1 });
  });
});

describe('実地問題の基準', () => {
  it('配点3の問題の正答率 × 本番の満点。基準が無い試験では null', () => {
    const cfg = { ...EXAM, subPass: { label: '実地問題', points: 3, ratio: 0.35 } };
    const xs = Array.from({ length: 20 }, (_, i) => ({ ...q(`61-${String(i + 1).padStart(3, '0')}`, 'A'), points: 3 }));
    let d = emptyData();
    xs.forEach((x, i) => { d = record(d, x, i % 2 === 0, T0 + i); });
    expect(subEstimate(xs, xs, d, cfg)).toEqual({ label: '実地問題', score: 30, total: 60, pass: 21 });
    expect(subEstimate(xs, xs, d, { ...EXAM, subPass: undefined })).toBeNull();
    expect(subEstimate(xs, xs, emptyData(), cfg)).toBeNull();
  });
});

describe('日付', () => {
  it('試験日までの残り日数', () => {
    expect(daysLeft('2027-02-28', new Date(2027, 1, 27, 23).getTime())).toBe(1);
    expect(daysLeft('2027-02-28', new Date(2027, 1, 28, 8).getTime())).toBe(0);
    expect(daysLeft('2027-02-28', new Date(2027, 2, 1).getTime())).toBeNull();
    expect(daysLeft('', T0)).toBeNull();
  });

  it('続けて解いた日数。今日まだなら昨日までで数える', () => {
    const x = q('40-001', 'x');
    let d = emptyData();
    d = record(d, x, true, T0 - 2 * DAY);
    d = record(d, x, true, T0 - DAY);
    expect(streakDays(d.daily, T0)).toBe(2);
    d = record(d, x, true, T0);
    expect(streakDays(d.daily, T0)).toBe(3);
    expect(streakDays(d.daily, T0 + 2 * DAY)).toBe(0);
  });
});

describe('保存データ', () => {
  it('壊れた値を埋めて読み直す', () => {
    const d = normalize({ records: { a: { n: 3, ok: 9, at: 1, streak: -1, missed: 1 }, b: { n: 0 }, c: null }, marks: ['x', 'x', 3], settings: { fontScale: 9 }, daily: { bad: 1, '2026-10-01': 4 } });
    expect(d.records).toEqual({ a: { n: 3, ok: 3, at: 1, streak: 0, missed: true } });
    expect(d.marks).toEqual(['x']);
    expect(d.settings.fontScale).toBe(1.4);
    expect(d.settings.examDate).toBe(DEFAULT_EXAM_DATE);
    expect(d.daily).toEqual({ '2026-10-01': 4 });
    expect(normalize('garbage')).toEqual(emptyData());
  });

  it('しるしの付け外し', () => {
    let d = toggleMark(emptyData(), 'a');
    expect(d.marks).toEqual(['a']);
    d = toggleMark(d, 'a');
    expect(d.marks).toEqual([]);
  });
});

describe('並べ替え', () => {
  it('同じ種なら同じ順、要素は失われない', () => {
    const xs = Array.from({ length: 50 }, (_, i) => i);
    const a = shuffle(xs, rng(7));
    expect(shuffle(xs, rng(7))).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(xs);
  });
});
