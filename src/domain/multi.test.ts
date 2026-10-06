/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXAM_DATE, EXAM, EXAMS, FIRST_EXAM, selectExam } from './exam';
import { hasOwnPage, isMhlw, sourceLabelOf, sourcePageFor } from './sources';
import { examRange, isLocked, passScoreOf, zeroGroups } from './study';
import type { AppData, Question } from './types';

// Preferences は端末の保存場所。テストでは入れ物(Map)に置き換える(Web 版は localStorage の CapacitorStorage.<key>)
const store = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value); },
    remove: async ({ key }: { key: string }) => { store.delete(key); },
  },
}));

const { keyOf, loadData, saveData, loadExamChoice, saveExamChoice } = await import('../platform/storage');
const { accessFrom } = await import('../platform/billing');

const loadQs = (dir: string): Question[] => JSON.parse(readFileSync(`exams/${dir}/data/questions.json`, 'utf8'));

afterEach(() => { selectExam(FIRST_EXAM.dir); });

describe('試験の並びと商品', () => {
  it('はじめて開いたときは管理栄養士。key・商品・entitlement は公開中のアプリのまま', () => {
    expect(FIRST_EXAM.dir).toBe('kanri');
    expect(FIRST_EXAM.key).toBe('kanri-eiyoushi');
    expect(FIRST_EXAM.productId).toBe('nigatecho_kanri_full');
    expect(FIRST_EXAM.entitlement).toBe('full');
    expect(FIRST_EXAM.freeExams).toEqual([40]);
    expect(EXAM.dir).toBe('kanri');
  });

  it('理学療法士・介護福祉士・社会福祉士が入っていて、臨床検査技師は入れていない(単体のアプリで売っているため)', () => {
    expect(EXAMS.map((e) => e.dir)).toEqual(['kanri', 'pt', 'kaigo', 'shakai']);
  });

  it('記録の保存先・商品・entitlement は試験ごとに別(重なると記録が混ざる/1つ買うとほかも開く)', () => {
    for (const k of ['key', 'dir', 'productId', 'entitlement'] as const) {
      expect(new Set(EXAMS.map((e) => e[k])).size).toBe(EXAMS.length);
    }
    expect(EXAMS.find((e) => e.dir === 'pt')!.productId).toBe('nigatecho_multi_pt_full');
    expect(EXAMS.find((e) => e.dir === 'kaigo')!.entitlement).toBe('kaigo_full');
  });

  it('買った entitlement の試験だけが開く', () => {
    expect(accessFrom(['full'])).toEqual({ kanri: true, pt: false, kaigo: false, shakai: false });
    expect(accessFrom(['pt_full', 'shakai_full'])).toEqual({ kanri: false, pt: true, kaigo: false, shakai: true });
    expect(accessFrom([])).toEqual({ kanri: false, pt: false, kaigo: false, shakai: false });
  });

  it('試験を切り替えると EXAM と試験日が替わる。知らない試験は管理栄養士', () => {
    selectExam('kaigo');
    expect(EXAM.name).toBe('介護福祉士');
    expect(DEFAULT_EXAM_DATE).toBe(EXAM.examDate);
    selectExam('nothing');
    expect(EXAM.dir).toBe('kanri');
    selectExam(null);
    expect(EXAM.dir).toBe('kanri');
  });
});

describe('試験ごとの問題データ', () => {
  for (const e of EXAMS) {
    it(`${e.name}: 回・無料の回・科目・図がそろっている`, () => {
      const qs = loadQs(e.dir);
      expect(qs.length).toBe(e.count);
      const rounds = [...new Set(qs.map((q) => q.exam))].sort((a, b) => a - b);
      expect(rounds).toEqual(e.rounds);
      expect(Math.max(...rounds)).toBe(e.latestExam);
      // 無料はいちばん新しい回(単体のアプリと同じ)
      expect(e.freeExams).toEqual([e.latestExam]);
      for (const q of qs) {
        expect(e.subjects).toContain(q.subject);
        expect(q.explanation, q.id).toBeTruthy();
        if (q.figure) expect(existsSync(`exams/${e.dir}/data/${q.figure}`), q.figure).toBe(true);
      }
      // 無料の回は開き、ほかの回は完全版
      const free = qs.find((q) => q.exam === e.latestExam)!;
      const old = qs.find((q) => q.exam !== e.latestExam)!;
      expect(isLocked(free, false, e)).toBe(false);
      expect(isLocked(old, false, e)).toBe(true);
      expect(isLocked(old, true, e)).toBe(false);
    });
  }

  it('社会福祉士の2つ選ぶ問題と注、介護福祉士の事例文が入っている', () => {
    const sh = loadQs('shakai');
    expect(sh.filter((q) => (q.pick ?? 1) === 2).length).toBe(80);
    expect(sh.some((q) => q.footnote)).toBe(true);
    expect(loadQs('kaigo').some((q) => q.case)).toBe(true);
  });
});

