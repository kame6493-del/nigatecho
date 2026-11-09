/**
 * 結果の画面を出たあとに1回だけ出す「この試験の続き」の案内(2026-11-09 から)。
 * 毎日戻ってくる人が、ひと区切り解き終えて結果を見たあと、ホームへ戻るときに下から1枚出す。
 * 中身は本人の記録と問題データから数えた本当の数だけ(無料の回の残り・苦手の科目が完全版で何問になるか・完全版の問題数と試験日まで)。
 * 値段は出さない(購入画面の値段はストアの priceString)。期限・残り時間で急がせない。閉じるボタンは大きく、外を押しても閉じる。
 *
 * 出すのは、次のすべてを満たすときだけ。条件はこのファイルの afterResultDecide の1か所にまとめる。
 * - この試験を買っていない・鍵のかかった回がある・購入できる状態(ブラウザ版では出さない)
 * - ひと区切り解き終えた: 練習で5問以上答えた回 / 模試を全問答えて採点した回
 * - 結果の画面から「ホームへ戻る」か × で出た(「苦手を解く」「もう一度」で続けて解く人には出さない)
 * - 戻ってきた人: 使い始めた日とは別の日(はじめて入れた日には出さない)
 * - 同じ日に1回まで(試験をまたいで端末に1つ)
 * - 今日すでに購入画面を開いた人には出さない
 * - この回の終わりに OS の評価の窓を呼んだときは出さない(窓を重ねない)
 * - 3回続けて閉じた人には、7日あける(あけたら数え直す)
 */
import type { AppData, ExamConfig, Question } from './types';
import { dayKey, daysLeft, examRange, lockedSummary, unseen } from './study';
import { freeLeft, partRows, subPassGrowth, weakSubjectGrowth } from './upsell';

export interface AfterResultState {
  /** 最後に出した日(YYYY-MM-DD、端末の暦)。'' = まだ */
  shownDay: string;
  /** これまでに出した回数 */
  shown: number;
  /** 続けて閉じた回数(購入画面へ進んだら 0 に戻す) */
  closedRun: number;
  /** この時刻(ms)までは出さない。0 = 休みなし */
  restUntil: number;
}

export const EMPTY_AFTER_RESULT: AfterResultState = { shownDay: '', shown: 0, closedRun: 0, restUntil: 0 };

/** 練習でひと区切りとみなす、答えた問題の数 */
export const AFTER_RESULT_MIN_ANSWERED = 5;
/** 続けて何回閉じたら休むか */
export const AFTER_RESULT_CLOSE_LIMIT = 3;
/** 休む日数 */
export const AFTER_RESULT_REST_DAYS = 7;

const DAY = 86400000;

export interface AfterResultInput {
  premium: boolean;
  /** 鍵のかかった回があるか(lockedSummary が null でない) */
  hasLocked: boolean;
  /** 購入できる状態か(billing.status === 'ready') */
  canBuy: boolean;
  /** 模試か */
  mock: boolean;
  /** 練習で答えた問題の数 */
  answered: number;
  /** 模試を全問答えて採点したか */
  completed: boolean;
  /** 結果の画面からどう出たか。home = ホームへ戻る・×、study = 続けて解く(苦手を解く・もう一度)、paywall = 購入画面へ */
  leave: 'home' | 'study' | 'paywall';
  /** 使い始めた時刻(評価の記録の firstAt。前の版から使っている人は 1) */
  firstAt: number;
  /** 最後に購入画面を開いた時刻(評価の記録の paywallAt) */
  paywallAt: number;
  /** この回の終わりに OS の評価の窓を呼んだか */
  reviewAsked: boolean;
}

/** 結果の画面を出たときに呼ぶ。いま出すかどうか */
export function afterResultDecide(s: AfterResultState, i: AfterResultInput, now: number): boolean {
  if (i.premium || !i.hasLocked || !i.canBuy) return false;
  if (i.leave !== 'home') return false;
  const oneRound = i.mock ? i.completed : i.answered >= AFTER_RESULT_MIN_ANSWERED;
  if (!oneRound) return false;
  const today = dayKey(now);
  // はじめて入れた日には出さない(戻ってきた人だけ)
  if (!(i.firstAt > 0) || dayKey(i.firstAt) === today) return false;
  if (s.shownDay === today) return false;
  if (i.paywallAt > 0 && dayKey(i.paywallAt) === today) return false;
  if (i.reviewAsked) return false;
  if (s.restUntil > now) return false;
  return true;
}

