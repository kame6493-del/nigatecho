/**
 * ストアの評価をお願いする時機。うれしい瞬間(苦手を消せた・模試で合格点を超えた)に寄せる。
 * 出すのは OS の評価の画面(SKStoreReviewController)だけで、自前の「星をつけて」の画面は作らない。
 * 出すかどうかは最後に OS が決める(Apple は1年に3回まで)。こちらは60日に1回まで。見返りとは結びつけない。
 * 記録は試験をまたいで1つ(端末に1つ)。
 */
export interface ReviewState {
  /** 解き終えた回(練習・模試)の数 */
  sessions: number;
  /** 最後にお願いした時刻(ms)。0 = まだ */
  askedAt: number;
  /** これまでに苦手ノートから消せた数(練習で2回続けて正解して外れた数の合計) */
  cleared: number;
}

export interface SessionEnd {
  /** この回で苦手から外れた数 */
  cleared: number;
  /** 解き終えた時点で残っている苦手の数。模試は -1(数えない) */
  nigateLeft: number;
  /** この回の正答率 0〜1 */
  correctRate: number;
  /** 練習で最後に解いた問題が正解だったか(不正解の直後には出さない)。模試は無し */
  lastOk?: boolean;
  /** 模試で合格点を超えたか */
  passed?: boolean;
}

export const EMPTY_REVIEW: ReviewState = { sessions: 0, askedAt: 0, cleared: 0 };

const DAY = 86400000;
/** お願いの間は60日あける(Apple の上限 年3回より少なく) */
export const REVIEW_GAP_DAYS = 60;
/** 練習は2回目に解き終えた所から(初めての回では出さない) */
export const REVIEW_MIN_SESSIONS = 2;
/** 苦手ノートから消せた数の合計がこれに届いたら(3問目を消せたとき) */
export const REVIEW_CLEARED = 3;
/** 苦手の動きが無いまま解き続けている人には、前と同じ「よく解けた回」で(5回目から) */
export const REVIEW_FALLBACK_SESSIONS = 5;
export const REVIEW_FALLBACK_RATE = 0.7;

/** 1回解き終えたときに呼ぶ。次の記録と、いまお願いするかを返す */
export function reviewOnSessionEnd(s: ReviewState, e: SessionEnd, now: number): { state: ReviewState; ask: boolean } {
  const sessions = s.sessions + 1;
  const cleared = s.cleared + Math.max(0, e.cleared);
  const rested = !s.askedAt || now - s.askedAt >= REVIEW_GAP_DAYS * DAY;
  // 不正解を見た直後には出さない
  const happy = e.lastOk !== false;
  // 練習: この回で苦手を消せて、消せた数の合計が3問以上(または苦手が0になった)
  const clearedWin = e.cleared > 0 && (cleared >= REVIEW_CLEARED || e.nigateLeft === 0) && sessions >= REVIEW_MIN_SESSIONS;
  // 模試: 合格点を超えた(模試は1回で全部を解くので、初めての回でもよい)
  const mockWin = e.passed === true;
  const fallback = !s.askedAt && sessions >= REVIEW_FALLBACK_SESSIONS && e.correctRate >= REVIEW_FALLBACK_RATE;
  const ask = rested && happy && (clearedWin || mockWin || fallback);
  return { state: { sessions, askedAt: ask ? now : s.askedAt, cleared }, ask };
}

export function normalizeReview(x: unknown): ReviewState {
  const o = (x ?? {}) as Partial<ReviewState>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return { sessions: n(o.sessions), askedAt: n(o.askedAt), cleared: n(o.cleared) };
}
