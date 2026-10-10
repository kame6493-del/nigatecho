import { describe, expect, it } from 'vitest';
import { dailyPace, lastDays } from './summary';

describe('成績の数', () => {
  it('直近の日の解いた数(古い順・無い日は0)', () => {
    const now = new Date(2026, 9, 10, 9).getTime();
    const xs = lastDays({ '2026-10-10': 5, '2026-10-08': 3, '2026-09-30': 9 }, now, 7);
    expect(xs.map((x) => x.key)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
    expect(xs.map((x) => x.n)).toEqual([0, 0, 0, 0, 3, 0, 5]);
  });

  it('月をまたいでも日がずれない', () => {
    const now = new Date(2026, 10, 1, 0, 30).getTime();
    expect(lastDays({}, now, 2).map((x) => x.key)).toEqual(['2026-10-31', '2026-11-01']);
  });

  it('1日あたりの目安(苦手は2回と数える)', () => {
    expect(dailyPace(10, 30, 10)).toBe(5);
    expect(dailyPace(0, 0, 10)).toBe(0);
    expect(dailyPace(1, 0, 3)).toBe(1);
    expect(dailyPace(5, 5, null)).toBeNull();
    expect(dailyPace(5, 5, 0)).toBeNull();
  });
});
