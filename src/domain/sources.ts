import type { ExamConfig, SourceLink } from './types';

export const LICENSE_FALLBACK: SourceLink = {
  title: '公共データ利用規約(第1.0版)',
  url: 'https://www.digital.go.jp/resources/open_data/public_data_license_v1.0',
};

/** 第N回の問題・正答を載せている厚生労働省のページ。その回のページが無ければ、いま公開中のページ → 試験の案内ページ */
export function sourcePageFor(exam: number, cfg: ExamConfig): SourceLink | null {
  const s = cfg.sources;
  if (!s) return null;
  return s.pages[String(exam)] ?? s.current ?? s.top;
}

/** その回のページが厚生労働省にまだあるか */
export function hasOwnPage(exam: number, cfg: ExamConfig): boolean {
  return !!cfg.sources?.pages[String(exam)];
}
