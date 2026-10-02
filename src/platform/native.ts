import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { InAppReview } from '@capacitor-community/in-app-review';
import { LocalNotifications } from '@capacitor/local-notifications';

const native = Capacitor.isNativePlatform();

export function buzz(ok: boolean) {
  if (!native) return;
  (ok ? Haptics.impact({ style: ImpactStyle.Light }) : Haptics.notification({ type: NotificationType.Warning })).catch(() => {});
}

/** ストアの評価の画面(OS が出す物。出すかどうかも OS が決める) */
export async function askReview() {
  if (!native) return;
  try { await InAppReview.requestReview(); } catch { /* 出なくても困らない */ }
}

const REMIND_ID = 4100;

/** 毎日決まった時刻のお知らせ。on=false なら取り消す。許可されなかったら false */
export async function setDailyReminder(on: boolean, time: string, body: string): Promise<boolean> {
  if (!native) return true;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMIND_ID }] });
    if (!on) return true;
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    const [hour, minute] = time.split(':').map(Number);
    await LocalNotifications.schedule({
      notifications: [{
        id: REMIND_ID,
        title: '今日の苦手、片づけましょう',
        body,
        schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
      }],
    });
    return true;
  } catch (e) {
    console.error('[nigatecho] reminder', e);
    return false;
  }
}
