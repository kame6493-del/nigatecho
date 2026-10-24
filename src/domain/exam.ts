import type { ExamConfig } from './types';
import multi from '../exams.multi.json';

/**
 * 1本のアプリの中で選べる試験。中身は exams/<試験>/exam.json と exams/multi.json で、
 * scripts/use-multi.mjs が src/exams.multi.json に写す。先頭(管理栄養士)が、はじめて開いたときの試験。
 */
export const EXAMS: ExamConfig[] = multi.exams as unknown as ExamConfig[];

/** アプリそのものの設定(公開中の管理栄養士のアプリの ID・RevenueCat のキー・サポートページ) */
export const APP: { appId: string; appName: string; site: string; revenuecat?: { ios: string; android: string } } = multi.app;

/**
 * セット(1つの買い切りで複数の試験の完全版を開く。exams/multi.json の bundles)。
 * RevenueCat でセットの商品を、入っている試験の entitlement の全部に付けるので、買えば accessFrom でそのまま全部開く。
 */
export interface Bundle {
  id: string;
  productId: string;
  /** "介護福祉士・社会福祉士・精神保健福祉士の完全版 3つセット" */
  name: string;
  /** 入っている試験(exams の dir) */
  exams: string[];
  /** 開発のブラウザの疑似購入用の値段(本物はストアの priceString) */
  price: string;
}
export const BUNDLES: Bundle[] = (multi as unknown as { bundles?: Bundle[] }).bundles ?? [];

/** その試験が入っているセット(無ければ undefined) */
export const bundleOf = (dir: string): Bundle | undefined => BUNDLES.find((b) => b.exams.includes(dir));

/**
 * 購入画面にセットを出すか: その試験が入ったセットがあり、セットの試験をどれも持っていないときだけ。
 * どれか1つでも買った人には出さない(持っている試験の分を二重に払わせない)
 */
export function bundleOffer(dir: string, access: Record<string, boolean>): Bundle | undefined {
  const b = bundleOf(dir);
  if (!b) return undefined;
  return b.exams.some((d) => access[d]) ? undefined : b;
}

/** はじめて開いたとき(選んだ試験の記録が無いとき)の試験 */
export const FIRST_EXAM = EXAMS[0];

/**
 * はじめて開いたときの「どの試験を受けますか」の並び(売れている順・宣伝している順。2026-10-22)。
 * ここに無い試験は後ろに元の順で並べる。FIRST_EXAM(前の版の記録がある人の開き方)は変えない
 */
export const FIRST_PICK_ORDER = ['kaigo', 'nurse', 'shakai', 'seishin', 'kanri', 'pt'];
export const firstPickExams = (): ExamConfig[] => {
  const rank = (d: string) => { const i = FIRST_PICK_ORDER.indexOf(d); return i < 0 ? FIRST_PICK_ORDER.length : i; };
  return EXAMS.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e.dir) - rank(b.e.dir) || a.i - b.i).map((x) => x.e);
};

/** 試験が1つだけのアプリ(臨床検査技師の単体のアプリ)。試験を切り替える所を出さない */
export const SINGLE = EXAMS.length === 1;

export const examByDir = (dir: string | null | undefined): ExamConfig | undefined => EXAMS.find((e) => e.dir === dir);

/**
 * いま選んでいる試験の設定。画面を描く前に selectExam() で切り替える。
 * (ES モジュールの live binding。import した側の EXAM も切り替わる)
 */
export let EXAM: ExamConfig = FIRST_EXAM;

/** 次の本番の試験日(いま選んでいる試験の) */
export let DEFAULT_EXAM_DATE = EXAM.examDate;

/** 試験を切り替える。知らない試験なら最初の試験(管理栄養士) */
export function selectExam(dir: string | null | undefined): ExamConfig {
  EXAM = examByDir(dir) ?? FIRST_EXAM;
  DEFAULT_EXAM_DATE = EXAM.examDate;
  return EXAM;
}

/** 科目名を画面用に短くする */
export const short = (s: string) => EXAM.short[s] ?? s;

/** 第N回が何年の試験か */
export const yearOf = (exam: number) => EXAM.latestYear - (EXAM.latestExam - exam);
