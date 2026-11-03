import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const platform = vi.hoisted(() => ({ name: 'android' }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform.name } }));

import { MoreApps } from './MoreApps';

describe('設定の「作者のほかのアプリ」の欄', () => {
  it('Android ではパスダンとタベドキを、utm 付きの Play の URL で出す', () => {
    platform.name = 'android';
    const html = renderToStaticMarkup(<MoreApps />);
    expect(html).toContain('作者のほかのアプリ');
    expect(html).toContain('パスダン');
    expect(html).toContain('タベドキ');
    expect(html).toContain(
      'href="https://play.google.com/store/apps/details?id=jp.pasudan.app&amp;referrer=utm_source%3Dnigatecho_matome%26utm_medium%3Dcrosspromo%26utm_campaign%3Dsettings"',
    );
    expect(html).toContain(
      'href="https://play.google.com/store/apps/details?id=jp.tabedoki.app&amp;referrer=utm_source%3Dnigatecho_matome%26utm_medium%3Dcrosspromo%26utm_campaign%3Dsettings"',
    );
    expect(html).not.toMatch(/カチマケ|無料|円|¥/);
  });

  it('iOS とブラウザ版では何も出さない', () => {
    for (const name of ['ios', 'web']) {
      platform.name = name;
      expect(renderToStaticMarkup(<MoreApps />)).toBe('');
    }
  });
});
