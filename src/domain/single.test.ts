/// <reference types="node" />
// 臨床検査技師の単体のアプリ(node scripts/use-multi.mjs exams/multi.rinsho.json で組んだとき)だけ流れるテスト。
// まとめアプリで組んだときは飛ばす。npm run test:all が両方の組み方で流す。
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP, EXAM, EXAMS, SINGLE, selectExam } from './exam';
import type { AppData, Question } from './types';

const store = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value); },
    remove: async ({ key }: { key: string }) => { store.delete(key); },
  },
}));

const { keyOf, loadData, saveData, loadExamChoice } = await import('../platform/storage');
const { accessFrom } = await import('../platform/billing');

describe.skipIf(!SINGLE)('臨床検査技師の単体のアプリ(前の版 1.0.1 と同じアプリ・商品・記録)', () => {
  const exam = JSON.parse(readFileSync('exams/rinsho/exam.json', 'utf8'));

  it('試験は臨床検査技師だけ。アプリの ID・RevenueCat のキーは前の版のまま', () => {
    expect(EXAMS.map((e) => e.dir)).toEqual(['rinsho']);
    expect(APP.appId).toBe('jp.nigatecho.rinshokensa');
    expect(APP.revenuecat).toEqual(exam.revenuecat);
    const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
    expect(cap.appId).toBe('jp.nigatecho.rinshokensa');
    expect(cap.android.path).toBe('exams/rinsho/android');
  });

  it('商品ID・entitlement・値段・無料の回は前の版のまま', () => {
    const e = EXAMS[0];
    expect([e.key, e.productId, e.entitlement, e.price]).toEqual(['rinsho-kensa', 'nigatecho_rinsho_full', 'full', '¥980']);
    expect(e.freeExams).toEqual(exam.freeExams);
    expect(accessFrom(['full'])).toEqual({ rinsho: true });
    expect(accessFrom([])).toEqual({ rinsho: false });
  });

  it('問題データは exams/rinsho/data と同じ 1,000問', () => {
    const qs: Question[] = JSON.parse(readFileSync('exams/rinsho/data/questions.json', 'utf8'));
    const pub: Question[] = JSON.parse(readFileSync('public/data/rinsho/questions.json', 'utf8'));
    expect(qs.length).toBe(1000);
    expect(pub).toEqual(qs);
    expect(EXAMS[0].count).toBe(1000);
  });

  describe('記録', () => {
    beforeEach(() => store.clear());
    it('前の版の記録(nigatecho.rinsho-kensa.v1)をそのまま読み、同じ所へ書く', async () => {
      expect(keyOf('rinsho-kensa')).toBe('nigatecho.rinsho-kensa.v1');
      const old: AppData = {
        version: 1,
        records: { '72-001': { n: 2, ok: 1, at: 1, streak: 1, missed: true } },
        marks: ['72-010'],
        mocks: [{ at: 1, exam: 72, score: 120, total: 200, bySubject: {}, seconds: 100 }],
        settings: { fontScale: 1, examDate: '2027-02-17', remindAt: '21:00', remind: false },
        daily: { '2026-10-05': 8 },
      };
      store.set('nigatecho.rinsho-kensa.v1', JSON.stringify(old));
      // 前の版には「選んだ試験」の記録が無い → 臨床検査技師で開く
      expect(await loadExamChoice()).toBeNull();
      expect(selectExam(await loadExamChoice()).dir).toBe('rinsho');
      expect(EXAM.dir).toBe('rinsho');
      expect(await loadData()).toEqual(old);
      await saveData({ ...old, marks: [] });
      expect(JSON.parse(store.get('nigatecho.rinsho-kensa.v1')!).marks).toEqual([]);
      expect([...store.keys()].filter((k) => !k.startsWith('nigatecho.rinsho-kensa.v1'))).toEqual([]);
    });
  });
});
