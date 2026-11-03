import { describe, expect, it } from 'vitest';
import { MORE_APPS, moreAppsFor, playUrl, promoSource } from './moreApps';

describe('作者のほかのアプリ', () => {
  it('Play の URL に utm を referrer として1回だけエンコードして付ける', () => {
    expect(playUrl('jp.pasudan.app', 'nigatecho_matome')).toBe(
      'https://play.google.com/store/apps/details?id=jp.pasudan.app&referrer=utm_source%3Dnigatecho_matome%26utm_medium%3Dcrosspromo%26utm_campaign%3Dsettings',
    );
  });

  it('元のアプリの名前: まとめ版は nigatecho_matome、ほかは appId から', () => {
    expect(promoSource('jp.nigatecho.kanrieiyoushi')).toBe('nigatecho_matome');
    expect(promoSource('jp.nigatecho.rinshokensa')).toBe('jp_nigatecho_rinshokensa');
  });

  it('Android だけで出す。iOS・ブラウザ版では出さない', () => {
    expect(moreAppsFor('android', 'jp.nigatecho.kanrieiyoushi').map((a) => a.id)).toEqual(['jp.pasudan.app', 'jp.tabedoki.app']);
    expect(moreAppsFor('ios', 'jp.nigatecho.kanrieiyoushi')).toEqual([]);
    expect(moreAppsFor('web', 'jp.nigatecho.kanrieiyoushi')).toEqual([]);
  });

  it('自分自身は出さない', () => {
    expect(moreAppsFor('android', 'jp.pasudan.app').map((a) => a.id)).toEqual(['jp.tabedoki.app']);
  });

  it('18歳以上向け(カチマケ)と、値段・無料の言葉を入れない', () => {
    for (const a of MORE_APPS) {
      expect(a.id).not.toBe('jp.kachimake.app');
      expect(`${a.name}${a.line}`).not.toMatch(/無料|円|¥|セール|No\.1|最強/);
      expect(a.line.length).toBeLessThanOrEqual(32);
    }
  });
});
