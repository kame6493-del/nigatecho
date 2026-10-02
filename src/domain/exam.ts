import type { ExamConfig } from './types';
import current from '../exam.current.json';

/**
 * いま組んでいる試験の設定。中身は exams/<試験>/exam.json で、
 * scripts/use-exam.mjs が src/exam.current.json に写す(試験を替えるときはそのスクリプトを流す)。
 */
export const EXAM: ExamConfig = current as ExamConfig;

/** 次の本番の試験日 */
export const DEFAULT_EXAM_DATE = EXAM.examDate;

/** 科目名を画面用に短くする */
export const short = (s: string) => EXAM.short[s] ?? s;

/** 第N回が何年の試験か */
export const yearOf = (exam: number) => EXAM.latestYear - (EXAM.latestExam - exam);
