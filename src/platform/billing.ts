import { Capacitor } from '@capacitor/core';
import { Purchases, type CustomerInfo, type PurchasesPackage } from '@revenuecat/purchases-capacitor';

import { APP, EXAMS } from '../domain/exam';
import type { ExamConfig } from '../domain/types';

/**
 * RevenueCat の公開APIキー(秘密鍵ではない)。アプリは1本(公開中の管理栄養士のアプリ)なので、キーもその1組。
 * 空のままなら購入ボタンは「購入の準備中です」になり、課金は一切走らない。
 *
 * 商品は試験ごとの買い切り(非消耗型)。どの商品も、その試験の完全版だけを開く。
 * - 管理栄養士 nigatecho_kanri_full → entitlement "full"(公開中の商品のまま。買った人はそのまま使える)
 * - 理学療法士 nigatecho_multi_pt_full → "pt_full" / 介護福祉士 …_kaigo_full → "kaigo_full" / 社会福祉士 …_shakai_full → "shakai_full"
 * - 精神保健福祉士 nigatecho_multi_seishin_full → "seishin_full"(v1.2。社会福祉士の完全版とは別の商品)
 * RevenueCat の売り場(current offering)に全部のパッケージを並べ、どの試験の物かは商品IDで見分ける。
 */
const API_KEYS = { ios: APP.revenuecat?.ios ?? '', android: APP.revenuecat?.android ?? '' };

export const entitlementOf = (e: ExamConfig) => e.entitlement ?? 'full';

/** 試験ごとに完全版を持っているか。キーは exams の dir */
export type Access = Record<string, boolean>;

export type BillingState =
  | { status: 'unavailable'; reason: string; access: Access }
  | { status: 'ready'; access: Access; prices: Record<string, string>; pkgs: Record<string, PurchasesPackage> };

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

let configured = false;
async function ensure() {
  if (configured) return;
  await Purchases.configure({ apiKey: key });
  configured = true;
}

export async function loadBilling(): Promise<BillingState> {
  if (mock) {
    const prices: Record<string, string> = {};
    for (const e of EXAMS) prices[e.productId] = e.price;
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
    return { status: 'ready', access: accessOf(customerInfo), prices, pkgs };
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

/** 復元。開いた試験の名前(何も無ければ空) */
export async function restore(): Promise<string[]> {
  const a = mock ? mockAccess() : await (async () => {
    if (!key) return EMPTY_ACCESS;
    await ensure();
    const { customerInfo } = await Purchases.restorePurchases();
    return accessOf(customerInfo);
  })();
  return EXAMS.filter((e) => a[e.dir]).map((e) => e.name);
}

export function resetMock() {
  if (mock) for (const e of EXAMS) localStorage.removeItem(mockKey(e));
}
