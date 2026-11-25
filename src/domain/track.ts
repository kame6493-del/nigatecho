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
  /** 買ったボタン(購入画面の上 top / 下 bottom)。2026-11-22 */
  boughtButton: 'bought_button',
  /** 入り口ごとに購入画面を開いた回数(この端末の合計)。"home:2,result:5" の形。2026-11-22 */
  paywallFroms: 'paywall_froms',
  /** はじめて購入画面を開いた入り口(最初の1回だけ) */
  paywallFirstFrom: 'paywall_first_from',
} as const;

/** 購入画面の入り口(App.tsx の Route の from)。これ以外は other にまとめる */
export const PAYWALL_FROM = [
  'home', 'search', 'note', 'note-preview', 'stats', 'exam', 'subject', 'settings',
  'result', 'result-preview', 'mock-result', 'quiz', 'date-plan',
  // 結果の画面を出たあとの「この試験の続き」(domain/afterResult.ts)
  'after-result',
  // 看護師: 無料の回の必修問題を全部解いたときのホームの1枚(2026-11-09)
  'home-sub-done',
  // 2026-11-22: 無料の回を解き終えた1枚・未回答のボタン(解き終えたあと)・無料の残りが少ない知らせ
  'home-finished', 'home-unseen', 'home-near',
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

export const boughtAttrs = (dir: string, from: string, button?: 'top' | 'bottom'): Attrs => ({
  [ATTR.boughtExam]: clean(dir), [ATTR.boughtFrom]: fromOf(from), ...(button ? { [ATTR.boughtButton]: button } : {}),
});

/** 入り口ごとの回数を1つ足す(知らない入り口は other)。回数は0以上の整数だけ残す */
export function bumpFrom(counts: Record<string, number>, from: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts ?? {})) {
    const n = Math.floor(Number(v));
    if (fromOf(k) === k && n > 0) out[k] = n;
  }
  const k = fromOf(from);
  out[k] = (out[k] ?? 0) + 1;
  return out;
}

/**
 * 入り口ごとの回数の属性。"after-result:1,home:3" のように名前の順。RevenueCat の属性の値は500字までなので、
 * 長くなったら回数の多い順に残す。初めて開いた入り口も入れる(最初の1回だけ書く)
 */
export function fromCountsAttrs(counts: Record<string, number>, first: boolean, from: string): Attrs {
  let rows = Object.entries(counts).filter(([, n]) => n > 0);
  const text = () => rows.slice().sort((a, b) => a[0].localeCompare(b[0])).map(([k, n]) => `${k}:${n}`).join(',');
  rows.sort((a, b) => b[1] - a[1]);
  while (text().length > 500 && rows.length > 1) rows = rows.slice(0, -1);
  return { [ATTR.paywallFroms]: text(), ...(first ? { [ATTR.paywallFirstFrom]: fromOf(from) } : {}) };
}
