/**
 * 購入管理(RevenueCat)に入れる独自の属性の名前と中身。どの試験の人が、どこで購入画面を開き、どこで買ったかを数えるためだけ。
 * 入れるのは 試験(exams の dir)・画面の場所・回数・解いた問題の数 だけで、個人を特定する情報は入れない。
 * RevenueCat の予約の属性($ で始まる $campaign など)は使わない。
 */
export type Attrs = Record<string, string | null>;

export const ATTR = {
  /** いま選んでいる試験 */
  exam: 'exam',
  /** はじめて開いたときに選んだ試験(最初の1回だけ) */
  examFirst: 'exam_first',
  /** 最後に購入画面を開いた場所 */
  paywallFrom: 'paywall_from',
  /** 最後に購入画面を開いたときの試験 */
  paywallExam: 'paywall_exam',
  /** 購入画面を開いた回数(この端末の合計) */
  paywallOpened: 'paywall_opened',
  /** 最後に購入画面を開いたとき、その試験で解いたことのある問題の数 */
  paywallSeen: 'paywall_seen',
  /** 最後に買った試験と、そのときの購入画面の入り口 */
  boughtExam: 'bought_exam',
  boughtFrom: 'bought_from',
} as const;

/** 購入画面の入り口(App.tsx の Route の from)。これ以外は other にまとめる */
export const PAYWALL_FROM = [
  'home', 'search', 'note', 'note-preview', 'stats', 'exam', 'subject', 'settings',
  'result', 'result-preview', 'mock-result', 'quiz',
] as const;

export function fromOf(from: string): string {
  return (PAYWALL_FROM as readonly string[]).includes(from) ? from : 'other';
}

/** 試験の名前(dir)は英小文字・数字・-・_ だけ。ほかの文字は入れない(念のため) */
const clean = (dir: string) => dir.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'unknown';

export const examAttrs = (dir: string): Attrs => ({ [ATTR.exam]: clean(dir) });
export const firstExamAttrs = (dir: string): Attrs => ({ [ATTR.examFirst]: clean(dir) });

export function paywallAttrs(dir: string, from: string, opened: number, seen: number): Attrs {
  return {
    [ATTR.paywallFrom]: fromOf(from),
    [ATTR.paywallExam]: clean(dir),
    [ATTR.paywallOpened]: String(Math.max(0, Math.floor(opened))),
    [ATTR.paywallSeen]: String(Math.max(0, Math.floor(seen))),
  };
}

export const boughtAttrs = (dir: string, from: string): Attrs => ({ [ATTR.boughtExam]: clean(dir), [ATTR.boughtFrom]: fromOf(from) });
