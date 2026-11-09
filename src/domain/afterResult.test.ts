import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import { record } from './study';
import {
  AFTER_RESULT_CLOSE_LIMIT, AFTER_RESULT_MIN_ANSWERED, AFTER_RESULT_REST_DAYS, EMPTY_AFTER_RESULT,
  afterResultClosed, afterResultDecide, afterResultOpened, afterResultShown, afterResultView, normalizeAfterResult,
  type AfterResultInput,
} from './afterResult';
import type { ExamConfig, Question } from './types';

const DAY = 86400000;
const T0 = new Date(2026, 10, 9, 20).getTime(); // 11/9 20:00(端末の暦)
const YESTERDAY = T0 - DAY;

/** 戻ってきた人が、練習10問を解いてホームへ戻った(出す場面) */
const base: AfterResultInput = {
  premium: false, hasLocked: true, canBuy: true, mock: false, answered: 10, completed: false, leave: 'home',
  firstAt: YESTERDAY, paywallAt: 0, reviewAsked: false,
};

describe('結果のあとの「この試験の続き」を出すか', () => {
  it('戻ってきた人が練習を解き終えてホームへ戻ったら出す', () => {
    expect(afterResultDecide(EMPTY_AFTER_RESULT, base, T0)).toBe(true);
  });

  it('前の版から使っている人(firstAt = 1)にも出す', () => {
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, firstAt: 1 }, T0)).toBe(true);
  });

  it('はじめて入れた日には出さない', () => {
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, firstAt: T0 - 60000 }, T0)).toBe(false);
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, firstAt: 0 }, T0)).toBe(false);
  });

  it('同じ日に1回まで。次の日はまた出す', () => {
    const s = afterResultShown(EMPTY_AFTER_RESULT, T0);
    expect(s.shown).toBe(1);
    expect(afterResultDecide(s, base, T0 + 60000)).toBe(false);
    expect(afterResultDecide(s, base, T0 + DAY)).toBe(true);
  });

  it('買った人・鍵のかかった回が無い・購入できない(ブラウザ版)には出さない', () => {
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, premium: true }, T0)).toBe(false);
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, hasLocked: false }, T0)).toBe(false);
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, canBuy: false }, T0)).toBe(false);
  });

  it('ひと区切り: 練習は5問以上・模試は全問答えて採点した回だけ', () => {
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, answered: AFTER_RESULT_MIN_ANSWERED - 1 }, T0)).toBe(false);
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, answered: AFTER_RESULT_MIN_ANSWERED }, T0)).toBe(true);
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, mock: true, answered: 0, completed: false }, T0)).toBe(false);
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, mock: true, answered: 0, completed: true }, T0)).toBe(true);
  });

  it('続けて解く人・購入画面へ進んだ人には出さない', () => {
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, leave: 'study' }, T0)).toBe(false);
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, leave: 'paywall' }, T0)).toBe(false);
  });

  it('今日すでに購入画面を開いた人には出さない(昨日なら出す)', () => {
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, paywallAt: T0 - 3600000 }, T0)).toBe(false);
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, paywallAt: YESTERDAY }, T0)).toBe(true);
  });

  it('OS の評価の窓を呼んだ回の終わりには出さない(窓を重ねない)', () => {
    expect(afterResultDecide(EMPTY_AFTER_RESULT, { ...base, reviewAsked: true }, T0)).toBe(false);
  });

  it('3回続けて閉じたら7日休む。購入画面へ進んだら数え直す', () => {
    let s = EMPTY_AFTER_RESULT;
    for (let k = 0; k < AFTER_RESULT_CLOSE_LIMIT - 1; k++) s = afterResultClosed(s, T0);
    expect(s.closedRun).toBe(AFTER_RESULT_CLOSE_LIMIT - 1);
    expect(afterResultOpened(s).closedRun).toBe(0);
    s = afterResultClosed(s, T0);
    expect(s.closedRun).toBe(0);
    expect(s.restUntil).toBe(T0 + AFTER_RESULT_REST_DAYS * DAY);
    expect(afterResultDecide(s, base, T0 + DAY)).toBe(false);
    expect(afterResultDecide(s, base, T0 + (AFTER_RESULT_REST_DAYS - 1) * DAY)).toBe(false);
    expect(afterResultDecide(s, base, T0 + AFTER_RESULT_REST_DAYS * DAY + 1)).toBe(true);
  });

  it('保存した記録の読み直し(壊れた値は空に)', () => {
    expect(normalizeAfterResult(null)).toEqual(EMPTY_AFTER_RESULT);
    expect(normalizeAfterResult({ shownDay: 'x', shown: -1, closedRun: 99, restUntil: 'a' })).toEqual({ shownDay: '', shown: 0, closedRun: AFTER_RESULT_CLOSE_LIMIT, restUntil: 0 });
    const s = afterResultShown(EMPTY_AFTER_RESULT, T0);
    expect(normalizeAfterResult(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

describe('案内の中身は本当の数だけ', () => {
  const q = (id: string, subject: string, excluded = false): Question => ({
    id, exam: Number(id.split('-')[0]), session: '午前', no: Number(id.split('-')[1]), subject,
    stem: 's', choices: ['a', 'b', 'c', 'd', 'e'], answer: [1], excluded, note: '', figure: null, source: '',
  });
  const cfg = { freeExams: [38], examDate: '2026-11-19' } as unknown as ExamConfig;
  // 第38回(無料)4問(うち採点対象外1問)・第37回と第36回(完全版)各3問
  const all = [
    q('38-001', 'A'), q('38-002', 'A'), q('38-003', 'B'), q('38-004', 'B', true),
    q('37-001', 'A'), q('37-002', 'A'), q('37-003', 'B'),
    q('36-001', 'A'), q('36-002', 'B'), q('36-003', 'B'),
  ];
  const open = all.filter((x) => x.exam === 38);

  it('無料の残り・苦手の科目の増え方・完全版の範囲・試験日までの1日の数', () => {
    let d = emptyData();
    d = record(d, open[0], false, T0);
    d = record(d, open[2], true, T0);
    const v = afterResultView(all, open, d, cfg, T0)!;
    expect(v.lockedRange).toBe('第36〜37回');
    expect(v.lockedCount).toBe(6);
    expect(v.freeRounds).toBe('第38回');
    expect(v.freeLeft).toBe(1);
    expect(v.weak).toEqual({ subject: 'A', nigate: 1, now: 2, full: 5 });
    // 試験まで10日・まだ解いていないのは採点対象外を除く 9 - 2 = 7問 → 1日1問
    expect(v.plan).toEqual({ days: 10, unseenFull: 7, perDay: 1 });
    expect(v.sub).toBeNull();
  });

  it('苦手の科目が必修問題そのもの(看護師)なら、必修の行だけにする', () => {
    const nurse = { ...cfg, subPass: { label: '必修問題', ratio: 0.8, subjects: ['A'] } } as unknown as ExamConfig;
    let d = emptyData();
    d = record(d, open[0], false, T0);
    const v = afterResultView(all, open, d, nurse, T0)!;
    expect(v.weak).toBeNull();
    expect(v.sub).toMatchObject({ label: '必修問題', now: 2, full: 5 });
  });

  it('鍵のかかった回が無い試験は出さない・試験日を過ぎたら日数の行を出さない', () => {
    expect(afterResultView(open, open, emptyData(), cfg, T0)).toBeNull();
    const v = afterResultView(all, open, emptyData(), { ...cfg, examDate: '2026-11-01' } as ExamConfig, T0)!;
    expect(v.plan).toBeNull();
  });
});
