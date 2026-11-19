import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import { isNigate, record } from './study';
import { fullPlan, sessionWeak, todayCount, todayMix, todaySet, TODAY_GOAL } from './today';
import type { Question } from './types';

const T0 = new Date(2026, 10, 19, 20).getTime();
const q = (i: number, extra: Partial<Question> = {}): Question => ({
  id: `38-${String(i).padStart(3, '0')}`, exam: 38, no: i, session: '午前', subject: i % 2 ? '介護の基本' : '生活支援',
  stem: 's', choices: ['a', 'b', 'c', 'd', 'e'], answer: [1], explanation: '', ...extra,
} as Question);
const qs = Array.from({ length: 30 }, (_, i) => q(i + 1));

describe('今日の10問', () => {
  it('苦手を先に、残りをまだ解いていない問題で埋めて10問', () => {
    let d = emptyData();
    for (const x of qs.slice(0, 4)) d = record(d, x, false, T0);
    for (const x of qs.slice(4, 8)) d = record(d, x, true, T0);
    const set = todaySet(qs, d, 1);
    expect(set).toHaveLength(TODAY_GOAL);
    expect(set.slice(0, 4).every((x) => isNigate(d.records[x.id]))).toBe(true);
    expect(set.slice(4).every((x) => !d.records[x.id])).toBe(true);
    expect(new Set(set.map((x) => x.id)).size).toBe(TODAY_GOAL);
    expect(todayMix(qs, d)).toEqual({ nigate: 4, fresh: 6 });
  });

  it('苦手が多くても、まだ解いていない問題があれば苦手7問+新しい3問。採点対象外は入れない', () => {
    let d = emptyData();
    const ex = q(99, { excluded: true });
    for (const x of [...qs.slice(0, 12), ex]) d = record(d, x, false, T0);
    const set = todaySet([...qs, ex], d, 1);
    expect(set).toHaveLength(10);
    expect(set.some((x) => x.excluded)).toBe(false);
    expect(set.filter((x) => isNigate(d.records[x.id]))).toHaveLength(7);
    expect(todayMix(qs, d)).toEqual({ nigate: 7, fresh: 3 });
  });

  it('全部解いたあとは苦手だけで10問。新しい問題が2問しかなければ苦手8問', () => {
    let d = emptyData();
    for (const x of qs) d = record(d, x, false, T0);
    expect(todayMix(qs, d)).toEqual({ nigate: 10, fresh: 0 });
    let e = emptyData();
    for (const x of qs.slice(0, 28)) e = record(e, x, false, T0);
    expect(todayMix(qs, e)).toEqual({ nigate: 8, fresh: 2 });
    expect(todaySet(qs, e, 1)).toHaveLength(10);
  });

  it('解ける問題が少なければ、ある分だけ', () => {
    const d = emptyData();
    expect(todaySet(qs.slice(0, 3), d, 1)).toHaveLength(3);
  });

  it('今日解いた数は記録の daily のまま', () => {
    let d = emptyData();
    for (const x of qs.slice(0, 3)) d = record(d, x, true, T0);
    expect(todayCount(d, T0)).toBe(3);
    expect(todayCount(d, T0 + 86400000)).toBe(0);
  });
});

describe('解き終えた回の、間違えた科目', () => {
  it('間違いの多い順。間違い0の科目は出さない', () => {
    const r = sessionWeak([
      { subject: 'A', ok: false }, { subject: 'B', ok: false }, { subject: 'B', ok: false },
      { subject: 'C', ok: true }, { subject: 'A', ok: true },
    ]);
    expect(r).toEqual([{ subject: 'B', ng: 2, total: 2 }, { subject: 'A', ng: 1, total: 2 }]);
  });
  it('最大3科目', () => {
    expect(sessionWeak(['A', 'B', 'C', 'D'].map((s) => ({ subject: s, ok: false })))).toHaveLength(3);
  });
});

describe('試験日までに完全版を1周するなら', () => {
  it('まだ解いていない数を残りの日数で割る(切り上げ)', () => {
    let d = emptyData();
    for (const x of qs.slice(0, 7)) d = record(d, x, true, T0);
    expect(fullPlan(qs, d, 10)).toEqual({ days: 10, left: 23, perDay: 3 });
  });
  it('試験日が過ぎた・無い・全部解いたら出さない', () => {
    const d = emptyData();
    expect(fullPlan(qs, d, 0)).toBeNull();
    expect(fullPlan(qs, d, null)).toBeNull();
    let all = emptyData();
    for (const x of qs) all = record(all, x, true, T0);
    expect(fullPlan(qs, all, 10)).toBeNull();
  });
});
