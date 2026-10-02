import type { AppData, ExamConfig, Question, Record1 } from './types';

/** 2回続けて正解したら苦手から外れる */
export const CLEAR_STREAK = 2;

/** 配点(省略は1) */
export const pointsOf = (q: Question) => q.points ?? 1;

/** 選ぶ数(「2つ選べ」なら2) */
export const pickCount = (q: Question) => Math.max(1, q.pick ?? 1);

/**
 * 1つ選ぶ問題: 選んだ番号が正答のどれかなら正解(複数正答はどれでもよい)。
 * 2つ選ぶ問題: 選んだ組が正答の組と完全に一致したときだけ正解。
 * accepted がある問題: 選んだ組が、公式が正解とした組のどれかと一致すれば正解。
 */
export function isCorrect(q: Question, picked: number | number[]): boolean {
  const xs = [...new Set(Array.isArray(picked) ? picked : [picked])].sort((x, y) => x - y);
  if (xs.length !== pickCount(q)) return false;
  const same = (b: number[]) => b.length === xs.length && [...b].sort((x, y) => x - y).every((v, i) => v === xs[i]);
  if (q.accepted?.length) return q.accepted.some(same);
  if (pickCount(q) === 1) return q.answer.includes(xs[0]);
  return same(q.answer);
}

export function isLocked(q: Question, premium: boolean, cfg: ExamConfig): boolean {
  return !premium && !cfg.freeExams.includes(q.exam);
}

/** 苦手 = 間違えたことがあって、まだ2回続けて正解していない問題 */
export function isNigate(r: Record1 | undefined): boolean {
  return !!r && r.missed && r.streak < CLEAR_STREAK;
}

