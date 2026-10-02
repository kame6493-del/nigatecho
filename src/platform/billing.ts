import { Capacitor } from '@capacitor/core';
import { Purchases, type PurchasesPackage } from '@revenuecat/purchases-capacitor';

import { EXAM } from '../domain/exam';

/**
 * RevenueCat の公開APIキー(秘密鍵ではない)。試験ごとに exams/<試験>/exam.json の revenuecat に入っている。
 * 空のままなら購入ボタンは「準備中」になり、課金は一切走らない(Android はまだ空)。
 * 商品は買い切り(非消耗型)1つだけ。entitlement は "full"(プロジェクト Nigatecho で全試験共通)。
 */
const API_KEYS = { ios: EXAM.revenuecat?.ios ?? '', android: EXAM.revenuecat?.android ?? '' };
export const ENTITLEMENT = EXAM.entitlement ?? 'full';

export type BillingState =
  | { status: 'unavailable'; reason: string }
  | { status: 'ready'; premium: boolean; price: string | null; pkg?: PurchasesPackage };

const platform = Capacitor.getPlatform();
const key = platform === 'ios' ? API_KEYS.ios : platform === 'android' ? API_KEYS.android : '';
/** ブラウザで開発しているときだけ、画面確認用の疑似購入を使う */
const mock = !Capacitor.isNativePlatform() && import.meta.env.DEV;
const MOCK_KEY = 'nigatecho.mockFull';

let configured = false;
async function ensure() {
  if (configured) return;
  await Purchases.configure({ apiKey: key });
  configured = true;
}

export async function loadBilling(): Promise<BillingState> {
  if (mock) return { status: 'ready', premium: localStorage.getItem(MOCK_KEY) === '1', price: '¥980' };
  if (!key) return { status: 'unavailable', reason: '購入の準備中です' };
  try {
    await ensure();
    const [{ customerInfo }, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
    const pkg = offerings.current?.availablePackages[0];
    return { status: 'ready', premium: ENTITLEMENT in customerInfo.entitlements.active, price: pkg?.product.priceString ?? null, pkg };
  } catch (e) {
    console.error('[nigatecho] billing', e);
    return { status: 'unavailable', reason: 'ストアに接続できませんでした' };
  }
}

/** true=有効になった / false=キャンセル。失敗は例外 */
export async function purchase(state: BillingState): Promise<boolean> {
  if (mock) {
    localStorage.setItem(MOCK_KEY, '1');
    return true;
  }
  if (state.status !== 'ready' || !state.pkg) throw new Error('この商品は購入できません');
  await ensure();
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: state.pkg });
    return ENTITLEMENT in customerInfo.entitlements.active;
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

export async function restore(): Promise<boolean> {
  if (mock) return localStorage.getItem(MOCK_KEY) === '1';
  if (!key) return false;
  await ensure();
  const { customerInfo } = await Purchases.restorePurchases();
  return ENTITLEMENT in customerInfo.entitlements.active;
}

export function resetMock() {
  if (mock) localStorage.removeItem(MOCK_KEY);
}
