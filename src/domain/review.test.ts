import { describe, expect, it } from 'vitest';
import { EMPTY_REVIEW, normalizeReview, reviewOnSessionEnd, type ReviewState, type SessionEnd } from './review';
import { examRange, lockedSummary } from './study';
import { EXAMS } from './exam';
import type { Question } from './types';

const DAY = 86400000;
const T0 = new Date(2026, 9, 7, 12).getTime();
const plain: SessionEnd = { cleared: 0, nigateLeft: 5, correctRate: 0.5 };

/** 解き終えた回を順に流して、お願いした回の番号(1始まり)を返す */
function run(ends: SessionEnd[], start: ReviewState = EMPTY_REVIEW, t = T0, step = DAY) {
  let s = start;
  const asked: number[] = [];
  ends.forEach((e, i) => {
    const r = reviewOnSessionEnd(s, e, t + i * step);
    s = r.state;
    if (r.ask) asked.push(i + 1);
  });
  return { s, asked };
}

describe('評価のお願いの時機', () => {
  it('1回の練習で苦手が3問外れたらお願いする', () => {
    expect(run([plain, { cleared: 3, nigateLeft: 4, correctRate: 0.6 }]).asked).toEqual([2]);
  });

  it('最後の苦手を片づけた(残り0)ときもお願いする', () => {
    expect(run([plain, { cleared: 1, nigateLeft: 0, correctRate: 1 }]).asked).toEqual([2]);
  });

  it('初めて解き終えた回では出さない(2回目から)', () => {
    expect(run([{ cleared: 5, nigateLeft: 0, correctRate: 1 }]).asked).toEqual([]);
  });

  it('苦手が2問外れただけ・苦手がもともと無いだけでは出さない', () => {
    expect(run([plain, { cleared: 2, nigateLeft: 3, correctRate: 1 }, { cleared: 0, nigateLeft: 0, correctRate: 1 }]).asked).toEqual([]);
  });

  it('お願いしたら60日はあける', () => {
    const win = { cleared: 3, nigateLeft: 0, correctRate: 1 };
    // 毎日うれしい回が続いても、次は60日後
    const { asked } = run(Array.from({ length: 70 }, (_, i) => (i === 0 ? plain : win)));
    expect(asked).toEqual([2, 62]);
  });

  it('苦手の動きが無いまま解き続けている人には、5回目以降のよく解けた回で1度だけ(前の条件)', () => {
    const good = { cleared: 0, nigateLeft: 0, correctRate: 0.8 };
    expect(run([good, good, good, good]).asked).toEqual([]);
    expect(run([good, good, good, good, good]).asked).toEqual([5]);
    // 2度目以降は前の条件では出さない(苦手が減った直後だけ)
    const first = run([good, good, good, good, good]).s;
    expect(run([good], first, T0 + 100 * DAY).asked).toEqual([]);
    expect(run([{ cleared: 3, nigateLeft: 2, correctRate: 0.6 }], first, T0 + 100 * DAY).asked).toEqual([1]);
  });

  it('模試(苦手の出入りを数えない)は前の条件だけ', () => {
    const mock = { cleared: 0, nigateLeft: -1, correctRate: 0.9 };
    expect(run([mock, mock]).asked).toEqual([]);
    expect(run([mock, mock, mock, mock, mock]).asked).toEqual([5]);
  });

  it('数えた回とお願いした時刻を残す', () => {
    const { s } = run([plain, { cleared: 3, nigateLeft: 0, correctRate: 1 }, plain]);
    expect(s).toEqual({ sessions: 3, askedAt: T0 + DAY });
  });

  it('保存した記録が壊れていても0から数える', () => {
    expect(normalizeReview(null)).toEqual(EMPTY_REVIEW);
    expect(normalizeReview({ sessions: 'x', askedAt: -5 })).toEqual(EMPTY_REVIEW);
    expect(normalizeReview({ sessions: 4, askedAt: T0 })).toEqual({ sessions: 4, askedAt: T0 });
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
