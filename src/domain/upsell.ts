import type { AppData, ExamConfig, Question } from './types';
import { inSubPass, isNigate, unseen } from './study';

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

/**
 * 総得点とは別に基準のある問題(看護師の必修問題・8割)が、無料の回で何問・完全版で何問か。
 * 看護師の人が一番気にする所なので、購入画面とホームの帯で中身として見せる(実際の問題数だけ。採点対象外は数えない)。
 * 基準の無い試験、完全版で増えない試験は null
 */
export function subPassGrowth(all: Question[], cfg: ExamConfig): { label: string; ratio: number; now: number; full: number } | null {
  const sp = cfg.subPass;
  if (!sp) return null;
  let now = 0, full = 0;
  for (const q of all) {
    if (q.excluded || !inSubPass(q, cfg)) continue;
    full++;
    if (cfg.freeExams.includes(q.exam)) now++;
  }
  return full > now ? { label: sp.label, ratio: sp.ratio, now, full } : null;
}

/** 問題データにある回の数(= 完全版の模試の回数) */
export function roundCount(all: Question[]): number {
  return new Set(all.map((q) => q.exam)).size;
}

/** 見せる問題文の長さの目安(これより長い問題は、短い問題が無いときだけ選ぶ) */
export const PREVIEW_STEM_MAX = 160;

/** 文字列から決まる小さな数(同じ日・同じ科目なら同じ問題を出す。開くたびに変わって迷わせない) */
function stableIndex(seed: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0) % n;
}

/**
 * 鍵のかかった回(完全版の分)から、同じ科目の問題を1問選ぶ。問題文だけを本物のまま見せるのに使う。
 * - subjects を前から順に見て、鍵のかかった問題がある最初の科目にする
 * - 採点対象外・図・事例文・計算の問題は選ばない(問題文だけでは読めないため)
 * - 短い問題(PREVIEW_STEM_MAX 字まで)のある科目を先に。どの科目にも無いときだけ長い問題(長い事例を含む問題)を出す
 * - 鍵のかかった回のうち一番新しい回から
 * - どの問題かは seed(日付と科目など)で決める。同じ seed なら同じ問題
 * locked は「この人に鍵がかかっているか」(isLocked と同じ判定を渡す)。
 */
export function lockedPreview(all: Question[], locked: (q: Question) => boolean, subjects: string[], seed: string): Question | null {
  for (const shortOnly of [true, false]) {
    for (const s of subjects) {
      const cands = all.filter((q) => q.subject === s && locked(q) && !q.excluded && !q.figure && !q.case && !q.calc && q.stem.trim().length > 0
        && (!shortOnly || q.stem.length <= PREVIEW_STEM_MAX));
      if (cands.length === 0) continue;
      const newest = Math.max(...cands.map((q) => q.exam));
      const pool = cands.filter((q) => q.exam === newest).sort((a, b) => a.no - b.no || a.id.localeCompare(b.id));
      return pool[stableIndex(`${seed}|${s}`, pool.length)];
    }
  }
  return null;
}

/** 練習の結果で見せる科目の順: この回で間違えた数の多い科目 → 本人の苦手の多い科目 → この回で解いた科目 */
export function resultPreviewSubjects(done: { subject: string; ok: boolean }[], weak: string | null): string[] {
  const miss = new Map<string, number>();
  for (const d of done) if (!d.ok) miss.set(d.subject, (miss.get(d.subject) ?? 0) + 1);
  const missed = [...miss.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const order = [...missed, ...(weak ? [weak] : []), ...done.map((d) => d.subject)];
  return [...new Set(order)];
}
