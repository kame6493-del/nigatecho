/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUNDLES, EXAMS, SINGLE } from './exam';
import { emptyData } from './data';
import { record } from './study';
import { jpDate, seasonFacts, subPassMine } from './upsell';
import type { ExamConfig, Question } from './types';

// 2026-10-31 購入画面の直し(看護師の必修・社会福祉士のセット・管理栄養士の時期)

const q = (id: string, subject: string, excluded = false): Question => ({
  id, exam: Number(id.split('-')[0]), session: '午前', no: Number(id.split('-')[1]), subject,
  stem: 's', choices: ['a', 'b', 'c', 'd'], answer: [1], excluded, note: '', figure: null, source: '',
});
const nurseCfg = { freeExams: [115], subPass: { label: '必修問題', subjects: ['必修問題'], ratio: 0.8, separate: true } } as unknown as ExamConfig;
const all = [
  q('115-001', '必修問題'), q('115-002', '必修問題'), q('115-003', '必修問題'), q('115-004', '必修問題', true), q('115-010', '基礎看護学'),
  q('114-001', '必修問題'), q('114-002', '必修問題'), q('114-003', '必修問題', true), q('113-001', '必修問題'), q('114-010', '基礎看護学'),
];
const locked = (x: Question) => !nurseCfg.freeExams.includes(x.exam);
const T0 = new Date(2026, 9, 31, 12).getTime();

describe('看護師: 購入画面の「あなたの必修問題」', () => {
  it('無料の回の必修の解いた数・正解の数(最後の答え)と、まだ解いていない回の必修の数(採点対象外は数えない)', () => {
    let d = emptyData();
    d = record(d, all[0], true, T0);
    d = record(d, all[1], false, T0);
    d = record(d, all[4], false, T0); // 必修ではない
    const m = subPassMine(all, d, nurseCfg, locked)!;
    expect(m).toMatchObject({ label: '必修問題', ratio: 0.8, freeRounds: [115], freeTotal: 3, seen: 2, ok: 1, lockedRounds: [113, 114], lockedUnseen: 3 });
  });
  it('まだ何も解いていなくても出す(0問のときは正答率を作らない)', () => {
    const m = subPassMine(all, emptyData(), nurseCfg, locked)!;
    expect(m.seen).toBe(0);
    expect(m.ok).toBe(0);
  });
  it('鍵のかかった回の必修が無い(買った人)・科目の基準が無い試験には出さない', () => {
    expect(subPassMine(all, emptyData(), nurseCfg, () => false)).toBeNull();
    expect(subPassMine(all, emptyData(), { freeExams: [115] } as unknown as ExamConfig, locked)).toBeNull();
    const pt = { freeExams: [115], subPass: { label: '実地問題', points: 3, ratio: 0.35 } } as unknown as ExamConfig;
    expect(subPassMine(all, emptyData(), pt, locked)).toBeNull();
  });
});

describe.skipIf(SINGLE)('管理栄養士: 購入画面の見出しの時期(まとめ版)', () => {
  const kanri = EXAMS.find((e) => e.dir === 'kanri')!;
  it('第41回 2027年2月28日・願書の受付 2026年11月2日〜12月4日(消印有効)', () => {
    expect(kanri.examDate).toBe('2027-02-28');
    expect(kanri.paywallSeason).toMatchObject({ examLabel: '第41回', apply: { from: '2026-11-02', to: '2026-12-04', note: '消印有効' } });
  });
  it('日数はその日の日付から数える。受付の前は before・受付中は open・過ぎたら出さない', () => {
    expect(seasonFacts(kanri, new Date(2026, 9, 31, 23, 59).getTime())).toMatchObject({ days: 120, apply: { state: 'before' } });
    expect(seasonFacts(kanri, new Date(2026, 10, 2, 0, 1).getTime())).toMatchObject({ days: 118, apply: { state: 'open' } });
    expect(seasonFacts(kanri, new Date(2026, 11, 4, 22).getTime())).toMatchObject({ apply: { state: 'open' } });
    expect(seasonFacts(kanri, new Date(2026, 11, 5, 0, 1).getTime())).toMatchObject({ days: 85, apply: null });
    expect(seasonFacts(kanri, new Date(2027, 1, 28, 9).getTime())).toMatchObject({ days: 0 });
    expect(seasonFacts(kanri, new Date(2027, 2, 1).getTime())).toBeNull();
  });
  it('ほかの試験(介護福祉士など)には出さない(看護師は 2026-11-09 から第116回の時期を出す。nurse1109.test.ts)', () => {
    for (const e of EXAMS.filter((x) => x.dir !== 'kanri' && x.dir !== 'nurse')) expect(seasonFacts(e, T0)).toBeNull();
  });
  it('日付の書き方', () => {
    expect(jpDate('2026-11-02', T0)).toBe('11月2日');
    expect(jpDate('2027-02-28', T0)).toBe('2027年2月28日');
    expect(jpDate('2027-02-28')).toBe('2027年2月28日');
  });
});

describe('社会福祉士: セットを上に', () => {
  it('セットを先に出すのは社会福祉士だけ(介護福祉士・精神保健福祉士は前のまま)', () => {
    if (SINGLE) { expect(BUNDLES).toEqual([]); return; }
    expect(BUNDLES[0].first).toEqual(['shakai']);
  });
  it('セットの行の数は問題データと同じ。精神保健福祉士の共通科目は社会福祉士の第37・38回の1〜84番と同じ数', () => {
    if (SINGLE) return;
    const load = (d: string): Question[] => JSON.parse(readFileSync(`exams/${d}/data/questions.json`, 'utf8'));
    for (const d of BUNDLES[0].exams) {
      const e = EXAMS.find((x) => x.dir === d)!;
      const qs = load(d);
      expect(e.count).toBe(qs.length);
      expect(e.sessionCounts?.['午前'] ?? 0).toBe(qs.filter((x) => x.session === '午前').length);
    }
    const se = EXAMS.find((x) => x.dir === 'seishin')!;
    expect(se.sessionCounts).toEqual({ '午前': 168, '午後': 96 });
    expect(se.rounds).toEqual([27, 28]);
    const sh = load('shakai').filter((x) => x.no <= 84);
    expect(sh.length).toBe(168);
  });
});
