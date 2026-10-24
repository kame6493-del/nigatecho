import { Capacitor } from '@capacitor/core';
import { Purchases, type CustomerInfo, type PurchasesPackage } from '@revenuecat/purchases-capacitor';

import { APP, BUNDLES, EXAMS, type Bundle } from '../domain/exam';
import type { ExamConfig } from '../domain/types';
import type { Attrs } from '../domain/track';

/**
 * RevenueCat の公開APIキー(秘密鍵ではない)。アプリは1本(公開中の管理栄養士のアプリ)なので、キーもその1組。
 * 空のままなら購入ボタンは「購入の準備中です」になり、課金は一切走らない。
 *
 * 商品は試験ごとの買い切り(非消耗型)。どの商品も、その試験の完全版だけを開く。
 * - 管理栄養士 nigatecho_kanri_full → entitlement "full"(公開中の商品のまま。買った人はそのまま使える)
 * - 理学療法士 nigatecho_multi_pt_full → "pt_full" / 介護福祉士 …_kaigo_full → "kaigo_full" / 社会福祉士 …_shakai_full → "shakai_full"
 * - 精神保健福祉士 nigatecho_multi_seishin_full → "seishin_full"(v1.2。社会福祉士の完全版とは別の商品)
 * - 3つセット nigatecho_multi_fukushi_set(v1.4.2)→ kaigo_full・shakai_full・seishin_full の3つ全部(RevenueCat で1つの商品を3つの entitlement に付ける)
 * RevenueCat の売り場(current offering)に全部のパッケージを並べ、どの試験の物かは商品IDで見分ける。
 */
const API_KEYS = { ios: APP.revenuecat?.ios ?? '', android: APP.revenuecat?.android ?? '' };

export const entitlementOf = (e: ExamConfig) => e.entitlement ?? 'full';

/** 試験ごとに完全版を持っているか。キーは exams の dir */
export type Access = Record<string, boolean>;

export type BillingState =
  | { status: 'unavailable'; reason: string; access: Access }
  | { status: 'ready'; access: Access; prices: Record<string, string>; pkgs: Record<string, PurchasesPackage>; subjects?: string[] };

export const EMPTY_ACCESS: Access = {};

const platform = Capacitor.getPlatform();
const key = platform === 'ios' ? API_KEYS.ios : platform === 'android' ? API_KEYS.android : '';
/** ブラウザで開発しているときだけ、画面確認用の疑似購入を使う */
const mock = !Capacitor.isNativePlatform() && import.meta.env.DEV;
/** 疑似購入の印。管理栄養士は前の版と同じ名前 */
const mockKey = (e: ExamConfig) => (e.dir === EXAMS[0].dir ? 'nigatecho.mockFull' : `nigatecho.mockFull.${e.dir}`);

function mockAccess(): Access {
  const a: Access = {};
  for (const e of EXAMS) a[e.dir] = localStorage.getItem(mockKey(e)) === '1';
  return a;
}

/** 有効な entitlement から、どの試験が開いているかを出す */
export function accessFrom(active: string[]): Access {
  const a: Access = {};
  for (const e of EXAMS) a[e.dir] = active.includes(entitlementOf(e));
  return a;
}

const accessOf = (info: CustomerInfo) => accessFrom(Object.keys(info.entitlements.active));

/** 前に買った科目パック(entitlement "pack_<id>")で開く科目。パックのある試験(介護福祉士の単体のアプリ)だけ */
export function packSubjectsFrom(active: string[]): string[] {
  return EXAMS.flatMap((e) => (e.packs ?? []).filter((p) => active.includes(`pack_${p.id}`)).flatMap((p) => p.subjects));
}
/** 前に買った科目パックの名前 */
const packNamesFrom = (active: string[]) =>
  EXAMS.flatMap((e) => (e.packs ?? []).filter((p) => active.includes(`pack_${p.id}`)).map((p) => `${e.name} ${p.name}`));

/** configure は1回だけ(属性の書き込みと読み込みが同時に来ても2回呼ばない) */
let configuring: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!configuring) {
    configuring = Purchases.configure({ apiKey: key }).then(() => undefined);
    configuring.catch(() => { configuring = null; });
  }
  return configuring;
}

