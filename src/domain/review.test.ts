import { describe, expect, it } from 'vitest';
import { EMPTY_REVIEW, REVIEW_GAP_DAYS, REVIEW_MAX_ASKS, REVIEW_MIN_DAYS, REVIEW_MIN_SESSIONS, REVIEW_PAYWALL_QUIET_MIN, canCallStoreReview, normalizeReview, reviewOnOpen, reviewOnPaywall, reviewOnSessionEnd, storeReviewUrl, type ReviewState, type SessionEnd } from './review';
import { examRange, lockedSummary } from './study';
import { EXAMS } from './exam';
import type { Question } from './types';

const DAY = 86400000;
const HOUR = 3600000;
const MIN = 60000;
const T0 = new Date(2026, 9, 7, 9).getTime();
const plain: SessionEnd = { cleared: 0, nigateLeft: 5, correctRate: 0.5, lastOk: true };
const clearOne: SessionEnd = { cleared: 1, nigateLeft: 4, correctRate: 0.7, lastOk: true };
const mockPass: SessionEnd = { cleared: 0, nigateLeft: -1, correctRate: 0.7, passed: true, completed: true };
const mockDone: SessionEnd = { cleared: 0, nigateLeft: -1, correctRate: 0.5, passed: false, completed: true };
const p = (rate: number, answered = 10): SessionEnd => ({ cleared: 0, nigateLeft: 5, correctRate: rate, lastOk: true, answered });

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

/** 使い始めて days 日たち、解き終えた回が n 回ある人(まだお願いしていない) */
function veteran(days: number, n: number): ReviewState {
  const s = reviewOnOpen(EMPTY_REVIEW, T0);
  return reviewOnOpen({ ...s, sessions: n }, T0 + days * DAY);
}
const at = (days: number) => T0 + days * DAY + HOUR;

