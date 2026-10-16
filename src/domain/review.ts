/**
 * ストアの評価をお願いする時機。うれしいことがあった直後(苦手ノートから問題を消せた・模試を最後まで解いた・7日続けて開いた)だけ。
 * 出すのは OS の評価の画面(iOS は SKStoreReviewController、Android は Google Play In-App Review)だけで、
 * 自前の「星をつけて」「気に入りましたか?」の画面は作らない。評価と見返り(解放・完全版など)は結びつけない。
 * 出すかどうかは最後に OS が決める(Apple は1年に3回まで)。こちらは120日に1回まで。
 * 初めて開いた日・解いている途中(回の終わり以外)には出さない。記録は試験をまたいで1つ(端末に1つ)。
 */
import { dayKey } from './study';

export interface ReviewState {
  /** 解き終えた回(練習・模試)の数 */
  sessions: number;
  /** 最後にお願いした時刻(ms)。0 = まだ */
  askedAt: number;
  /** これまでに苦手ノートから消せた数(練習で2回続けて正解して外れた数の合計) */
  cleared: number;
  /** 初めて開いた時刻(ms)。0 = まだ数えていない。前の版から使っている人は 1(ずっと前) */
  firstAt: number;
  /** 最後に開いた日(YYYY-MM-DD、端末の暦)。'' = まだ */
  lastOpenDay: string;
  /** 何日続けて開いているか(今日を含む) */
  openStreak: number;
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
  /** 模試を全問答えて最後まで解いたか */
  completed?: boolean;
}

export const EMPTY_REVIEW: ReviewState = { sessions: 0, askedAt: 0, cleared: 0, firstAt: 0, lastOpenDay: '', openStreak: 0 };

const DAY = 86400000;
/** お願いの間は120日あける(Apple の上限 年3回と同じくらいに、こちらからも絞る) */
export const REVIEW_GAP_DAYS = 120;
/** 何日続けて開いたら「続けられた」とみなすか */
export const REVIEW_STREAK_DAYS = 7;

/** 前の日の日付(端末の暦。夏時間のある地域でもずれないよう正午で数える) */
function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
}

/** アプリを開いた(前に出した)ときに呼ぶ。初めて開いた日と、何日続けて開いているかを数える。ここではお願いしない */
export function reviewOnOpen(s: ReviewState, now: number): ReviewState {
  const today = dayKey(now);
  // 前の版から使っている人(解き終えた回がある)は、初めての日をずっと前とみなす
  const firstAt = s.firstAt || (s.sessions > 0 ? 1 : now);
  if (s.lastOpenDay === today) return { ...s, firstAt };
  const openStreak = s.lastOpenDay && s.lastOpenDay === prevDay(today) ? s.openStreak + 1 : 1;
  return { ...s, firstAt, lastOpenDay: today, openStreak };
}

/** いまお願いしてよい間か(初めて開いた日でなく、前のお願いから120日たった) */
export function reviewRested(s: ReviewState, now: number): boolean {
  const notFirstDay = s.firstAt > 0 && dayKey(s.firstAt) !== dayKey(now);
  const rested = !s.askedAt || now - s.askedAt >= REVIEW_GAP_DAYS * DAY;
  return notFirstDay && rested;
}

/** 1回解き終えたときに呼ぶ。次の記録と、いまお願いするかを返す */
export function reviewOnSessionEnd(s0: ReviewState, e: SessionEnd, now: number): { state: ReviewState; ask: boolean } {
  // 開いた記録が無いまま呼ばれても(念のため)今日を数えてから見る
  const s = reviewOnOpen(s0, now);
  const sessions = s.sessions + 1;
  const cleared = s.cleared + Math.max(0, e.cleared);
  // 不正解を見た直後には出さない
  const happy = e.lastOk !== false;
  // 練習: この回で苦手ノートから1問以上消せた(2回続けて正解した)
  const clearedWin = e.cleared > 0;
  // 模試: 全問答えて最後まで解いた、または合格点を超えた
  const mockWin = e.completed === true || e.passed === true;
  // 7日続けて開いて、今日も1回解き終えた
  const streakWin = s.openStreak >= REVIEW_STREAK_DAYS && s.lastOpenDay === dayKey(now);
  const ask = reviewRested(s, now) && happy && (clearedWin || mockWin || streakWin);
  return { state: { ...s, sessions, askedAt: ask ? now : s.askedAt, cleared }, ask };
}

export function normalizeReview(x: unknown): ReviewState {
  const o = (x ?? {}) as Partial<ReviewState>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const day = typeof o.lastOpenDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.lastOpenDay) ? o.lastOpenDay : '';
  return {
    sessions: n(o.sessions), askedAt: n(o.askedAt), cleared: n(o.cleared),
    firstAt: n(o.firstAt), lastOpenDay: day, openStreak: day ? Math.floor(n(o.openStreak)) : 0,
  };
}

/** 端末の「評価を書く」ページ(設定のリンク用)。iOS は App Store、Android は Google Play。出していない所は null */
const APP_STORE_IDS: Record<string, string> = {
  'jp.nigatecho.kanrieiyoushi': '6818535389', // まとめ版ニガテ帳
  'jp.nigatecho.rinshokensa': '6818536142', // 臨床検査技師ニガテ帳
};
export function storeReviewUrl(platform: string, appId: string): string | null {
  if (platform === 'ios') {
    const id = APP_STORE_IDS[appId];
    return id ? `https://apps.apple.com/app/id${id}?action=write-review` : null;
  }
  if (platform === 'android') return `https://play.google.com/store/apps/details?id=${appId}&showAllReviews=true`;
  return null;
}
