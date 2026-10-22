import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import { record } from './study';
import { freeLeft, homeUpsell, RAISE_AFTER, roundCount, weakSubjectGrowth } from './upsell';
import type { ExamConfig, Question } from './types';

const q = (id: string, subject: string, excluded = false): Question => ({
  id, exam: Number(id.split('-')[0]), session: '午前', no: Number(id.split('-')[1]), subject,
  stem: 's', choices: ['a', 'b', 'c', 'd', 'e'], answer: [1], excluded, note: '', figure: null, source: '',
});
const cfg = { freeExams: [38] } as unknown as ExamConfig;
const T0 = new Date(2026, 9, 22, 12).getTime();

// 第38回(無料)4問・第37回(完全版)4問
const all = [
  q('38-001', 'A'), q('38-002', 'A'), q('38-003', 'B'), q('38-004', 'B', true),
  q('37-001', 'A'), q('37-002', 'A'), q('37-003', 'B'), q('37-004', 'B'),
];
const open = all.filter((x) => x.exam === 38);

describe('完全版の案内の出し方', () => {
  it('無料の回の残り(採点対象外は数えない)', () => {
    let d = emptyData();
    expect(freeLeft(open, d, cfg)).toBe(3);
    d = record(d, open[0], true, T0);
    expect(freeLeft(open, d, cfg)).toBe(2);
  });

  it('ホームの帯: 30問までは一番下・30問からは予想点の下・解き終えたら上に1枚', () => {
    const base = { premium: false, lockedCount: 625, hasFree: true };
    expect(homeUpsell({ ...base, seen: 0, freeLeft: 125 })).toBe('bottom');
    expect(homeUpsell({ ...base, seen: RAISE_AFTER - 1, freeLeft: 96 })).toBe('bottom');
    expect(homeUpsell({ ...base, seen: RAISE_AFTER, freeLeft: 95 })).toBe('raised');
    expect(homeUpsell({ ...base, seen: 125, freeLeft: 0 })).toBe('finished');
  });

  it('買った人・鍵のかかった問題が無い試験には出さない', () => {
    expect(homeUpsell({ premium: true, lockedCount: 625, seen: 125, freeLeft: 0, hasFree: true })).toBe('none');
    expect(homeUpsell({ premium: false, lockedCount: 0, seen: 125, freeLeft: 0, hasFree: true })).toBe('none');
  });

  it('本人の苦手の多い科目が、完全版で何問になるか', () => {
    let d = emptyData();
    expect(weakSubjectGrowth(all, open, d)).toBeNull(); // まだ何も解いていない
    d = record(d, open[0], false, T0);
    d = record(d, open[2], true, T0);
    const g = weakSubjectGrowth(all, open, d)!;
    expect(g).toEqual({ subject: 'A', nigate: 1, now: 2, full: 4 });
  });

  it('苦手が無ければ、3問以上解いた中で正答率の低い科目。採点対象外は数えない', () => {
    let d = emptyData();
    d = record(d, open[0], true, T0);
    d = record(d, open[1], true, T0);
    d = record(d, open[2], true, T0);
    expect(weakSubjectGrowth(all, open, d)).toBeNull(); // どの科目も3問に届かない
    expect(roundCount(all)).toBe(2);
  });
});
