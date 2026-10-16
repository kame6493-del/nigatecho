/// <reference types="node" />
// 単体のアプリ(node scripts/use-multi.mjs exams/multi.<試験>.json で組んだとき)だけ流れるテスト。
// 臨床検査技師・理学療法士・介護福祉士。まとめアプリで組んだときは飛ばす。npm run test:all がそれぞれの組み方で流す。
// 前の版と同じアプリ ID・商品・記録の保存先であること(上書きで更新でき、今の利用者の苦手ノートが消えない)を確かめる。
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP, EXAM, EXAMS, SINGLE, selectExam } from './exam';
import { isLocked, setUnlockedSubjects } from './study';
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
const { accessFrom, packSubjectsFrom } = await import('../platform/billing');

/** 前の版(Play に出ている単体のアプリ)の値 */
const PREV: Record<string, { appId: string; key: string; productId: string; price: string; count: number; free: number }> = {
  rinsho: { appId: 'jp.nigatecho.rinshokensa', key: 'rinsho-kensa', productId: 'nigatecho_rinsho_full', price: '¥980', count: 1000, free: 72 },
  pt: { appId: 'jp.nigatecho.rigakuryouhoushi', key: 'rigaku-ryouhoushi', productId: 'nigatecho_pt_full', price: '¥980', count: 1000, free: 61 },
  kaigo: { appId: 'jp.kaigonigate.app', key: 'kaigo-fukushishi', productId: 'nigatecho_kaigo_full', price: '¥900', count: 750, free: 38 },
};
/** 介護福祉士 1.0.x の科目パック(kaigonigate の exams/kaigo/exam.json と同じ) */
const KAIGO_PACKS = ['ningen', 'kihon', 'seikatsu', 'kokoro', 'ninchi', 'katei'];

const dir = EXAMS[0]?.dir;
const prev = PREV[dir];

describe.skipIf(!SINGLE)(`単体のアプリ(${dir}): 前の版と同じアプリ・商品・記録`, () => {
  const exam = JSON.parse(readFileSync(`exams/${dir}/exam.json`, 'utf8'));

  it('試験は1つだけ。アプリの ID・RevenueCat のキー・殻は前の版のまま', () => {
    expect(prev).toBeTruthy();
    expect(EXAMS.map((e) => e.dir)).toEqual([dir]);
    expect(APP.appId).toBe(prev.appId);
    expect(APP.revenuecat).toEqual(exam.revenuecat);
    const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
    expect(cap.appId).toBe(prev.appId);
    expect(cap.android.path).toBe(`exams/${dir}/android`);
    const gradle = readFileSync(`exams/${dir}/android/app/build.gradle`, 'utf8');
    expect(gradle).toContain(`applicationId "${prev.appId}"`);
    expect(gradle).toContain('versionName "1.1.0"');
  });

  it('商品ID・entitlement・値段・無料の回は前の版のまま', () => {
    const e = EXAMS[0];
    expect([e.key, e.productId, e.entitlement, e.price]).toEqual([prev.key, prev.productId, 'full', prev.price]);
    expect(e.freeExams).toEqual(exam.freeExams);
    expect(e.freeExams).toEqual([prev.free]);
    expect(accessFrom(['full'])).toEqual({ [dir]: true });
    expect(accessFrom([])).toEqual({ [dir]: false });
  });

  it(`問題データは exams/${dir}/data と同じ`, () => {
    const qs: Question[] = JSON.parse(readFileSync(`exams/${dir}/data/questions.json`, 'utf8'));
    const pub: Question[] = JSON.parse(readFileSync(`public/data/${dir}/questions.json`, 'utf8'));
    expect(qs.length).toBe(prev.count);
    expect(pub).toEqual(qs);
    expect(EXAMS[0].count).toBe(prev.count);
  });

  it.runIf(dir === 'kaigo')('介護福祉士: 前に買った科目パック(pack_<id>)の科目は開いたまま', () => {
    const e = EXAMS[0];
    expect((e.packs ?? []).map((p) => p.id)).toEqual(KAIGO_PACKS);
    const qs: Question[] = JSON.parse(readFileSync(`exams/${dir}/data/questions.json`, 'utf8'));
    const pack = e.packs![2];
    const inPack = qs.find((q) => q.exam !== prev.free && pack.subjects.includes(q.subject))!;
    const outPack = qs.find((q) => q.exam !== prev.free && !pack.subjects.includes(q.subject))!;
    expect(packSubjectsFrom([])).toEqual([]);
    expect(packSubjectsFrom([`pack_${pack.id}`])).toEqual(pack.subjects);
    setUnlockedSubjects(packSubjectsFrom([`pack_${pack.id}`]));
    expect(isLocked(inPack, false, e)).toBe(false);
    expect(isLocked(outPack, false, e)).toBe(true);
    setUnlockedSubjects([]);
    expect(isLocked(inPack, false, e)).toBe(true);
    expect(isLocked(inPack, true, e)).toBe(false);
  });

  describe('記録', () => {
    beforeEach(() => store.clear());
    it(`前の版の記録(nigatecho.${prev?.key}.v1)をそのまま読み、同じ所へ書く`, async () => {
      expect(keyOf(prev.key)).toBe(`nigatecho.${prev.key}.v1`);
      const id = `${prev.free}-001`;
      const old: AppData = {
        version: 1,
        records: { [id]: { n: 2, ok: 1, at: 1, streak: 1, missed: true } },
        marks: [`${prev.free}-010`],
        mocks: [{ at: 1, exam: prev.free, score: 120, total: 200, bySubject: {}, seconds: 100 }],
        settings: { fontScale: 1, examDate: '2027-02-17', remindAt: '21:00', remind: false },
        daily: { '2026-10-05': 8 },
      };
      store.set(`nigatecho.${prev.key}.v1`, JSON.stringify(old));
      // 前の版には「選んだ試験」の記録が無い → その試験で開く
      expect(await loadExamChoice()).toBeNull();
      expect(selectExam(await loadExamChoice()).dir).toBe(dir);
      expect(EXAM.dir).toBe(dir);
      expect(await loadData()).toEqual(old);
      await saveData({ ...old, marks: [] });
      expect(JSON.parse(store.get(`nigatecho.${prev.key}.v1`)!).marks).toEqual([]);
      expect([...store.keys()].filter((k) => !k.startsWith(`nigatecho.${prev.key}.v1`))).toEqual([]);
    });
  });
});
