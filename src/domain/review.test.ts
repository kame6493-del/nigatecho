import { describe, expect, it } from 'vitest';
import { EMPTY_REVIEW, REVIEW_GAP_DAYS, normalizeReview, reviewOnOpen, reviewOnSessionEnd, storeReviewUrl, type ReviewState, type SessionEnd } from './review';
import { examRange, lockedSummary } from './study';
import { EXAMS } from './exam';
import type { Question } from './types';

const DAY = 86400000;
const HOUR = 3600000;
const T0 = new Date(2026, 9, 7, 9).getTime();
const plain: SessionEnd = { cleared: 0, nigateLeft: 5, correctRate: 0.5, lastOk: true };
const clearOne: SessionEnd = { cleared: 1, nigateLeft: 4, correctRate: 0.7, lastOk: true };
const mockDone: SessionEnd = { cleared: 0, nigateLeft: -1, correctRate: 0.5, passed: false, completed: true };
const mockHalf: SessionEnd = { cleared: 0, nigateLeft: -1, correctRate: 0.3, passed: false, completed: false };

/** 初めて開いた日から days 日目(0始まり)に開いた記録 */
function openedOn(days: number[], start: ReviewState = EMPTY_REVIEW) {
  return days.reduce((s, d) => reviewOnOpen(s, T0 + d * DAY), start);
}

/** 1日1回開いて1回解き終える流れ。お願いした日(0始まり)を返す */
function daily(ends: SessionEnd[], start: ReviewState = EMPTY_REVIEW, from = 0) {
  let s = start;
  const asked: number[] = [];
  ends.forEach((e, i) => {
    const t = T0 + (from + i) * DAY;
    s = reviewOnOpen(s, t);
    const r = reviewOnSessionEnd(s, e, t + HOUR);
    s = r.state;
    if (r.ask) asked.push(from + i);
  });
  return { s, asked };
}

