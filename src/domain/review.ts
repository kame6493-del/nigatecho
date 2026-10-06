/**
 * ストアの評価をお願いする時機。苦手が減った直後(うれしい瞬間)に寄せる。
 * 出すかどうかは最後に OS が決める(Apple は1年に3回まで)。見返りとは結びつけない。
 * 記録は試験をまたいで1つ(端末に1つ)。
 */
export interface ReviewState {
  /** 解き終えた回(練習・模試)の数 */
  sessions: number;
  /** 最後にお願いした時刻(ms)。0 = まだ */
  askedAt: number;
}

export interface SessionEnd {
  /** この回で苦手から外れた数 */
  cleared: number;
  /** 解き終えた時点で残っている苦手の数 */
  nigateLeft: number;
  /** この回の正答率 0〜1 */
  correctRate: number;
}

export const EMPTY_REVIEW: ReviewState = { sessions: 0, askedAt: 0 };

const DAY = 86400000;
/** お願いの間は60日あける */
export const REVIEW_GAP_DAYS = 60;
/** 2回目に解き終えた所から */
export const REVIEW_MIN_SESSIONS = 2;
/** 1回で苦手がこれだけ外れたら */
export const REVIEW_CLEARED = 3;
/** 苦手の動きが無いまま解き続けている人には、前と同じ「よく解けた回」で(5回目から) */
export const REVIEW_FALLBACK_SESSIONS = 5;
export const REVIEW_FALLBACK_RATE = 0.7;

/** 1回解き終えたときに呼ぶ。次の記録と、いまお願いするかを返す */
export function reviewOnSessionEnd(s: ReviewState, e: SessionEnd, now: number): { state: ReviewState; ask: boolean } {
  const sessions = s.sessions + 1;
  const rested = !s.askedAt || now - s.askedAt >= REVIEW_GAP_DAYS * DAY;
  const success = e.cleared >= REVIEW_CLEARED || (e.cleared > 0 && e.nigateLeft === 0);
  const fallback = !s.askedAt && sessions >= REVIEW_FALLBACK_SESSIONS && e.correctRate >= REVIEW_FALLBACK_RATE;
  const ask = sessions >= REVIEW_MIN_SESSIONS && rested && (success || fallback);
  return { state: { sessions, askedAt: ask ? now : s.askedAt }, ask };
}

export function normalizeReview(x: unknown): ReviewState {
  const o = (x ?? {}) as Partial<ReviewState>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return { sessions: n(o.sessions), askedAt: n(o.askedAt) };
}
