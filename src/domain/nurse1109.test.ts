/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXAMS } from './exam';
import { emptyData } from './data';
import { record } from './study';
import { excludedCount, partRows, seasonFacts, subFreeDone } from './upsell';
import { afterResultView } from './afterResult';
import type { ExamConfig, Question } from './types';

// 2026-11-09 看護師の買う割合: 区分ごとの数(必修・一般・状況設定)・必修を解き終えたときの案内・第116回の時期

const HAS_NURSE = EXAMS.some((e) => e.dir === 'nurse');
const nurse = EXAMS.find((e) => e.dir === 'nurse')!;
const realAll = JSON.parse(readFileSync(`exams/nurse/data/questions.json`, 'utf-8')) as Question[];

describe.skipIf(!HAS_NURSE)('看護師: 区分ごとの問題数(問題データから数える)', () => {
  it('必修 50→249・一般 129→648・状況設定 60→300(採点対象外は除く)', () => {
    const rows = partRows(realAll, nurse)!;
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    // 手で数えた数と一致するか(データが変わったらここも直す)
    const count = (f: (q: Question) => boolean, free: boolean) => realAll.filter((q) => !q.excluded && f(q) && (!free || q.exam === 115)).length;
    const isSub = (q: Question) => q.subject === '必修問題';
    expect(by.sub).toMatchObject({ label: '必修問題', free: count(isSub, true), full: count(isSub, false) });
    expect(by.case).toMatchObject({ label: '状況設定問題', free: count((q) => !isSub(q) && !!q.case, true), full: count((q) => !isSub(q) && !!q.case, false) });
    expect(by.general).toMatchObject({ label: '一般問題', free: count((q) => !isSub(q) && !q.case, true), full: count((q) => !isSub(q) && !q.case, false) });
    expect([by.sub.free, by.sub.full, by.general.free, by.general.full, by.case.free, by.case.full]).toEqual([50, 249, 129, 648, 60, 300]);
    expect(by.sub.free + by.general.free + by.case.free).toBe(realAll.filter((q) => q.exam === 115 && !q.excluded).length);
  });
  it('設定の無い試験(介護福祉士など)では出さない', () => {
    for (const e of EXAMS.filter((x) => x.dir !== 'nurse')) expect(partRows(realAll, e)).toBeNull();
    expect(EXAMS.filter((x) => x.paywallParts).map((x) => x.dir)).toEqual(['nurse']);
  });
});

describe.skipIf(!HAS_NURSE)('看護師: 無料の回の必修問題を解き終えたか', () => {
  const free = realAll.filter((q) => q.exam === 115 && !q.excluded && q.subject === '必修問題');
  it('1問でも残っていれば出さない', () => {
    let d = emptyData();
    for (const q of free.slice(0, free.length - 1)) d = record(d, q, true, 1);
    expect(subFreeDone(realAll, d, nurse)).toBeNull();
  });
  it('全部解いたら、最後の答えの正解の数と基準の目安(8割)', () => {
    let d = emptyData();
    free.forEach((q, i) => { d = record(d, q, i % 5 !== 0, 1); });
    const r = subFreeDone(realAll, d, nurse)!;
    expect(r).toEqual({ rounds: [115], total: 50, ok: 40, need: 40 });
  });
  it('必修の基準の無い試験では null', () => {
    expect(subFreeDone(realAll, emptyData(), { ...nurse, subPass: undefined } as ExamConfig)).toBeNull();
  });
});

describe.skipIf(!HAS_NURSE)('看護師: 購入画面の時期(第116回)', () => {
  it('試験まで何日と、願書の受付(11月6日〜27日)', () => {
    const t = new Date(2026, 10, 9, 12).getTime();
    const s = seasonFacts(nurse, t)!;
    expect(s.examLabel).toBe('第116回');
    expect(s.examDate).toBe('2027-02-14');
    expect(s.days).toBe(97);
    expect(s.apply).toMatchObject({ state: 'open', to: '2026-11-27' });
    expect(seasonFacts(nurse, new Date(2026, 10, 28, 12).getTime())!.apply).toBeNull();
    expect(seasonFacts(nurse, new Date(2027, 1, 15, 12).getTime())).toBeNull();
  });
});

describe.skipIf(!HAS_NURSE)('看護師: 結果のあとの「この試験の続き」に状況設定', () => {
  it('状況設定問題 60問 → 300問(介護福祉士には出さない)', () => {
    const open = realAll.filter((q) => q.exam === 115);
    const v = afterResultView(realAll, open, emptyData(), nurse, new Date(2026, 10, 9).getTime())!;
    expect(v.caseGrowth).toEqual({ label: '状況設定問題', now: 60, full: 300 });
    const kaigo = EXAMS.find((e) => e.dir === 'kaigo')!;
    const kAll = JSON.parse(readFileSync(`exams/kaigo/data/questions.json`, 'utf-8')) as Question[];
    const kv = afterResultView(kAll, kAll.filter((q) => q.exam === 38), emptyData(), kaigo, new Date(2026, 10, 9).getTime())!;
    expect(kv.caseGrowth).toBeNull();
  });
});

describe.skipIf(!HAS_NURSE)('看護師: 画面の問題数を1つにそろえる(11/9)', () => {
  it('区分の表の合計 + 採点対象外 = 問題データの数(見出しの 1,200問・無料の 240問)', () => {
    const rows = partRows(realAll, nurse)!;
    const ex = excludedCount(realAll, nurse);
    expect(ex).toEqual({ free: 1, full: 3 });
    expect(rows.reduce((a, r) => a + r.full, 0) + ex.full).toBe(realAll.length);
    expect(rows.reduce((a, r) => a + r.free, 0) + ex.free).toBe(realAll.filter((q) => q.exam === 115).length);
    expect(realAll.length).toBe(nurse.count);
    expect(nurse.count).toBe(1200);
  });
  it('結果のあとの案内の数は「まだ解いていない」問題(採点される問題で、解いた分だけ減る)', () => {
    const open = realAll.filter((q) => q.exam === 115);
    let d = emptyData();
    for (const q of open.filter((x) => !x.excluded).slice(0, 10)) d = record(d, q, true, 1);
    const v = afterResultView(realAll, open, d, nurse, new Date(2026, 10, 9).getTime())!;
    expect(v.plan!.unseenFull).toBe(1197 - 10);
    expect(v.lockedCount).toBe(960);
  });
});
