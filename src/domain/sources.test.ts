import { describe, expect, it } from 'vitest';
import { EXAM } from './exam';
import { hasOwnPage, sourcePageFor } from './sources';
import type { ExamConfig } from './types';

describe('出典のリンク', () => {
  it('いま組んでいる試験は、収録した5回すべてに厚生労働省のリンクが出る', () => {
    expect(EXAM.sources).toBeTruthy();
    expect(EXAM.sources!.license.url).toMatch(/^https:\/\/www\.digital\.go\.jp\//);
    for (let n = EXAM.latestExam - 4; n <= EXAM.latestExam; n++) {
      const link = sourcePageFor(n, EXAM);
      expect(link?.url).toMatch(/^https:\/\/www\.mhlw\.go\.jp\//);
      expect(link?.title).toBeTruthy();
    }
    // いちばん新しい回は、その回のページを指す
    expect(hasOwnPage(EXAM.latestExam, EXAM)).toBe(true);
    expect(sourcePageFor(EXAM.latestExam, EXAM)!.title).toContain(`第${EXAM.latestExam}回`);
  });

  it('回のページが無ければ、公開中のページ → 案内ページの順に代える', () => {
    const top = { title: 'top', url: 'https://www.mhlw.go.jp/top/' };
    const cur = { title: 'cur', url: 'https://www.mhlw.go.jp/cur.html' };
    const lic = { title: 'lic', url: 'https://www.digital.go.jp/lic' };
    const base = { ...EXAM, sources: { top, license: lic, pages: { 40: { title: '40', url: 'https://www.mhlw.go.jp/40.html' } } } } as ExamConfig;
    expect(sourcePageFor(40, base)!.title).toBe('40');
    expect(sourcePageFor(39, base)).toBe(top);
    expect(sourcePageFor(39, { ...base, sources: { ...base.sources!, current: cur } })).toBe(cur);
    expect(sourcePageFor(40, { ...base, sources: undefined })).toBeNull();
  });
});
