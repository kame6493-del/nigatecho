/**
 * 見た目の部品(2026-10-10 作り直し)。試験ごとの色・絵・ひとこと、科目の色、日付の書き方。
 * 絵は持ち主が用意した UI の見本から切り出した物(scripts/make_redesign_assets.py)。
 */
import kaigo from '../assets/ill/exam_kaigo.webp';
import shakai from '../assets/ill/exam_shakai.webp';
import seishin from '../assets/ill/exam_seishin.webp';
import kanri from '../assets/ill/exam_kanri.webp';
import pt from '../assets/ill/exam_pt.webp';
import tulip from '../assets/ill/tulip.webp';
import girlOk from '../assets/ill/girl_ok.webp';
import birdParty from '../assets/ill/bird_party.webp';
import birdQ from '../assets/ill/bird_q.webp';
import birdPencil from '../assets/ill/bird_pencil.webp';
import womanCheer from '../assets/ill/woman_cheer.webp';
import logo from '../assets/logo.png';

export const ART = { tulip, girlOk, birdParty, birdQ, birdPencil, womanCheer, logo };

export interface ExamLook {
  /** カードの地の色 */
  tint: string;
  /** 文字と縁の色 */
  ink: string;
  img: string;
  /** ひとこと(見本の文言) */
  catch: string;
}

const LOOKS: Record<string, ExamLook> = {
  kaigo: { tint: '#fde8e7', ink: '#b3262d', img: kaigo, catch: '高齢者の生活を支える専門職。介護の知識と技術を問う国家試験です。' },
  shakai: { tint: '#e5effc', ink: '#1f4f9a', img: shakai, catch: '人と社会の暮らしを支える専門職。福祉に関する幅広い知識を問う国家試験です。' },
  seishin: { tint: '#e3f4e8', ink: '#1f6b3a', img: seishin, catch: 'こころの健康と社会復帰を支える専門職。精神保健に関する知識を問う国家試験です。' },
  kanri: { tint: '#fff2d9', ink: '#8a5a00', img: kanri, catch: '食と健康の専門職。栄養学や食事療法に関する知識を問う国家試験です。' },
  pt: { tint: '#eeeafc', ink: '#4b3a9c', img: pt, catch: '運動機能の回復を支援する専門職。医学・リハビリテーションに関する知識を問う国家試験です。' },
};

export const lookOf = (dir: string): ExamLook => LOOKS[dir] ?? { tint: '#f4efe6', ink: '#5b524b', img: kanri, catch: '' };

/** 科目の棒の色(見本の成績画面の並び: 赤・橙・黄・緑・水色・青・紫・桃・灰) */
const SUBJECT_COLORS = ['#e8524f', '#f39a3d', '#f2c94c', '#5bbf72', '#4bb3c8', '#4f8fe0', '#9b7be0', '#ec7aa5', '#8f9aab'];
export const subjectColor = (i: number) => SUBJECT_COLORS[i % SUBJECT_COLORS.length];

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/** "2027-02-28" → "2027年2月28日(日)" */
export function fmtDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEK[d.getDay()]})`;
}

export const weekday = (t: number) => WEEK[new Date(t).getDay()];
