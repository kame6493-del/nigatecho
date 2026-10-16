/// <reference types="node" />
// 午前・午後で分けて解く(2026-10-16 テスターの要望「介護ニガテ帳で、午前・午後で分けて解きたい」)。
// 苦手を解く・未回答・ランダム10問・模試の範囲と、その保存(試験ごとの記録の settings.ampm)を確かめる。
import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyData, normalize } from './data';
import { EXAM } from './exam';
import { ampmOf, byAmPm, halfName, hasAmPm, mockPassLine, nigateOrder, passScoreOf, record } from './study';
import type { ExamConfig, Question } from './types';

const store = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value); },
    remove: async ({ key }: { key: string }) => { store.delete(key); },
  },
}));
const { loadData, saveData, keyOf } = await import('../platform/storage');

const q = (id: string, session: '午前' | '午後'): Question => ({
  id, exam: 38, session, no: Number(id.split('-')[1]), subject: 's',
  stem: 's', choices: ['a', 'b'], answer: [1], excluded: false, note: '', figure: null, source: '',
});
const qs = [q('38-001', '午前'), q('38-002', '午前'), q('38-061', '午後'), q('38-062', '午後'), q('38-063', '午後')];

describe('午前・午後でしぼる', () => {
  it('両方があるときだけ切り替えを出す', () => {
    expect(hasAmPm(qs)).toBe(true);
    expect(hasAmPm(qs.filter((x) => x.session === '午前'))).toBe(false);
    expect(hasAmPm([])).toBe(false);
  });

  it('保存した値は、区分のある試験でだけ効く。知らない値は両方', () => {
    expect(ampmOf('午前', true)).toBe('午前');
    expect(ampmOf('午後', true)).toBe('午後');
    expect(ampmOf('午前', false)).toBe('both');
    expect(ampmOf(undefined, true)).toBe('both');
    expect(ampmOf('夜', true)).toBe('both');
  });

  it('しぼると、その区分の問題だけになる(両方はそのまま)', () => {
    expect(byAmPm(qs, '午前').map((x) => x.id)).toEqual(['38-001', '38-002']);
    expect(byAmPm(qs, '午後')).toHaveLength(3);
    expect(byAmPm(qs, 'both')).toBe(qs);
  });

  it('苦手を解く: 午後を選ぶと午前の苦手は出ない', () => {
    let d = emptyData();
    d = record(d, qs[0], false, 1);
    d = record(d, qs[3], false, 2);
    expect(nigateOrder(byAmPm(qs, '午後'), d).map((x) => x.id)).toEqual(['38-062']);
    expect(nigateOrder(byAmPm(qs, '午前'), d).map((x) => x.id)).toEqual(['38-001']);
    expect(nigateOrder(qs, d)).toHaveLength(2);
  });

  it('呼び方は sessionNames があればそれ(精神保健福祉士)', () => {
    const cfg = { ...EXAM, sessionNames: { 午前: '午前(共通科目)' } } as ExamConfig;
    expect(halfName('午前', cfg)).toBe('午前(共通科目)');
    expect(halfName('午後', cfg)).toBe('午後');
  });

  it('片方だけの模試は、1回分の公式の合格点でなく、解いた分の満点 × 合格基準の割合で見る', () => {
    const cfg = { ...EXAM, passRatio: 0.6, passScores: { '38': 67 } } as ExamConfig;
    expect(mockPassLine({ exam: 38, total: 60, session: '午前' }, cfg)).toEqual({ score: 36, official: false });
    expect(mockPassLine({ exam: 38, total: 125 }, cfg)).toEqual(passScoreOf(38, 125, cfg));
  });
});

describe('選んだ範囲の保存(前の記録を壊さない)', () => {
  beforeEach(() => store.clear());

  it('前の版の記録(ampm が無い)は両方として読め、記録・模試はそのまま', async () => {
    const old = { version: 1, records: { '38-001': { n: 2, ok: 1, at: 5, streak: 0, missed: true } }, marks: ['38-002'], mocks: [{ at: 1, exam: 38, score: 80, total: 125, bySubject: {}, seconds: 10 }], settings: { fontScale: 1.1, examDate: '2027-01-31', remindAt: '21:00', remind: true }, daily: { '2026-10-01': 3 } };
    store.set(keyOf(EXAM.key), JSON.stringify(old));
    const d = await loadData();
    expect(d.settings.ampm).toBeUndefined();
    expect(d.records['38-001'].missed).toBe(true);
    expect(d.marks).toEqual(['38-002']);
    expect(d.mocks).toHaveLength(1);
    expect(d.mocks[0].session).toBeUndefined();
    expect(d.settings.fontScale).toBe(1.1);
  });

  it('午後を選んで保存すると、開き直しても午後のまま。両方に戻すと項目ごと消える', async () => {
    const d = { ...emptyData(), settings: { ...emptyData().settings, ampm: '午後' as const } };
    await saveData(d);
    expect((await loadData()).settings.ampm).toBe('午後');
    const { ampm: _x, ...rest } = d.settings;
    await saveData({ ...d, settings: rest });
    const back = await loadData();
    expect(back.settings.ampm).toBeUndefined();
    expect(JSON.parse(store.get(keyOf(EXAM.key))!).settings).not.toHaveProperty('ampm');
  });

  it('壊れた値は捨てる。片方の模試の印は残し、知らない印は外す', () => {
    const d = normalize({ settings: { ampm: '夕方' }, mocks: [
      { at: 1, exam: 38, score: 30, total: 60, bySubject: {}, seconds: 1, session: '午前' },
      { at: 2, exam: 38, score: 30, total: 60, bySubject: {}, seconds: 1, session: 'x' },
    ] });
    expect(d.settings.ampm).toBeUndefined();
    expect(d.mocks[0].session).toBe('午前');
    expect(d.mocks[1]).not.toHaveProperty('session');
  });
});

describe('問題データの午前・午後(どの試験に切り替えが出るか)', () => {
  const dirs = ['kaigo', 'kanri', 'pt', 'rinsho', 'shakai', 'seishin'].filter((d) => existsSync(`exams/${d}/data/questions.json`));
  it.each(dirs)('%s: どの回にも午前と午後があり、合わせて1回分', (dir) => {
    const all: Question[] = JSON.parse(readFileSync(`exams/${dir}/data/questions.json`, 'utf8'));
    const cfg = JSON.parse(readFileSync(`exams/${dir}/exam.json`, 'utf8')) as ExamConfig;
    expect(hasAmPm(all)).toBe(true);
    for (const n of new Set(all.map((x) => x.exam))) {
      const one = all.filter((x) => x.exam === n);
      expect(hasAmPm(one)).toBe(true);
      expect(byAmPm(one, '午前').length + byAmPm(one, '午後').length).toBe(one.length);
      expect(one.length).toBe(cfg.perExam);
    }
  });

  it('介護福祉士 第38回は 午前60問・午後65問', () => {
    const all: Question[] = JSON.parse(readFileSync('exams/kaigo/data/questions.json', 'utf8'));
    const one = all.filter((x) => x.exam === 38);
    expect(byAmPm(one, '午前')).toHaveLength(60);
    expect(byAmPm(one, '午後')).toHaveLength(65);
  });
});