describe('評価のお願いの時機(1.4.6)', () => {
  it('条件の数: 3日・5回・購入画面から30分・1年', () => {
    expect([REVIEW_MIN_DAYS, REVIEW_MIN_SESSIONS, REVIEW_PAYWALL_QUIET_MIN, REVIEW_GAP_DAYS, REVIEW_MAX_ASKS]).toEqual([3, 5, 30, 30, 3]);
  });

  it('使い始めて3日以上・5回目以上で、苦手ノートから消せた回の終わりにお願いする', () => {
    expect(reviewOnSessionEnd(veteran(3, 4), clearOne, at(3)).ask).toBe(true);
    // 毎日1回: 0〜3日目は回数か日数が足りず、4日目(5回目)に出す
    expect(daily([plain, clearOne, clearOne, clearOne, clearOne, clearOne]).asked).toEqual([4]);
  });

  it('練習(5問以上)の正答率が前の回より上がって6割以上ならお願いする', () => {
    const a = reviewOnSessionEnd(veteran(4, 4), p(0.5), at(4)).state;
    expect(reviewOnSessionEnd(veteran(4, 4), p(0.5), at(4)).ask).toBe(false);
    expect(reviewOnSessionEnd(a, p(0.7), at(4) + HOUR).ask).toBe(true);
    // 上がっても6割未満・同じ正答率・5問未満の回では出さない
    const low = reviewOnSessionEnd(veteran(4, 4), p(0.3), at(4)).state;
    expect(reviewOnSessionEnd(low, p(0.5), at(4) + HOUR).ask).toBe(false);
    const same = reviewOnSessionEnd(veteran(4, 4), p(0.7), at(4)).state;
    expect(reviewOnSessionEnd(same, p(0.7), at(4) + HOUR).ask).toBe(false);
    expect(reviewOnSessionEnd(low, p(1, 4), at(4) + HOUR).ask).toBe(false);
    expect(reviewOnSessionEnd(low, p(1, 4), at(4) + HOUR).state.lastRate).toBe(0.3);
    // 模試は練習の正答率に数えない
    expect(reviewOnSessionEnd(veteran(4, 4), { ...mockDone, correctRate: 0.9 }, at(4)).state.lastRate).toBe(-1);
  });

  it('模試は合格点を超えた時だけ。最後まで解いただけでは出さない', () => {
    expect(reviewOnSessionEnd(veteran(5, 9), mockPass, at(5)).ask).toBe(true);
    expect(reviewOnSessionEnd(veteran(5, 9), mockDone, at(5)).ask).toBe(false);
  });

  it('ただ解き終えた回・3日目・続けて開いただけでは出さない(良い体験の直後だけ)', () => {
    expect(daily(Array.from({ length: 30 }, () => plain)).asked).toEqual([]);
  });

  it('最初の起動の日・使い始めて3日たたない間は、良い回でも出さない', () => {
    const d0 = reviewOnOpen({ ...EMPTY_REVIEW, sessions: 20 }, T0);
    // sessions があると前の版の人とみなすので、新しい人として firstAt を今にする
    const fresh = { ...d0, firstAt: T0 };
    expect(reviewOnSessionEnd(fresh, clearOne, T0 + HOUR).ask).toBe(false);
    expect(reviewOnSessionEnd(reviewOnOpen(fresh, T0 + 2 * DAY), clearOne, T0 + 2 * DAY + HOUR).ask).toBe(false);
    expect(reviewOnSessionEnd(reviewOnOpen(fresh, T0 + 3 * DAY), clearOne, T0 + 3 * DAY + HOUR).ask).toBe(true);
  });

  it('解き終えた回が5回に満たない人には出さない', () => {
    expect(reviewOnSessionEnd(veteran(10, 3), clearOne, at(10)).ask).toBe(false);
    expect(reviewOnSessionEnd(veteran(10, 4), clearOne, at(10)).ask).toBe(true);
  });

  it('最後の問題が不正解だった回(間違えた直後)では出さない', () => {
    expect(reviewOnSessionEnd(veteran(5, 9), { ...clearOne, lastOk: false }, at(5)).ask).toBe(false);
    const a = reviewOnSessionEnd(veteran(5, 9), p(0.5), at(5)).state;
    expect(reviewOnSessionEnd(a, { ...p(0.8), lastOk: false }, at(5) + HOUR).ask).toBe(false);
  });

  it('購入画面を開いてから30分は出さない(課金の画面の直後)', () => {
    const s = reviewOnPaywall(veteran(5, 9), at(5));
    expect(reviewOnSessionEnd(s, clearOne, at(5) + 10 * MIN).ask).toBe(false);
    expect(reviewOnSessionEnd(s, clearOne, at(5) + 29 * MIN).ask).toBe(false);
    expect(reviewOnSessionEnd(s, clearOne, at(5) + 30 * MIN).ask).toBe(true);
  });

  it('お願いしたら30日あけ、1人に最大3回まで(1.4.8)', () => {
    const { s, asked } = daily(Array.from({ length: 400 }, () => clearOne));
    expect(asked).toEqual([4, 34, 64]);
    expect(s.asks).toBe(3);
  });

  it('お願いした後の29日は良い回でも出さず、30日目から出す', () => {
    const first = reviewOnSessionEnd(veteran(5, 9), clearOne, at(5));
    expect(first.ask).toBe(true);
    expect(first.state.asks).toBe(1);
    const s29 = reviewOnOpen(first.state, at(5) + 29 * DAY);
    expect(reviewOnSessionEnd(s29, clearOne, at(5) + 29 * DAY + HOUR).ask).toBe(false);
    const s30 = reviewOnOpen(first.state, at(5) + 30 * DAY);
    const r = reviewOnSessionEnd(s30, clearOne, at(5) + 30 * DAY + HOUR);
    expect(r.ask).toBe(true);
    expect(r.state.asks).toBe(2);
  });

  it('3回お願いした人には、何年たっても出さない', () => {
    const s = reviewOnOpen({ ...veteran(5, 9), asks: 3, askedAt: T0 }, T0 + 1000 * DAY);
    expect(reviewOnSessionEnd(s, clearOne, T0 + 1000 * DAY + HOUR).ask).toBe(false);
  });

  it('出さなかった回は回数に数えない', () => {
    const r = reviewOnSessionEnd(veteran(5, 9), plain, at(5));
    expect(r.ask).toBe(false);
    expect(r.state.asks).toBe(0);
    expect(r.state.askedAt).toBe(0);
  });

  it('開いただけではお願いしない', () => {
    let s = EMPTY_REVIEW;
    for (let d = 0; d < 10; d++) s = reviewOnOpen(s, T0 + d * DAY);
    expect(s.askedAt).toBe(0);
  });

  it('前の版から使っている人(解き終えた回がある)は、使い始めた日をずっと前とみなす', () => {
    const old = reviewOnOpen(normalizeReview({ sessions: 12, askedAt: 0, cleared: 2 }), T0);
    expect(old.firstAt).toBe(1);
    expect(reviewOnSessionEnd(old, clearOne, T0 + HOUR).ask).toBe(true);
    // 前の版で20日前にお願いしていたら、まだ出さない(30日あける)。60日前なら出す。前の版の1回も3回に数える
    const recent = reviewOnOpen(normalizeReview({ sessions: 12, askedAt: T0 - 20 * DAY, cleared: 2 }), T0);
    expect(recent.asks).toBe(1);
    expect(reviewOnSessionEnd(recent, clearOne, T0 + HOUR).ask).toBe(false);
    const asked = reviewOnOpen(normalizeReview({ sessions: 12, askedAt: T0 - 60 * DAY, cleared: 2 }), T0);
    const r = reviewOnSessionEnd(asked, clearOne, T0 + HOUR);
    expect(r.ask).toBe(true);
    expect(r.state.asks).toBe(2);
  });

  it('保存した記録が壊れていても0から数える(前の版の記録も読める)', () => {
    expect(normalizeReview(null)).toEqual(EMPTY_REVIEW);
    expect(normalizeReview({ sessions: 'x', askedAt: -5, lastOpenDay: 'きのう', openStreak: 9, openDays: 4, lastRate: 3, paywallAt: 'x' })).toEqual(EMPTY_REVIEW);
    expect(normalizeReview({ sessions: 4, askedAt: T0 })).toEqual({ ...EMPTY_REVIEW, sessions: 4, askedAt: T0, asks: 1 });
    expect(normalizeReview({ asks: 9, askedAt: T0 }).asks).toBe(3);
    expect(normalizeReview({ asks: -1 }).asks).toBe(0);
    expect(normalizeReview({ paywallAt: T0 }).paywallAt).toBe(T0);
  });
});

describe('OS の評価の画面を呼ぶ所', () => {
  it('iOS・Android のアプリだけ。ブラウザ版・開発用の表示・審査用の録画ビルドでは呼ばない', () => {
    expect(canCallStoreReview('ios', false)).toBe(true);
    expect(canCallStoreReview('android', false)).toBe(true);
    expect(canCallStoreReview('web', false)).toBe(false);
    expect(canCallStoreReview('web', true)).toBe(false);
    expect(canCallStoreReview('ios', true)).toBe(false);
    expect(canCallStoreReview('android', false, true)).toBe(false);
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
      expect(locked.length, e.name).toBeGreaterThan(0);
      // 1回分の問題数で並べた見本で、範囲が「第(最小)〜(最大)回」になる
      const all = rounds.flatMap((r) => [q(r, 1), q(r, 2)]);
      const s = lockedSummary(all, e)!;
      expect(examRange(s.from, s.to), e.name).toBe(examRange(Math.min(...locked), Math.max(...locked)));
      expect(s.count).toBe(locked.length * 2);
    }
  });
});
