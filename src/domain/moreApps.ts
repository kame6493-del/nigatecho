/**
 * 設定の下の「作者のほかのアプリ」(Android 1.4.8 vc16 から。Android だけ)。
 * 解いている途中・結果の画面には出さない。設定を開いた人が、下までスクロールした時に見えるだけ。
 * 押した数は、行き先のアプリの Play Console(ユーザー獲得 → utm_source / utm_campaign)で数える。
 * 18歳以上向けのアプリ(カチマケ)はここに入れない。値段・「無料」は書かない。
 */

export interface MoreApp {
  /** 行き先のパッケージ名 */
  id: string;
  name: string;
  /** ひと言(Play の短い説明の範囲で。数字を入れるなら掲載文と合わせる) */
  line: string;
  /** public/ からのアイコンの場所 */
  icon: string;
}

export const MORE_APPS: MoreApp[] = [
  { id: 'jp.pasudan.app', name: 'パスダン', line: 'ITパスポートの過去問を、4択のバトルで解き進める勉強アプリ', icon: 'more/pasudan.png' },
  { id: 'jp.tabedoki.app', name: 'タベドキ', line: '冷蔵庫の食材を賞味期限の近い順に並べ、前の日にお知らせ', icon: 'more/tabedoki.png' },
];

/** utm_source に入れる元のアプリの名前。まとめ版は nigatecho_matome、ほかは appId の . を _ に */
export function promoSource(appId: string): string {
  return appId === 'jp.nigatecho.kanrieiyoushi' ? 'nigatecho_matome' : appId.replace(/\./g, '_');
}

/** Play のページの URL。referrer は Play がそのまま Install Referrer に渡すので、中身を1回だけエンコードする */
export function playUrl(targetId: string, source: string, campaign = 'settings'): string {
  const referrer = `utm_source=${source}&utm_medium=crosspromo&utm_campaign=${campaign}`;
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(targetId)}&referrer=${encodeURIComponent(referrer)}`;
}

/** このアプリで出す物(自分自身は出さない)。Android 以外では空 */
export function moreAppsFor(platform: string, selfId: string): MoreApp[] {
  if (platform !== 'android') return [];
  return MORE_APPS.filter((a) => a.id !== selfId);
}
