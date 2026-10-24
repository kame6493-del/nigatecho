import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import { record } from './study';
import { freeLeft, homeUpsell, lockedPreview, PREVIEW_STEM_MAX, RAISE_AFTER, resultPreviewSubjects, roundCount, subPassGrowth, weakSubjectGrowth } from './upsell';
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

describe('鍵のかかった回の問題を1問見せる', () => {
  const locked = (x: Question) => !cfg.freeExams.includes(x.exam);
  const mk = (id: string, subject: string, extra: Partial<Question> = {}): Question => ({ ...q(id, subject), ...extra });
  const pool = [
    mk('38-001', 'A'), mk('37-001', 'A'), mk('37-002', 'A', { stem: 'x'.repeat(PREVIEW_STEM_MAX + 1) }),
    mk('36-001', 'A'), mk('37-010', 'B', { figure: 'fig/37-010.png' }), mk('37-011', 'B', { case: '事例' }),
    mk('37-012', 'B', { excluded: true }), mk('36-012', 'B'), mk('37-020', 'C', { calc: { slots: 2, unit: 'g' } }),
  ];

  it('鍵のかかった問題だけ・一番新しい回の短い問題から', () => {
    const got = lockedPreview(pool, locked, ['A'], '2026-10-24');
    expect(got?.id).toBe('37-001');
  });

  it('短い問題のある科目を先に。どこにも無ければ長い問題', () => {
    const longs = [mk('37-050', 'L', { stem: 'x'.repeat(PREVIEW_STEM_MAX + 5) }), mk('37-051', 'S')];
    expect(lockedPreview(longs, locked, ['L', 'S'], 's')?.id).toBe('37-051');
    expect(lockedPreview(longs, locked, ['L'], 's')?.id).toBe('37-050');
  });

  it('図・事例・採点対象外・計算は選ばない。その科目に無ければ古い回へ', () => {
    expect(lockedPreview(pool, locked, ['B'], 's')?.id).toBe('36-012');
    expect(lockedPreview(pool, locked, ['C'], 's')).toBeNull();
  });

  it('前の科目に候補が無ければ次の科目', () => {
    expect(lockedPreview(pool, locked, ['C', 'Z', 'A'], 's')?.subject).toBe('A');
  });

  it('同じ seed なら同じ問題(開くたびに変わらない)', () => {
    const many = Array.from({ length: 9 }, (_, i) => mk(`37-1${i}0`, 'D'));
    const a = lockedPreview(many, locked, ['D'], '2026-10-24');
    expect(lockedPreview([...many].reverse(), locked, ['D'], '2026-10-24')?.id).toBe(a?.id);
  });

  it('買った人(鍵が無い)には出さない', () => {
    expect(lockedPreview(pool, () => false, ['A', 'B'], 's')).toBeNull();
  });

  it('結果の科目の順: 間違えた数の多い科目 → 苦手の多い科目 → 解いた科目', () => {
    const done = [{ subject: 'A', ok: true }, { subject: 'B', ok: false }, { subject: 'C', ok: false }, { subject: 'C', ok: false }];
    expect(resultPreviewSubjects(done, 'D')).toEqual(['C', 'B', 'D', 'A']);
    expect(resultPreviewSubjects([{ subject: 'A', ok: true }], null)).toEqual(['A']);
  });
});

describe('別の基準のある問題(看護師の必修問題)が完全版で何問になるか', () => {
  const nurseCfg = { freeExams: [38], subPass: { label: '必修問題', subjects: ['A'], ratio: 0.8, separate: true, restLabel: '一般・状況設定' } } as unknown as ExamConfig;
  it('無料の回と全部の回の、基準のある科目の問題数(採点対象外は数えない)', () => {
    expect(subPassGrowth(all, nurseCfg)).toEqual({ label: '必修問題', ratio: 0.8, now: 2, full: 4 });
  });
  it('基準の無い試験・完全版で増えない試験には出さない', () => {
    expect(subPassGrowth(all, cfg)).toBeNull();
    expect(subPassGrowth(open, nurseCfg)).toBeNull();
  });
});
