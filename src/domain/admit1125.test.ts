import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { admitFacts } from './upsell';
import type { ExamConfig } from './types';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0).getTime();
const kaigo = { examDate: '2027-01-31', admitCard: { send: '2026-12-11', source: 's' } } as unknown as ExamConfig;
const nurse = { examDate: '2027-02-14', admitCard: { about: '1月中旬', until: '2027-01-29', source: 's' } } as unknown as ExamConfig;

describe('受験票の発送まであと何日(2026-11-25)', () => {
  it('発送日が決まっている試験は、その日まで何日かを出す', () => {
    expect(admitFacts(kaigo, '2027-01-31', at(2026, 11, 25))).toEqual({ kind: 'days', days: 16, send: '2026-12-11' });
    expect(admitFacts(kaigo, '2027-01-31', at(2026, 12, 10))).toEqual({ kind: 'days', days: 1, send: '2026-12-11' });
    expect(admitFacts(kaigo, '2027-01-31', at(2026, 12, 11))).toEqual({ kind: 'days', days: 0, send: '2026-12-11' });
  });
  it('発送日を過ぎたら出さない', () => {
    expect(admitFacts(kaigo, '2027-01-31', at(2026, 12, 12))).toBeNull();
  });
  it('設定の試験日を自分で替えた・消した人には出さない', () => {
    expect(admitFacts(kaigo, '2028-01-30', at(2026, 11, 25))).toBeNull();
    expect(admitFacts(kaigo, '', at(2026, 11, 25))).toBeNull();
  });
  it('旬だけ発表されている試験は「1月中旬に発送の予定」。届かなければ問い合わせる日を過ぎたら出さない', () => {
    expect(admitFacts(nurse, '2027-02-14', at(2026, 11, 25))).toEqual({ kind: 'about', about: '1月中旬' });
    expect(admitFacts(nurse, '2027-02-14', at(2027, 1, 29))).toEqual({ kind: 'about', about: '1月中旬' });
    expect(admitFacts(nurse, '2027-02-14', at(2027, 1, 30))).toBeNull();
  });
  it('設定の無い試験・試験日を過ぎた試験には出さない', () => {
    expect(admitFacts({ examDate: '2027-01-31' } as unknown as ExamConfig, '2027-01-31', at(2026, 11, 25))).toBeNull();
    expect(admitFacts(kaigo, '2027-01-31', at(2027, 2, 1))).toBeNull();
  });
  it('7試験とも公式の発表の日付と出典が入っている', () => {
    const want: Record<string, { send?: string; about?: string; until?: string }> = {
      kaigo: { send: '2026-12-11' }, shakai: { send: '2026-12-11' }, seishin: { send: '2026-12-11' }, kanri: { send: '2027-02-10' },
      nurse: { about: '1月中旬', until: '2027-01-29' }, pt: { about: '1月下旬', until: '2027-02-08' }, rinsho: { about: '1月下旬', until: '2027-02-03' },
    };
    for (const [dir, w] of Object.entries(want)) {
      const e = JSON.parse(readFileSync(`exams/${dir}/exam.json`, 'utf8'));
      expect(e.admitCard, dir).toMatchObject(w);
      expect(e.admitCard.source, dir).toMatch(/^(社会福祉振興・試験センター|厚生労働省).*https:\/\//);
      if (w.send) expect(w.send < e.examDate, dir).toBe(true);
    }
  });
});
