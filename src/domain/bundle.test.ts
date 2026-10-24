/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUNDLES, EXAMS, SINGLE, bundleOf, bundleOffer } from './exam';

const { accessFrom } = await import('../platform/billing');

// まとめ版だけにセットがある(単体のアプリには無い)
const multi = !SINGLE && EXAMS.some((e) => e.dir === 'kaigo') && EXAMS.some((e) => e.dir === 'nurse');

describe('3つセット(介護福祉士・社会福祉士・精神保健福祉士)', () => {
  it.runIf(multi)('商品ID・中身の試験は決めたとおり。単品の商品IDと重ならない', () => {
    expect(BUNDLES.length).toBe(1);
    const b = BUNDLES[0];
    expect(b.productId).toBe('nigatecho_multi_fukushi_set');
    expect(b.exams).toEqual(['kaigo', 'shakai', 'seishin']);
    expect(EXAMS.map((e) => e.productId)).not.toContain(b.productId);
    // 元の設定(exams/multi.json)と生成物が同じ
    const src = JSON.parse(readFileSync('exams/multi.json', 'utf8'));
    expect(src.bundles[0].productId).toBe(b.productId);
  });

  it.runIf(multi)('介護・社会・精神を選んでいて、どれも持っていない人にだけ出す', () => {
    const none = accessFrom([]);
    for (const d of ['kaigo', 'shakai', 'seishin']) expect(bundleOffer(d, none)?.id).toBe('fukushi');
    for (const d of ['kanri', 'pt', 'nurse']) {
      expect(bundleOf(d)).toBeUndefined();
      expect(bundleOffer(d, none)).toBeUndefined();
    }
  });

  it.runIf(multi)('3つのどれか1つでも持っていたら、どの試験の画面でもセットを出さない(二重に払わせない)', () => {
    for (const ent of ['kaigo_full', 'shakai_full', 'seishin_full']) {
      const a = accessFrom([ent]);
      for (const d of ['kaigo', 'shakai', 'seishin']) expect(bundleOffer(d, a)).toBeUndefined();
    }
    // セットと関係のない試験(看護師)を持っていても出す
    expect(bundleOffer('kaigo', accessFrom(['nurse_full']))?.id).toBe('fukushi');
  });

  it.runIf(multi)('セットの3つの entitlement が付けば、3試験とも開き、ほかの試験は開かない', () => {
    const a = accessFrom(['kaigo_full', 'shakai_full', 'seishin_full']);
    expect([a.kaigo, a.shakai, a.seishin]).toEqual([true, true, true]);
    expect([a.kanri, a.pt, a.nurse]).toEqual([false, false, false]);
  });

  it.runIf(!multi)('単体のアプリにはセットが無い', () => {
    expect(BUNDLES).toEqual([]);
    for (const e of EXAMS) expect(bundleOffer(e.dir, {})).toBeUndefined();
  });
});
