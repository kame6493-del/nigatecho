import type { AppData, ExamConfig, Question } from './types';
import { isNigate, unseen } from './study';

/**
 * 完全版の案内を「どこに・どの形で」出すか。購入画面は押したときだけ開く(勝手に開かない・時間で急がせない)。
 * 数字はすべて実際の問題数と本人の記録から出す。
 */

/** 無料の回で、まだ解いていない問題の数(採点対象外は数えない) */
export function freeLeft(open: Question[], data: AppData, cfg: ExamConfig): number {
  return unseen(open.filter((q) => cfg.freeExams.includes(q.exam)), data).length;
}

/**
 * ホームの完全版の帯の出し方。
 * - none: 買った・鍵のかかった問題が無い
 * - finished: 無料の回を解き終えた(ホームの上に1枚)
 * - raised: 30問以上解いた(予想点のすぐ下)
 * - bottom: それ以外(今までどおり一番下)
 */
export type HomeUpsell = 'none' | 'bottom' | 'raised' | 'finished';

export const RAISE_AFTER = 30;

export function homeUpsell(o: { premium: boolean; lockedCount: number; seen: number; freeLeft: number; hasFree: boolean }): HomeUpsell {
  if (o.premium || o.lockedCount <= 0) return 'none';
  if (o.hasFree && o.seen > 0 && o.freeLeft === 0) return 'finished';
  if (o.seen >= RAISE_AFTER) return 'raised';
  return 'bottom';
}

/**
 * 本人の記録でいちばん手を入れたい科目と、その科目の問題が完全版で何問になるか。
 * 苦手の多い科目(同じなら正答率の低い方)。苦手が無ければ、3問以上解いた中で正答率の低い科目。
 * 完全版で増えない科目・まだ何も解いていないときは null。
 */
export function weakSubjectGrowth(all: Question[], open: Question[], data: AppData): { subject: string; nigate: number; now: number; full: number } | null {
  const rows = new Map<string, { nigate: number; seen: number; ok: number; now: number; full: number }>();
  const row = (s: string) => {
    let r = rows.get(s);
    if (!r) { r = { nigate: 0, seen: 0, ok: 0, now: 0, full: 0 }; rows.set(s, r); }
    return r;
  };
  for (const q of all) if (!q.excluded) row(q.subject).full++;
  for (const q of open) {
    if (q.excluded) continue;
    const r = row(q.subject);
    r.now++;
    const rec = data.records[q.id];
    if (!rec) continue;
    r.seen++;
    if (rec.n > 0 && rec.ok / rec.n >= 0.5) r.ok++;
    if (isNigate(rec)) r.nigate++;
  }
  const cands = [...rows.entries()].filter(([, r]) => r.full > r.now && r.seen > 0);
  const rate = (r: { seen: number; ok: number }) => r.ok / Math.max(1, r.seen);
  const withNigate = cands.filter(([, r]) => r.nigate > 0).sort((a, b) => b[1].nigate - a[1].nigate || rate(a[1]) - rate(b[1]));
  const pick = withNigate[0] ?? cands.filter(([, r]) => r.seen >= 3).sort((a, b) => rate(a[1]) - rate(b[1]))[0];
  if (!pick) return null;
  const [subject, r] = pick;
  return { subject, nigate: r.nigate, now: r.now, full: r.full };
}

/** 問題データにある回の数(= 完全版の模試の回数) */
export function roundCount(all: Question[]): number {
  return new Set(all.map((q) => q.exam)).size;
}
