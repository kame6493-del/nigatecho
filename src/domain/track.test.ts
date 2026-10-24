import { describe, expect, it } from 'vitest';
import { ATTR, boughtAttrs, examAttrs, firstExamAttrs, fromOf, paywallAttrs } from './track';

describe('購入管理の属性', () => {
  it('予約の属性($ で始まる)を使わない', () => {
    for (const k of Object.values(ATTR)) expect(k.startsWith('$')).toBe(false);
    const all = { ...examAttrs('kaigo'), ...firstExamAttrs('kaigo'), ...paywallAttrs('kaigo', 'result-preview', 3, 34), ...boughtAttrs('kaigo', 'note') };
    for (const k of Object.keys(all)) expect(k).toMatch(/^[a-z_]{1,40}$/);
  });

  it('中身は試験・場所・数だけ', () => {
    expect(paywallAttrs('nurse', 'note-preview', 2, 10)).toEqual({ paywall_from: 'note-preview', paywall_exam: 'nurse', paywall_opened: '2', paywall_seen: '10' });
    expect(boughtAttrs('kanri', 'home')).toEqual({ bought_exam: 'kanri', bought_from: 'home' });
    expect(examAttrs('kaigo')).toEqual({ exam: 'kaigo' });
  });

  it('知らない入り口は other・試験の名前は英数字だけ', () => {
    expect(fromOf('xxx')).toBe('other');
    expect(examAttrs('ka igo@example.com')).toEqual({ exam: 'kaigoexamplecom' });
    expect(paywallAttrs('kaigo', 'home', -1, 2.7)).toMatchObject({ paywall_opened: '0', paywall_seen: '2' });
  });
});