describe('試験ごとの出典', () => {
  it('管理栄養士・理学療法士は厚生労働省、介護福祉士・社会福祉士は社会福祉振興・試験センター', () => {
    for (const e of EXAMS) {
      const mhlw = ['kanri', 'pt'].includes(e.dir);
      expect(isMhlw(e)).toBe(mhlw);
      for (const n of e.rounds!) {
        const link = sourcePageFor(n, e)!;
        expect(link.url).toMatch(mhlw ? /^https:\/\/www\.mhlw\.go\.jp\// : /^https:\/\/www\.sssc\.or\.jp\//);
        expect(sourceLabelOf(n, e)).toContain(`第${n}回${e.name}国家試験`);
        expect(sourceLabelOf(n, e)).toContain(mhlw ? '厚生労働省' : '社会福祉振興・試験センター');
      }
      expect(e.sources!.license.url).toMatch(mhlw ? /digital\.go\.jp/ : /sssc\.or\.jp\/pastissues\//);
      expect(hasOwnPage(e.latestExam, e)).toBe(true);
    }
    // 介護福祉士の第33〜35回は、センターの今のページには載っていない
    const kaigo = EXAMS.find((e) => e.dir === 'kaigo')!;
    expect(hasOwnPage(33, kaigo)).toBe(false);
    expect(kaigo.sources!.archivedNote).toContain('第33〜35回');
  });

  it('センターの留意事項(解説は関係が無いこと・法改正の注意)を出典の画面に出す', () => {
    for (const dir of ['kaigo', 'shakai']) {
      const e = EXAMS.find((x) => x.dir === dir)!;
      const usage = e.sources!.usage!.join('');
      expect(usage).toContain('社会福祉振興・試験センターとは関係ありません');
      expect(usage).toContain('法改正');
      expect(e.disclaimer).toContain('社会福祉振興・試験センター');
      expect(e.notice?.title).toBeTruthy();
    }
  });
});

describe('合格の判定(介護福祉士・社会福祉士の物を足した)', () => {
  it('公式の合格点があればそれ、無ければ6割', () => {
    const kaigo = EXAMS.find((e) => e.dir === 'kaigo')!;
    expect(passScoreOf(38, 125, kaigo)).toEqual({ score: 64, official: true });
    expect(passScoreOf(40, 200, FIRST_EXAM)).toEqual({ score: 120, official: false });
  });
  it('0点の科目群を拾う', () => {
    const shakai = EXAMS.find((e) => e.dir === 'shakai')!;
    const by: Record<string, { ok: number; n: number }> = {};
    for (const s of shakai.subjects) by[s] = { ok: 1, n: 3 };
    expect(zeroGroups(by, shakai)).toEqual([]);
    by['医学概論'] = { ok: 0, n: 6 }; by['心理学と心理的支援'] = { ok: 0, n: 6 }; by['社会学と社会システム'] = { ok: 0, n: 6 };
    expect(zeroGroups(by, shakai)).toEqual([shakai.groups![0].name]);
    expect(zeroGroups(by, FIRST_EXAM)).toEqual([]);
  });
  it('回の範囲', () => {
    expect(examRange(38, 37)).toBe('第37〜38回');
    expect(examRange(37, 37)).toBe('第37回');
  });
});

describe('記録の保存先(試験ごと・前の版と同じ名前)', () => {
  beforeEach(() => store.clear());

  it('前の版の管理栄養士の記録(nigatecho.kanri-eiyoushi.v1)をそのまま読む', async () => {
    expect(keyOf('kanri-eiyoushi')).toBe('nigatecho.kanri-eiyoushi.v1');
    const old: AppData = {
      version: 1,
      records: { '40-001': { n: 3, ok: 1, at: 1, streak: 0, missed: true } },
      marks: ['40-002'],
      mocks: [{ at: 1, exam: 40, score: 130, total: 200, bySubject: {}, seconds: 100 }],
      settings: { fontScale: 1.15, examDate: '2027-02-28', remindAt: '21:00', remind: false },
      daily: { '2026-10-05': 12 },
    };
    store.set('nigatecho.kanri-eiyoushi.v1', JSON.stringify(old));
    // 選んだ試験の記録が無い = 試験を選べるようにする前の版から上げた人 → 管理栄養士で開く
    expect(await loadExamChoice()).toBeNull();
    selectExam(await loadExamChoice());
    const d = await loadData();
    expect(d).toEqual(old);
  });

  it('試験を替えると記録は混ざらない。保存もその試験の所だけ', async () => {
    store.set('nigatecho.kanri-eiyoushi.v1', JSON.stringify({ version: 1, records: { '40-001': { n: 1, ok: 0, at: 1, streak: 0, missed: true } }, marks: [], mocks: [], settings: {}, daily: {} }));
    selectExam('pt');
    await saveExamChoice('pt');
    expect(await loadExamChoice()).toBe('pt');
    const pt = await loadData();
    expect(pt.records).toEqual({});
    expect(pt.settings.examDate).toBe(EXAM.examDate);
    await saveData({ ...pt, records: { '61-001': { n: 1, ok: 1, at: 2, streak: 1, missed: false } } });
    expect(JSON.parse(store.get('nigatecho.rigaku-ryouhoushi.v1')!).records['61-001']).toBeTruthy();
    expect(JSON.parse(store.get('nigatecho.kanri-eiyoushi.v1')!).records).toEqual({ '40-001': { n: 1, ok: 0, at: 1, streak: 0, missed: true } });
    selectExam('kanri');
    const k = await loadData();
    expect(Object.keys(k.records)).toEqual(['40-001']);
  });
});
