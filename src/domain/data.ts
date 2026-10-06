import type { AppData, MockResult, Record1, Settings } from './types';
import { DEFAULT_EXAM_DATE } from './exam';

export const defaultSettings = (): Settings => ({
  fontScale: 1,
  examDate: DEFAULT_EXAM_DATE,
  remindAt: '21:00',
  remind: false,
});

export const emptyData = (): AppData => ({
  version: 1,
  records: {},
  marks: [],
  mocks: [],
  settings: defaultSettings(),
  daily: {},
});

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** 保存データを読み直すときに、壊れた所や足りない所を埋める */
export function normalize(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppData>;
  const records: Record<string, Record1> = {};
  if (r.records && typeof r.records === 'object') {
    for (const [id, v] of Object.entries(r.records)) {
      if (!v || typeof v !== 'object') continue;
      const n = Math.max(0, Math.floor(num(v.n)));
      if (n === 0) continue;
      records[id] = {
        n,
        ok: Math.min(n, Math.max(0, Math.floor(num(v.ok)))),
        at: num(v.at),
        streak: Math.max(0, Math.floor(num(v.streak))),
        missed: !!v.missed,
      };
    }
  }
  const marks = Array.isArray(r.marks) ? [...new Set(r.marks.filter((m): m is string => typeof m === 'string'))] : [];
  const mocks = Array.isArray(r.mocks)
    ? r.mocks.filter((m): m is MockResult => !!m && typeof m === 'object' && typeof m.score === 'number' && typeof m.total === 'number')
    : [];
  const s = (r.settings ?? {}) as Partial<Settings>;
  const settings: Settings = {
    fontScale: Math.min(1.4, Math.max(0.85, num(s.fontScale, 1))),
    examDate: typeof s.examDate === 'string' ? s.examDate : base.settings.examDate,
    remindAt: typeof s.remindAt === 'string' && /^\d{2}:\d{2}$/.test(s.remindAt) ? s.remindAt : base.settings.remindAt,
    remind: !!s.remind,
    ...(s.exemptOnly ? { exemptOnly: true } : {}),
  };
  const daily: Record<string, number> = {};
  if (r.daily && typeof r.daily === 'object') {
    for (const [k, v] of Object.entries(r.daily)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && num(v) > 0) daily[k] = Math.floor(num(v));
  }
  return { version: 1, records, marks, mocks, settings, daily };
}
