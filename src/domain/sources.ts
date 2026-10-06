import type { ExamConfig, SourceLink } from './types';

export const LICENSE_FALLBACK: SourceLink = {
  title: '公共データ利用規約(第1.0版)',
  url: 'https://www.digital.go.jp/resources/open_data/public_data_license_v1.0',
};

/** 問題を公表している所(厚生労働省 / 社会福祉振興・試験センター) */
export const orgOf = (cfg: ExamConfig) => cfg.sources?.org ?? '厚生労働省';

/** 厚生労働省が公表した試験か(公共データ利用規約で使う試験) */
export const isMhlw = (cfg: ExamConfig) => orgOf(cfg) === '厚生労働省';

/** 第N回の問題・正答を載せているページ。その回のページが無ければ、いま公開中のページ → 試験の案内ページ */
export function sourcePageFor(exam: number, cfg: ExamConfig): SourceLink | null {
  const s = cfg.sources;
  if (!s) return null;
  return s.pages[String(exam)] ?? s.current ?? s.top;
}

/** その回のページがまだあるか(回ごとのページ、または「過去の試験問題」のページにいま載っている回) */
export function hasOwnPage(exam: number, cfg: ExamConfig): boolean {
  return !!cfg.sources?.pages[String(exam)] || !!cfg.sources?.listedExams?.includes(exam);
}

/** 問題ごとの出典の表示。例: 厚生労働省「第40回管理栄養士国家試験」 / 社会福祉振興・試験センター「第38回介護福祉士国家試験」 */
export function sourceLabelOf(exam: number, cfg: ExamConfig): string {
  return (cfg.sourceLabel ?? `${orgOf(cfg)}「第{n}回${cfg.name}国家試験」`).replace('{n}', String(exam));
}

/** 実施団体と関係が無いことの表示 */
export function disclaimerOf(cfg: ExamConfig): string {
  return cfg.disclaimer ?? '本アプリは厚生労働省とは関係のない個人の制作物です。';
}
