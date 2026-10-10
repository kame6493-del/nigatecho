import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { splitExplanation } from './explain';
import type { Question } from './types';

describe('解説を段に分ける', () => {
  it('正答の理由と選択肢ごとの理由', () => {
    const p = splitExplanation('正答 2: 理由です。\n1 × 一つ目。\n3 × 三つ目。\n※現在は改められている。');
    expect(p.parsed).toBe(true);
    expect(p.head).toBe('正答 2');
    expect(p.reason).toBe('理由です。');
    expect(p.choices.map((c) => c.no)).toEqual([1, 3]);
    // 番号で始まらない行は直前の段の続き
    expect(p.choices[1].text).toBe('三つ目。\n※現在は改められている。');
  });

  it('2つ選ぶ問題の「正答 3・4」', () => {
    const p = splitExplanation('正答 3・4: 理由。\n1 × a\n2 × b\n5 × c');
    expect(p.head).toBe('正答 3・4');
    expect(p.choices).toHaveLength(3);
  });

  it('選択肢の行の前の続きの行は理由に入る', () => {
    const p = splitExplanation('正答 1: 一行目。\n二行目。\n2 × x');
    expect(p.reason).toBe('一行目。\n二行目。');
  });

  it('形が違う解説はそのまま', () => {
    const p = splitExplanation('自由な解説の文。');
    expect(p.parsed).toBe(false);
    expect(p.reason).toBe('自由な解説の文。');
    expect(splitExplanation(undefined).parsed).toBe(false);
  });

  it('全試験の全問で、分けた後の文をつなぐと元の解説と同じ文字になる(文を落とさない)', () => {
    let n = 0;
    for (const dir of ['kanri', 'pt', 'kaigo', 'shakai', 'seishin']) {
      const f = `exams/${dir}/data/questions.json`;
      if (!existsSync(f)) continue;
      const qs: Question[] = JSON.parse(readFileSync(f, 'utf8'));
      for (const q of qs) {
        const p = splitExplanation(q.explanation);
        const squash = (s: string) => s.replace(/\s+/g, '');
        const joined = p.parsed ? `${p.head}:${p.reason}${p.choices.map((c) => `${c.no}${c.mark}${c.text}`).join('')}` : p.reason;
        expect(squash(joined).replace('：', ':')).toBe(squash(q.explanation ?? '').replace('：', ':').replace(/✕/g, '×'));
        n++;
      }
    }
    expect(n).toBeGreaterThan(3000);
  });
});
