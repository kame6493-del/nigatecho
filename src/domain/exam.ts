import type { ExamConfig } from './types';
import multi from '../exams.multi.json';

/**
 * 1本のアプリの中で選べる試験。中身は exams/<試験>/exam.json と exams/multi.json で、
 * scripts/use-multi.mjs が src/exams.multi.json に写す。先頭(管理栄養士)が、はじめて開いたときの試験。
 */
export const EXAMS: ExamConfig[] = multi.exams as unknown as ExamConfig[];

/** アプリそのものの設定(公開中の管理栄養士のアプリの ID・RevenueCat のキー・サポートページ) */
export const APP: { appId: string; appName: string; site: string; revenuecat?: { ios: string; android: string } } = multi.app;

/** はじめて開いたとき(選んだ試験の記録が無いとき)の試験 */
export const FIRST_EXAM = EXAMS[0];

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
