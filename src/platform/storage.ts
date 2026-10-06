import { Preferences } from '@capacitor/preferences';
import type { AppData } from '../domain/types';
import { emptyData, normalize } from '../domain/data';
import { EXAM } from '../domain/exam';
import { EMPTY_REVIEW, normalizeReview, type ReviewState } from '../domain/review';

/**
 * 記録の保存先は試験ごと。nigatecho.<試験の key>.v1(管理栄養士は nigatecho.kanri-eiyoushi.v1)。
 * 試験を選べるようにする前の版と同じ名前なので、管理栄養士の記録はそのまま読める。
 */
export const keyOf = (examKey: string) => `nigatecho.${examKey}.v1`;
const KEY = () => keyOf(EXAM.key);
const BACKUP_KEY = () => `${KEY()}.prev`;

/** 最後に選んだ試験(exams の dir)。無ければ管理栄養士 */
export const EXAM_CHOICE_KEY = 'nigatecho.exam';

export async function loadExamChoice(): Promise<string | null> {
  try {
    return (await Preferences.get({ key: EXAM_CHOICE_KEY })).value;
  } catch {
    return null;
  }
}

export async function saveExamChoice(dir: string): Promise<void> {
  await Preferences.set({ key: EXAM_CHOICE_KEY, value: dir });
}

/**
 * 端末内に保存する。アカウントもサーバーも使わない。
 * Preferences はネイティブでは UserDefaults / SharedPreferences に書く(WebView の localStorage は OS に消されることがある)。
 */
export async function loadData(): Promise<AppData> {
  const key = KEY();
  const { value } = await Preferences.get({ key });
  if (!value) return emptyData();
  try {
    return normalize(JSON.parse(value));
  } catch {
    const prev = await Preferences.get({ key: `${key}.prev` });
    try {
      return prev.value ? normalize(JSON.parse(prev.value)) : emptyData();
    } catch {
      return emptyData();
    }
  }
}

let chain: Promise<void> = Promise.resolve();

/** 書き込みは順番に1本ずつ。前回の保存を控えに残してから上書きする。保存先は呼んだときの試験で決める */
export function saveData(data: AppData): Promise<void> {
  const json = JSON.stringify(data);
  const key = KEY();
  const backup = BACKUP_KEY();
  chain = chain.then(async () => {
    const cur = await Preferences.get({ key });
    if (cur.value) await Preferences.set({ key: backup, value: cur.value });
    await Preferences.set({ key, value: json });
  }).catch((e) => console.error('[nigatecho] save failed', e));
  return chain;
}

export async function clearData(): Promise<void> {
  await Preferences.remove({ key: KEY() });
  await Preferences.remove({ key: BACKUP_KEY() });
}

/** 評価のお願いの記録。試験をまたいで端末に1つ */
const REVIEW_KEY = 'nigatecho.review';

export async function loadReview(): Promise<ReviewState> {
  try {
    const { value } = await Preferences.get({ key: REVIEW_KEY });
    return value ? normalizeReview(JSON.parse(value)) : EMPTY_REVIEW;
  } catch {
    return EMPTY_REVIEW;
  }
}

export async function saveReview(s: ReviewState): Promise<void> {
  await Preferences.set({ key: REVIEW_KEY, value: JSON.stringify(s) });
}
