/** 成績の画面の数(毎日の解いた数から出す。新しい記録は足さない) */
import { dayKey } from './study';

export interface DayCount { key: string; t: number; n: number }

/** 今日までの n 日分の解いた数(古い順) */
export function lastDays(daily: Record<string, number>, now: number, n: number): DayCount[] {
  const out: DayCount[] = [];
  const base = new Date(now);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i, 12);
    const key = dayKey(d.getTime());
    out.push({ key, t: d.getTime(), n: daily[key] ?? 0 });
  }
  return out;
}

/**
 * 試験日までに、いまの苦手とまだ解いていない問題を解き終えるための1日あたりの数。
 * 苦手は消すのに2回正解が要るので2回と数える。残り日数が無ければ null
 */
export function dailyPace(nigate: number, fresh: number, daysLeft: number | null): number | null {
  if (daysLeft === null || daysLeft <= 0) return null;
  const work = nigate * 2 + fresh;
  return work === 0 ? 0 : Math.ceil(work / daysLeft);
}