export function dayKey(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 1問解いた結果を書き込む。除外問題は記録しない(得点にも苦手にも数えない) */
export function record(data: AppData, q: Question, ok: boolean, now: number): AppData {
  if (q.excluded) return data;
  const prev = data.records[q.id];
  const next: Record1 = {
    n: (prev?.n ?? 0) + 1,
    ok: (prev?.ok ?? 0) + (ok ? 1 : 0),
    at: now,
    streak: ok ? (prev?.streak ?? 0) + 1 : 0,
    missed: (prev?.missed ?? false) || !ok,
  };
  const day = dayKey(now);
  return {
    ...data,
    records: { ...data.records, [q.id]: next },
    daily: { ...data.daily, [day]: (data.daily[day] ?? 0) + 1 },
  };
}

export function toggleMark(data: AppData, id: string): AppData {
  const has = data.marks.includes(id);
  return { ...data, marks: has ? data.marks.filter((m) => m !== id) : [...data.marks, id] };
}

/** 再現できる乱数(テストと「もう一度」用) */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 苦手を解く順番。続けて正解した数が少ない物 → 間違えた割合が高い物 → 前に解いてから時間が経った物。
 */
export function nigateOrder(qs: Question[], data: AppData): Question[] {
  const list = qs.filter((q) => isNigate(data.records[q.id]));
  return list.sort((a, b) => {
    const ra = data.records[a.id]!;
    const rb = data.records[b.id]!;
    if (ra.streak !== rb.streak) return ra.streak - rb.streak;
    const ma = 1 - ra.ok / ra.n;
    const mb = 1 - rb.ok / rb.n;
    if (ma !== mb) return mb - ma;
    return ra.at - rb.at;
  });
}

export function unseen(qs: Question[], data: AppData): Question[] {
  return qs.filter((q) => !data.records[q.id] && !q.excluded);
}

export interface SubjectStat {
  subject: string;
  /** その科目で解ける問題の数 */
  total: number;
  /** 1回以上解いた数 */
  seen: number;
  /** 最後に解いたとき正解だった数 */
  lastOk: number;
  nigate: number;
  /** 最後の結果での正答率。まだ解いていなければ null */
  rate: number | null;
}

export function subjectStats(qs: Question[], data: AppData, cfg: ExamConfig): SubjectStat[] {
  return cfg.subjects.map((subject) => {
    const mine = qs.filter((q) => q.subject === subject && !q.excluded);
    let seen = 0, lastOk = 0, nigate = 0;
    for (const q of mine) {
      const r = data.records[q.id];
      if (!r) continue;
      seen++;
      if (r.streak > 0) lastOk++;
      if (isNigate(r)) nigate++;
    }
    return { subject, total: mine.length, seen, lastOk, nigate, rate: seen ? lastOk / seen : null };
  });
}

/** 本番1回分の科目の配点(最新の回の配点の合計。配点の無い試験では問題数と同じ) */
export function subjectWeights(all: Question[], cfg: ExamConfig): Record<string, number> {
  const latest = Math.max(...all.map((q) => q.exam));
  const w: Record<string, number> = {};
  for (const s of cfg.subjects) w[s] = 0;
  for (const q of all) if (q.exam === latest) w[q.subject] = (w[q.subject] ?? 0) + pointsOf(q);
  return w;
}

export interface Estimate {
  /** 本番で取れそうな点(200点満点) */
  score: number;
  pass: number;
  total: number;
  /** 推定に使えた科目の配点の割合。低いうちは当てにならない */
  coverage: number;
}

/**
 * 今の正答率で本番を受けたときの点。まだ解いていない科目は、ほかの科目の平均で埋める。
 * 解いた問題が少ないうちは null(当てにならない数字を見せない)。
 */
export function estimate(stats: SubjectStat[], weights: Record<string, number>, cfg: ExamConfig, minSeen = 30): Estimate | null {
  const seenTotal = stats.reduce((s, x) => s + x.seen, 0);
  if (seenTotal < minSeen) return null;
  const known = stats.filter((s) => s.rate !== null);
  const okAll = known.reduce((s, x) => s + x.lastOk, 0);
  const seenAll = known.reduce((s, x) => s + x.seen, 0);
  const avg = seenAll ? okAll / seenAll : 0;
  let score = 0, covered = 0;
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || cfg.perExam;
  for (const s of stats) {
    const w = weights[s.subject] ?? 0;
    score += w * (s.rate ?? avg);
    if (s.rate !== null) covered += w;
  }
  return { score: Math.round(score), pass: Math.ceil(total * cfg.passRatio), total, coverage: covered / total };
}

export interface SubEstimate {
  label: string;
  score: number;
  total: number;
  pass: number;
}

/**
 * 総得点とは別の基準(実地問題など)の予想。その配点の問題を最後に解いた結果の正答率 × 本番での満点。
 * 解いた数が少ないうちは null。
 */
export function subEstimate(open: Question[], all: Question[], data: AppData, cfg: ExamConfig, minSeen = 10): SubEstimate | null {
  const sp = cfg.subPass;
  if (!sp) return null;
  const mine = open.filter((q) => pointsOf(q) === sp.points && !q.excluded);
  let seen = 0, ok = 0;
  for (const q of mine) {
    const r = data.records[q.id];
    if (!r) continue;
    seen++;
    if (r.streak > 0) ok++;
  }
  if (seen < minSeen) return null;
  const latest = Math.max(...all.map((q) => q.exam));
  const total = all.filter((q) => q.exam === latest && !q.excluded && pointsOf(q) === sp.points).reduce((t, q) => t + pointsOf(q), 0);
  return { label: sp.label, score: Math.round((total * ok) / seen), total, pass: Math.ceil(total * sp.ratio) };
}

/** 試験日までの残り日数。過ぎていたら null */
export function daysLeft(examDate: string, now: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(examDate);
  if (!m) return null;
  const exam = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const t = new Date(now);
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const d = Math.round((exam - today) / 86400000);
  return d >= 0 ? d : null;
}

/** 今日まで何日続けて解いたか(今日まだ解いていなければ昨日までで数える) */
export function streakDays(daily: Record<string, number>, now: number): number {
  let t = now;
  if (!daily[dayKey(t)]) t -= 86400000;
  let n = 0;
  while (daily[dayKey(t)]) { n++; t -= 86400000; }
  return n;
}