/**
 * 購入管理(RevenueCat)の、この端末の匿名の利用者に付ける独自の属性。どの試験の人が、どこで購入画面を開き、どこで買ったかを数えるためだけに使う。
 * 入れるのは試験の名前(exams の dir)・画面の場所・回数・解いた数だけ。氏名・メール・端末の名前などの個人を特定する情報は入れない。
 * RevenueCat の予約の属性($campaign など)は使わない。失敗しても画面には何も出さない(学習の邪魔をしない)。
 * 開発のブラウザ(疑似購入)では送らず、localStorage の nigatecho.mockAttrs に残す(試験で確かめるため)。
 */

export async function setAttrs(a: Attrs): Promise<void> {
  // import.meta.env.DEV を先に書き、本番の中身からはこの枝ごと消す
  if (import.meta.env.DEV && mock) {
    try {
      const cur = JSON.parse(localStorage.getItem('nigatecho.mockAttrs') ?? '{}') as Attrs;
      localStorage.setItem('nigatecho.mockAttrs', JSON.stringify({ ...cur, ...a }));
    } catch { /* 記録できなくても画面は動かす */ }
    return;
  }
  if (!key) return;
  try {
    await ensure();
    await Purchases.setAttributes(a);
  } catch (e) {
    console.warn('[nigatecho] attributes', e);
  }
}

export async function loadBilling(): Promise<BillingState> {
  if (mock) {
    const prices: Record<string, string> = {};
    for (const e of EXAMS) prices[e.productId] = e.price;
    for (const b of BUNDLES) prices[b.productId] = b.price;
    return { status: 'ready', access: mockAccess(), prices, pkgs: {} };
  }
  if (!key) return { status: 'unavailable', reason: '購入の準備中です', access: EMPTY_ACCESS };
  try {
    await ensure();
    const [{ customerInfo }, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
    const pkgs: Record<string, PurchasesPackage> = {};
    const prices: Record<string, string> = {};
    for (const pkg of offerings.current?.availablePackages ?? []) {
      pkgs[pkg.product.identifier] = pkg;
      prices[pkg.product.identifier] = pkg.product.priceString;
    }
    return { status: 'ready', access: accessOf(customerInfo), prices, pkgs, subjects: packSubjectsFrom(Object.keys(customerInfo.entitlements.active)) };
  } catch (e) {
    console.error('[nigatecho] billing', e);
    return { status: 'unavailable', reason: 'ストアに接続できませんでした', access: EMPTY_ACCESS };
  }
}

/** その試験の完全版を今買えるか(ストアに商品がある、または開発用の疑似購入) */
export function canBuy(state: BillingState, exam: ExamConfig): boolean {
  if (state.status !== 'ready') return false;
  return mock || !!state.pkgs[exam.productId];
}

/** true=その試験の完全版が有効になった / false=キャンセル。失敗は例外 */
export async function purchase(state: BillingState, exam: ExamConfig): Promise<boolean> {
  if (mock) {
    localStorage.setItem(mockKey(exam), '1');
    return true;
  }
  const pkg = state.status === 'ready' ? state.pkgs[exam.productId] : undefined;
  if (!pkg) throw new Error('この商品は購入できません');
  await ensure();
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return !!accessOf(customerInfo)[exam.dir];
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

/** セットを今買えるか(ストアの売り場にセットの商品がある、または開発用の疑似購入)。無ければ購入画面にセットを出さない */
export function canBuyBundle(state: BillingState, b: Bundle): boolean {
  if (state.status !== 'ready') return false;
  return mock || !!state.pkgs[b.productId];
}

/** true=セットの試験が全部開いた / false=キャンセル。失敗は例外 */
export async function purchaseBundle(state: BillingState, b: Bundle): Promise<boolean> {
  if (mock) {
    for (const e of EXAMS) if (b.exams.includes(e.dir)) localStorage.setItem(mockKey(e), '1');
    return true;
  }
  const pkg = state.status === 'ready' ? state.pkgs[b.productId] : undefined;
  if (!pkg) throw new Error('この商品は購入できません');
  await ensure();
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const a = accessOf(customerInfo);
    return b.exams.every((d) => a[d]);
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

/** 復元。開いた試験の名前(何も無ければ空) */
export async function restore(): Promise<string[]> {
  let packs: string[] = [];
  const a = mock ? mockAccess() : await (async () => {
    if (!key) return EMPTY_ACCESS;
    await ensure();
    const { customerInfo } = await Purchases.restorePurchases();
    packs = packNamesFrom(Object.keys(customerInfo.entitlements.active));
    return accessOf(customerInfo);
  })();
  return [...EXAMS.filter((e) => a[e.dir]).map((e) => e.name), ...packs];
}

export function resetMock() {
  if (mock) for (const e of EXAMS) localStorage.removeItem(mockKey(e));
}
