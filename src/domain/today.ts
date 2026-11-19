import type { AppData, Question } from './types';
import { dayKey, nigateOrder, rng, shuffle, unseen } from './study';

/**
 * 今日の10問(2026-11-19)。1問でも解いた人のホームに出す、毎日開く理由になる1枚。
 * - 中身は、苦手ノートの問題を先に(古く間違えた順)、残りをまだ解いていない問題で埋める。
 *   まだ解いていない問題があるうちは苦手を最大7問にして、毎日3問は新しい問題に進む(苦手だけの10問は「苦手だけを解く」で解ける)
 * - 今日解いた数は記録(daily)の数をそのまま使う。目標の10問を超えたら「済み」にして、もう10問も解ける
 * - 数字はどれも本人の記録と問題データから数える(作った数は出さない)
 */
export const TODAY_GOAL = 10;
/** まだ解いていない問題があるときの、苦手の上限 */
export const TODAY_NIGATE_MAX = 7;

function split(open: Question[], data: AppData, n: number) {
  const nigAll = nigateOrder(open.filter((q) => !q.excluded), data);
  const freshAll = unseen(open, data);
  const nigN = Math.min(nigAll.length, freshAll.length > 0 ? Math.min(TODAY_NIGATE_MAX, n) : n);
  // 苦手が少ない日は、空いた分を新しい問題で埋める。新しい問題が足りない日は、苦手で埋める
  const freshN = Math.min(freshAll.length, n - nigN);
  const nigN2 = Math.min(nigAll.length, n - freshN);
  return { nigAll, freshAll, nigN: nigN2, freshN };
}

export function todaySet(open: Question[], data: AppData, seed: number, n = TODAY_GOAL): Question[] {
  const x = split(open, data, n);
  return [...x.nigAll.slice(0, x.nigN), ...shuffle(x.freshAll, rng(seed)).slice(0, x.freshN)];
}

/** 今日の10問の中身の内訳(ボタンの下の一言に使う) */
export function todayMix(open: Question[], data: AppData, n = TODAY_GOAL): { nigate: number; fresh: number } {
  const x = split(open, data, n);
  return { nigate: x.nigN, fresh: x.freshN };
}

/** 今日解いた数(記録の daily のまま) */
export function todayCount(data: AppData, now: number): number {
  return data.daily[dayKey(now)] ?? 0;
}

/**
 * 解き終えた回の、科目ごとの間違い。間違いの多い順に最大 max 科目(間違いが0の科目は出さない)。
 * 同じ数なら、その回で解いた数の多い科目を先に。
 */
export function sessionWeak(done: { subject: string; ok: boolean }[], max = 3): { subject: string; ng: number; total: number }[] {
  const m = new Map<string, { ng: number; total: number }>();
  for (const d of done) {
    if (!d.subject) continue;
    const r = m.get(d.subject) ?? { ng: 0, total: 0 };
    r.total += 1;
    if (!d.ok) r.ng += 1;
    m.set(d.subject, r);
  }
  return [...m.entries()]
    .filter(([, r]) => r.ng > 0)
    .map(([subject, r]) => ({ subject, ...r }))
    .sort((a, b) => b.ng - a.ng || b.total - a.total)
    .slice(0, max);
}

/**
 * 購入画面の「試験日までに完全版を1周するなら」。試験日が先にあり、完全版にまだ解いていない問題があるときだけ。
 * 完全版の全問(採点対象外を除く)のうち、まだ解いていない数を残りの日数で割る(切り上げ)
 */
export function fullPlan(all: Question[], data: AppData, days: number | null): { days: number; left: number; perDay: number } | null {
  if (days === null || days <= 0) return null;
  const left = unseen(all, data).length;
  if (left <= 0) return null;
  return { days, left, perDay: Math.ceil(left / days) };
}