describe('評価のお願いの時機', () => {
  it('苦手ノートから問題を消せた(2回続けて正解した)回の終わりにお願いする', () => {
    expect(daily([plain, clearOne]).asked).toEqual([1]);
  });

  it('初めて開いた日には、うれしい回でも出さない', () => {
    const s = reviewOnOpen(EMPTY_REVIEW, T0);
    expect(reviewOnSessionEnd(s, clearOne, T0 + HOUR).ask).toBe(false);
    expect(reviewOnSessionEnd(s, mockDone, T0 + 5 * HOUR).ask).toBe(false);
    // 次の日なら出す
    expect(reviewOnSessionEnd(reviewOnOpen(s, T0 + DAY), clearOne, T0 + DAY + HOUR).ask).toBe(true);
  });

  it('解き終えた回の終わりでしか判断しない(開いただけではお願いしない)', () => {
    const s = openedOn([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    // reviewOnOpen はお願いの印を付けない
    expect(s.askedAt).toBe(0);
  });

  it('最後の問題が不正解だった回では出さない', () => {
    expect(daily([plain, { ...clearOne, lastOk: false }]).asked).toEqual([]);
    expect(daily([plain, { ...clearOne, lastOk: false }, clearOne]).asked).toEqual([2]);
  });

  it('苦手が外れていない練習の回では出さない(正答率が高くても)', () => {
    expect(daily([plain, { cleared: 0, nigateLeft: 0, correctRate: 1, lastOk: true }, plain]).asked).toEqual([]);
  });

  it('模試を全問答えて最後まで解いたらお願いする。途中で終えた模試では出さない', () => {
    expect(daily([plain, mockDone]).asked).toEqual([1]);
    expect(daily([plain, mockHalf]).asked).toEqual([]);
  });

  it('模試で合格点を超えたらお願いする(未回答があっても)', () => {
    expect(daily([plain, { ...mockHalf, passed: true }]).asked).toEqual([1]);
  });

  it('7日続けて開いて、7日目に解き終えたらお願いする', () => {
    const ends = Array.from({ length: 7 }, () => plain);
    expect(daily(ends).asked).toEqual([6]);
    // 6日続けただけでは出さない
    expect(daily(ends.slice(0, 6)).asked).toEqual([]);
  });

  it('1日でも空くと、続けた日数は1から数え直す', () => {
    const s = openedOn([0, 1, 2, 3, 4, 5, 7]);
    expect(s.openStreak).toBe(1);
    expect(openedOn([0, 1, 2, 3, 4, 5, 6]).openStreak).toBe(7);
    // 同じ日に何度開いても1日
    expect(openedOn([0, 0, 0, 1, 1]).openStreak).toBe(2);
    expect(reviewOnOpen(openedOn([0]), T0 + 3 * HOUR).openStreak).toBe(1);
  });

  it('お願いしたら120日はあける(Apple の年3回と同じくらい)', () => {
    expect(REVIEW_GAP_DAYS).toBe(120);
    // 毎日うれしい回が続いても、次は120日後
    const { asked } = daily(Array.from({ length: 250 }, (_, i) => (i === 0 ? plain : clearOne)));
    expect(asked).toEqual([1, 121, 241]);
    // 1年毎日うれしい回でも、こちらからのお願いは 2日目・122日目・242日目・362日目の4回まで(さらに OS が年3回に絞る)
    const year = daily(Array.from({ length: 365 }, () => ({ ...mockDone, passed: true })));
    expect(year.asked).toEqual([1, 121, 241, 361]);
    for (let k = 1; k < year.asked.length; k++) expect(year.asked[k] - year.asked[k - 1]).toBeGreaterThanOrEqual(120);
  });

  it('前の版から使っている人(解き終えた回がある)は、更新した日でもお願いできる', () => {
    const old = normalizeReview({ sessions: 12, askedAt: 0, cleared: 2 });
    const s = reviewOnOpen(old, T0);
    expect(s.firstAt).toBe(1);
    expect(reviewOnSessionEnd(s, clearOne, T0 + HOUR).ask).toBe(true);
    // 前の版で60日前にお願いしていたら、まだ出さない(120日あける)
    const asked = reviewOnOpen(normalizeReview({ sessions: 12, askedAt: T0 - 60 * DAY, cleared: 2 }), T0);
    expect(reviewOnSessionEnd(asked, clearOne, T0 + HOUR).ask).toBe(false);
  });

  it('数えた回・消せた数の合計・お願いした時刻・開いた日を残す', () => {
    const { s } = daily([plain, clearOne, plain]);
    expect(s).toEqual({ sessions: 3, askedAt: T0 + DAY + HOUR, cleared: 1, firstAt: T0, lastOpenDay: '2026-10-09', openStreak: 3 });
  });

  it('保存した記録が壊れていても0から数える(前の版の記録も読める)', () => {
    expect(normalizeReview(null)).toEqual(EMPTY_REVIEW);
    expect(normalizeReview({ sessions: 'x', askedAt: -5, lastOpenDay: 'きのう', openStreak: 9 })).toEqual(EMPTY_REVIEW);
    expect(normalizeReview({ sessions: 4, askedAt: T0 })).toEqual({ ...EMPTY_REVIEW, sessions: 4, askedAt: T0 });
  });
});

describe('設定の「ストアで評価する」のリンク', () => {
  it('iOS は App Store の評価を書くページ(公開中の2本だけ)', () => {
    expect(storeReviewUrl('ios', 'jp.nigatecho.kanrieiyoushi')).toBe('https://apps.apple.com/app/id6818535389?action=write-review');
    expect(storeReviewUrl('ios', 'jp.nigatecho.rinshokensa')).toBe('https://apps.apple.com/app/id6818536142?action=write-review');
    expect(storeReviewUrl('ios', 'jp.kaigonigate.app')).toBeNull();
  });
  it('Android は Google Play のアプリのページ、ブラウザ版は出さない', () => {
    expect(storeReviewUrl('android', 'jp.kaigonigate.app')).toBe('https://play.google.com/store/apps/details?id=jp.kaigonigate.app&showAllReviews=true');
    expect(storeReviewUrl('web', 'jp.nigatecho.kanrieiyoushi')).toBeNull();
  });
});

describe('結果画面の完全版の案内に出す数', () => {
  const q = (exam: number, no: number): Question => ({
    id: `${exam}-${no}`, exam, session: '午前', no, subject: 's', stem: '', choices: [], answer: [1], excluded: false, note: '', figure: null, source: '',
  });

  it('無料の回を除いた回の範囲と問題数', () => {
    const cfg = { ...EXAMS[0], freeExams: [40] };
    const all = [q(36, 1), q(37, 1), q(37, 2), q(39, 1), q(40, 1), q(40, 2)];
    expect(lockedSummary(all, cfg)).toEqual({ from: 36, to: 39, count: 4 });
  });

  it('全部無料なら出さない', () => {
    const cfg = { ...EXAMS[0], freeExams: [40] };
    expect(lockedSummary([q(40, 1)], cfg)).toBeNull();
  });

  it('どの試験でも、収録数から無料の回を引いた数になる', () => {
    for (const e of EXAMS) {
      const rounds = e.rounds ?? [];
      const locked = rounds.filter((r) => !e.freeExams.includes(r));
      // 看護師は準備の版で無料の第115回だけ。鍵のかかる回が無いので案内は出さない
      if (e.dir === 'nurse' && locked.length === 0) { expect(lockedSummary(rounds.map((r) => q(r, 1)), e)).toBeNull(); continue; }
      expect(locked.length, e.name).toBeGreaterThan(0);
      // 1回分の問題数で並べた見本で、範囲が「第(最小)〜(最大)回」になる
      const all = rounds.flatMap((r) => [q(r, 1), q(r, 2)]);
      const s = lockedSummary(all, e)!;
      expect(examRange(s.from, s.to), e.name).toBe(examRange(Math.min(...locked), Math.max(...locked)));
      expect(s.count).toBe(locked.length * 2);
    }
  });
});
