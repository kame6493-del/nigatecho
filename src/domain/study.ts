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

/** 本番1回分の科目の配点(最新の回の、採点除外を除いた配点の合計。模試の満点と同じ数え方) */
export function subjectWeights(all: Question[], cfg: ExamConfig): Record<string, number> {
  const latest = Math.max(...all.map((q) => q.exam));
  const w: Record<string, number> = {};
  for (const s of cfg.subjects) w[s] = 0;
  // cfg の科目だけを数える(免除を受けた見方では、免除された科目の配点を入れない)
  for (const q of all) if (q.exam === latest && !q.excluded && q.subject in w) w[q.subject] += pointsOf(q);
  return w;
}

export interface Estimate {
  /** 本番で取れそうな点(200点満点) */
  score: number;
  /** 線を引く点。公式の合格点がある試験は直近の回の合格点、無ければ満点 × 合格基準の割合 */
  pass: number;
  total: number;
  /** 推定に使えた科目の配点の割合。低いうちは当てにならない */
  coverage: number;
  /** pass が公式の合格点のときの回(第38回なら 38)。割合で出したときは undefined */
  passExam?: number;
  /** 満点 × 合格基準の割合(6割)。公式の合格点がある試験で、補足に出す */
  ratioPass: number;
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
  const line = latestPassLine(total, cfg);
  return { score: Math.round(score), pass: line.score, total, coverage: covered / total, passExam: line.exam, ratioPass: Math.ceil(total * cfg.passRatio) };
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

/**
 * 免除を受けて受ける人の見方の設定(科目・科目群・満点・合格点をその受け方の物にした写し)。
 * exempt の無い試験や、切り替えていないときは cfg のまま。
 */
export function examView(cfg: ExamConfig, exemptOnly: boolean | undefined): ExamConfig {
  const x = cfg.exempt;
  if (!x || !exemptOnly) return cfg;
  return { ...cfg, subjects: x.subjects, groups: x.groups, perExam: x.perExam, passScores: x.passScores };
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

/**
 * 「すべての科目群で得点」の基準で、0点だった科目群の名前(介護福祉士・社会福祉士)。
 * bySubject は科目ごとの {ok, n}。出題の無かった科目群は数えない。
 */
export function zeroGroups(bySubject: Record<string, { ok: number; n: number }>, cfg: ExamConfig): string[] {
  if (!cfg.groups) return [];
  return cfg.groups
    .filter((g) => {
      const xs = g.subjects.map((s) => bySubject[s]).filter((v) => !!v && v.n > 0);
      return xs.length > 0 && xs.reduce((t, v) => t + v.ok, 0) === 0;
    })
    .map((g) => g.name);
}

export interface PassLine {
  score: number;
  /** 公式の合格点(難しさで補正された点)なら true。満点 × 割合で出したときは false */
  official: boolean;
  /** official のとき、その合格点の回 */
  exam?: number;
}

/** 公式の合格点が分かっている回のうち、いちばん新しい回。無ければ null */
export function latestPassExam(cfg: ExamConfig): number | null {
  const ks = Object.keys(cfg.passScores ?? {}).map(Number).filter((n) => Number.isFinite(n));
  return ks.length ? Math.max(...ks) : null;
}

/**
 * 回を決めない合格の線(ホームの予想点)。毎年の合格点が変わる試験(介護福祉士・社会福祉士・精神保健福祉士)は
 * 直近の回の公式の合格点、決まった割合の試験(管理栄養士・理学療法士)は満点 × 合格基準の割合。
 */
export function latestPassLine(total: number, cfg: ExamConfig): PassLine {
  const n = latestPassExam(cfg);
  if (n !== null) return { score: cfg.passScores![String(n)], official: true, exam: n };
  return { score: Math.ceil(total * cfg.passRatio), official: false };
}

/** その回の合格点。公式の点があればそれ、その回の点が無ければ直近の回の公式の点、どちらも無ければ満点 × 合格基準の割合 */
export function passScoreOf(exam: number, total: number, cfg: ExamConfig): PassLine {
  const v = cfg.passScores?.[String(exam)];
  return typeof v === 'number' ? { score: v, official: true, exam } : latestPassLine(total, cfg);
}

/** 回の範囲の表示。同じ回なら「第37回」、違えば「第37〜38回」(小さい方から) */
export function examRange(a: number, b: number): string {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return lo === hi ? `第${lo}回` : `第${lo}〜${hi}回`;
}

/**
 * 無料で解いた人に、完全版で増える分を見せるための数。鍵のかかった回の範囲と問題数。
 * 鍵のかかった問題が無ければ null(出さない)。
 */
export function lockedSummary(all: Iterable<Question>, cfg: ExamConfig): { from: number; to: number; count: number } | null {
  let from = Infinity, to = -Infinity, count = 0;
  for (const q of all) {
    if (cfg.freeExams.includes(q.exam)) continue;
    count++;
    if (q.exam < from) from = q.exam;
    if (q.exam > to) to = q.exam;
  }
  return count ? { from, to, count } : null;
}
