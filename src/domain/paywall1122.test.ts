import { describe, expect, it } from 'vitest';
import { boughtAttrs, bumpFrom, fromCountsAttrs, fromOf } from './track';
import { NEAR_FREE, homeUpsell, nearFree } from './upsell';

const base = { premium: false, lockedCount: 600, seen: 100, freeLeft: 12, hasFree: true, closed: false };

describe('無料の残りが少ない知らせ(2026-11-22)', () => {
  it('残りが20問を切ったら出す・20問ちょうどでは出さない', () => {
    expect(NEAR_FREE).toBe(20);
    expect(nearFree(base)).toBe(true);
    expect(nearFree({ ...base, freeLeft: 19 })).toBe(true);
    expect(nearFree({ ...base, freeLeft: 20 })).toBe(false);
    expect(nearFree({ ...base, freeLeft: 1 })).toBe(true);
  });
  it('解き終えた(0問)・買った・閉じた・鍵の無い試験には出さない', () => {
    expect(nearFree({ ...base, freeLeft: 0 })).toBe(false);
    expect(nearFree({ ...base, premium: true })).toBe(false);
    expect(nearFree({ ...base, closed: true })).toBe(false);
    expect(nearFree({ ...base, lockedCount: 0 })).toBe(false);
    expect(nearFree({ ...base, hasFree: false })).toBe(false);
    expect(nearFree({ ...base, seen: 0 })).toBe(false);
  });
  it('解き終えたら知らせではなく finished の1枚', () => {
    expect(homeUpsell({ ...base, freeLeft: 0 })).toBe('finished');
    expect(nearFree({ ...base, freeLeft: 0 })).toBe(false);
  });
});

describe('入り口ごとの記録(2026-11-22)', () => {
  it('新しい入り口を知っている', () => {
    for (const f of ['home-finished', 'home-unseen', 'home-near']) expect(fromOf(f)).toBe(f);
  });
  it('入り口ごとに数える・知らない入り口は other・壊れた値は捨てる', () => {
    let c = bumpFrom({}, 'home');
    c = bumpFrom(c, 'home');
    c = bumpFrom(c, 'result');
    c = bumpFrom(c, 'zzz');
    expect(c).toEqual({ home: 2, result: 1, other: 1 });
    expect(bumpFrom({ home: -3, 'x y': 5, result: 2.9 } as Record<string, number>, 'home')).toEqual({ home: 1, result: 2 });
  });
  it('属性は名前順の1行・初めての入り口は最初の1回だけ', () => {
    expect(fromCountsAttrs({ result: 5, home: 2 }, true, 'home')).toEqual({ paywall_froms: 'home:2,result:5', paywall_first_from: 'home' });
    expect(fromCountsAttrs({ home: 3 }, false, 'home')).toEqual({ paywall_froms: 'home:3' });
  });
  it('属性の値は500字まで(多い順に残す)', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 80; i++) many[`home-finished${i}`] = i + 1;
    const v = fromCountsAttrs(many, false, 'home').paywall_froms!;
    expect(v.length).toBeLessThanOrEqual(500);
    expect(v).toContain('home-finished79:80');
  });
  it('買ったボタン(上・下)を入れる。渡さなければ前と同じ', () => {
    expect(boughtAttrs('nurse', 'home-unseen', 'top')).toEqual({ bought_exam: 'nurse', bought_from: 'home-unseen', bought_button: 'top' });
    expect(boughtAttrs('kanri', 'home')).toEqual({ bought_exam: 'kanri', bought_from: 'home' });
  });
});
