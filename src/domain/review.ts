/**
 * ストアの評価をお願いする時機(1.4.6 から。出す条件はこのファイルの reviewOnSessionEnd と canCallStoreReview の2つだけ)。
 * 出すのは OS の評価の画面(iOS は SKStoreReviewController、Android は Google Play In-App Review)だけで、
 * 自前の「星をつけて」「気に入りましたか?」の画面は作らない。評価と見返り(解放・完全版など)は結びつけない(App Store 5.6.1・Play の決まり)。
 *
 * 出すのは、次のすべてを満たす回の終わりだけ。
 * - 良い体験の直後: 苦手ノートから問題を消せた / 練習(5問以上)の正答率が前の練習の回より上がって6割以上 / 模試で合格点を超えた
 * - 最後に解いた問題が正解だった(間違えた直後には出さない)
 * - 使い始めてから3日以上たち、解き終えた回がこの回を含めて5回以上(最初の起動・使い始めたばかりの人には出さない)
 * - 購入画面を開いてから30分以上たっている(課金の画面の直後には出さない)
 * - 前にお願いしてから1年以上(こちらからは1年に1回。Apple の上限は年3回、Google も回数を絞る。出すかどうかは最後に OS が決める)
 * 解いている途中・開いただけの時には判断しない。記録は試験をまたいで1つ(端末に1つ)。
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
  /** 何日続けて開いているか(今日を含む)。1.4.6 からは判断に使わないが、記録は続ける */
  openStreak: number;
  /** 開いた日の数(今日を含む)。1.4.6 からは判断に使わないが、記録は続ける */
  openDays: number;
  /** 前の練習の回(5問以上)の正答率 0〜1。-1 = まだ無い */
  lastRate: number;
  /** 最後に購入画面を開いた時刻(ms)。0 = まだ */
  paywallAt: number;
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
  /** 模試を全問答えて最後まで解いたか(記録用。1.4.6 からはこれだけではお願いしない) */
  completed?: boolean;
  /** 練習でこの回に答えた問題の数(正答率を前の回と比べるのは5問以上の回だけ)。模試は無し */
  answered?: number;
}

export const EMPTY_REVIEW: ReviewState = { sessions: 0, askedAt: 0, cleared: 0, firstAt: 0, lastOpenDay: '', openStreak: 0, openDays: 0, lastRate: -1, paywallAt: 0 };

const DAY = 86400000;
const MIN = 60000;
/** お願いの間は1年あける(Apple の上限は年3回。こちらからは1年に1回だけ呼ぶ) */
export const REVIEW_GAP_DAYS = 365;
/** 使い始めてから何日たったらお願いしてよいか */
export const REVIEW_MIN_DAYS = 3;
/** 解き終えた回が何回以上ならお願いしてよいか(この回を含む) */
export const REVIEW_MIN_SESSIONS = 5;
/** 購入画面を開いてから何分はお願いしないか */
export const REVIEW_PAYWALL_QUIET_MIN = 30;
/** 正答率を前の回と比べる練習の回の最少の問題数 */
export const REVIEW_RATE_MIN = 5;
/** 正答率が上がったとみなす下限(上がっても低すぎる回では出さない) */
export const REVIEW_RATE_FLOOR = 0.6;

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
  const openDays = (s.openDays || (s.sessions > 0 ? 2 : 0)) + 1;
  return { ...s, firstAt, lastOpenDay: today, openStreak, openDays };
}

/** 購入画面を開いたときに呼ぶ。ここから30分はお願いしない */
export function reviewOnPaywall(s: ReviewState, now: number): ReviewState {
  return { ...s, paywallAt: now };
}

/** いまお願いしてよい人・間か(使い始めて3日以上・5回以上解いた・購入画面の直後でない・前のお願いから1年)。sessions はこの回を含めた数 */
export function reviewRested(s: ReviewState, now: number): boolean {
  const oldEnough = s.firstAt > 0 && now - s.firstAt >= REVIEW_MIN_DAYS * DAY;
  const usedEnough = s.sessions >= REVIEW_MIN_SESSIONS;
  const notAfterPaywall = !s.paywallAt || now - s.paywallAt >= REVIEW_PAYWALL_QUIET_MIN * MIN;
  const rested = !s.askedAt || now - s.askedAt >= REVIEW_GAP_DAYS * DAY;
  return oldEnough && usedEnough && notAfterPaywall && rested;
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
  const clearedWin = e.nigateLeft >= 0 && e.cleared > 0;
  // 模試: 合格点を超えた
  const mockWin = e.passed === true;
  // 練習(5問以上)の正答率が前の練習の回より上がって、6割以上だった
  const practice = e.nigateLeft >= 0 && (e.answered ?? 0) >= REVIEW_RATE_MIN;
  const rate = Math.min(1, Math.max(0, Number.isFinite(e.correctRate) ? e.correctRate : 0));
  const rateWin = practice && s.lastRate >= 0 && rate > s.lastRate && rate >= REVIEW_RATE_FLOOR;
  const lastRate = practice ? rate : s.lastRate;
  const ask = reviewRested({ ...s, sessions }, now) && happy && (clearedWin || mockWin || rateWin);
  return { state: { ...s, sessions, askedAt: ask ? now : s.askedAt, cleared, lastRate }, ask };
}

/** OS の評価の画面を呼んでよい所か。iOS・Android のアプリだけ。ブラウザ版・開発用の表示(vite dev)・審査用の録画ビルドでは呼ばない */
export function canCallStoreReview(platform: string, dev: boolean, tour = false): boolean {
  return (platform === 'ios' || platform === 'android') && !dev && !tour;
}

export function normalizeReview(x: unknown): ReviewState {
  const o = (x ?? {}) as Partial<ReviewState>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const day = typeof o.lastOpenDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.lastOpenDay) ? o.lastOpenDay : '';
  return {
    sessions: n(o.sessions), askedAt: n(o.askedAt), cleared: n(o.cleared),
    firstAt: n(o.firstAt), lastOpenDay: day, openStreak: day ? Math.floor(n(o.openStreak)) : 0,
    openDays: day ? Math.floor(n(o.openDays)) : 0,
    lastRate: typeof o.lastRate === 'number' && o.lastRate >= 0 && o.lastRate <= 1 ? o.lastRate : -1,
    paywallAt: n(o.paywallAt),
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