/** 出したときの記録 */
export function afterResultShown(s: AfterResultState, now: number): AfterResultState {
  return { ...s, shownDay: dayKey(now), shown: s.shown + 1 };
}

/** 閉じたときの記録。3回続けて閉じたら7日休む */
export function afterResultClosed(s: AfterResultState, now: number): AfterResultState {
  const run = s.closedRun + 1;
  if (run >= AFTER_RESULT_CLOSE_LIMIT) return { ...s, closedRun: 0, restUntil: now + AFTER_RESULT_REST_DAYS * DAY };
  return { ...s, closedRun: run };
}

/** 購入画面へ進んだときの記録 */
export function afterResultOpened(s: AfterResultState): AfterResultState {
  return { ...s, closedRun: 0 };
}

export function normalizeAfterResult(x: unknown): AfterResultState {
  const o = (x ?? {}) as Partial<AfterResultState>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    shownDay: typeof o.shownDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.shownDay) ? o.shownDay : '',
    shown: n(o.shown),
    closedRun: Math.min(AFTER_RESULT_CLOSE_LIMIT, n(o.closedRun)),
    restUntil: n(o.restUntil),
  };
}

/** 案内に出す中身。数字はすべて問題データと本人の記録から数える(採点対象外は数えない) */
export interface AfterResultView {
  /** 鍵のかかった回の範囲と問題数(採点対象外も含めた問題の数。結果の画面の案内と同じ数え方) */
  lockedRange: string;
  lockedCount: number;
  /** 無料の回の名前(第38回 など)と、その残り */
  freeRounds: string;
  freeLeft: number;
  /** 苦手の多い(無ければ正答率の低い)科目が、完全版で何問になるか */
  weak: { subject: string; nigate: number; now: number; full: number } | null;
  /** 総得点とは別の基準の問題(看護師の必修問題)が、完全版で何問になるか */
  sub: { label: string; ratio: number; now: number; full: number } | null;
  /** 事例を読んで答える問題(看護師の状況設定問題)が、完全版で何問になるか(cfg.paywallParts のある試験だけ) */
  caseGrowth: { label: string; now: number; full: number } | null;
  /** 試験日までの日数と、完全版でまだ解いていない問題を試験の前日までに1周する1日の数 */
  plan: { days: number; unseenFull: number; perDay: number } | null;
}

export function afterResultView(all: Question[], open: Question[], data: AppData, cfg: ExamConfig, now: number): AfterResultView | null {
  const s = lockedSummary(all, cfg);
  if (!s) return null;
  const days = daysLeft(cfg.examDate, now);
  const unseenFull = unseen(all, data).length;
  const sub = subPassGrowth(all, cfg);
  // 苦手の科目が必修問題そのもの(看護師)なら、基準つきの必修の行だけにする(同じ数を2行出さない)
  const weakRaw = weakSubjectGrowth(all, open, data);
  const weak = weakRaw && sub && cfg.subPass?.subjects?.includes(weakRaw.subject) ? null : weakRaw;
  return {
    lockedRange: examRange(s.from, s.to),
    lockedCount: s.count,
    freeRounds: cfg.freeExams.map((x) => `第${x}回`).join('・'),
    freeLeft: freeLeft(open, data, cfg),
    weak,
    sub,
    caseGrowth: caseOf(all, cfg),
    plan: days !== null && days > 0 && unseenFull > 0 ? { days, unseenFull, perDay: Math.ceil(unseenFull / days) } : null,
  };
}

function caseOf(all: Question[], cfg: ExamConfig): { label: string; now: number; full: number } | null {
  const r = partRows(all, cfg)?.find((x) => x.key === 'case');
  return r && r.full > r.free ? { label: r.label, now: r.free, full: r.full } : null;
}
