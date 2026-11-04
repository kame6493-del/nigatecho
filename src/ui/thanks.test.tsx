import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { THANKS_TEXT } from '../domain/thanks';
import { ThanksNote } from './Thanks';

/** 評価をせかす・星の数を指定する言葉(App Store 5.6.1・評価の操作に当たる物) */
const RATING_WORDS = /★|☆|星|レビュー|評価|5つ星|５|満点|review|rate|star/i;

describe('結果の画面のお礼の一言(1.4.7)', () => {
  it('文はお礼だけ', () => {
    expect(THANKS_TEXT).toBe('いつも使っていただき、ありがとうございます');
  });

  it('星・レビュー・評価の言葉が入っていない', () => {
    expect(THANKS_TEXT).not.toMatch(RATING_WORDS);
    const html = renderToStaticMarkup(<ThanksNote />);
    expect(html.replace(/class="[^"]*"/g, '')).not.toMatch(RATING_WORDS);
  });

  it('ただの文で、押せない・何も開かない(ボタン・リンクにしない)', () => {
    const html = renderToStaticMarkup(<ThanksNote />);
    expect(html).toBe(`<p class="thanks-note">${THANKS_TEXT}</p>`);
    expect(html).not.toMatch(/<button|<a[\s>]|href|onclick|role=/i);
  });

  it('練習の結果と模試の結果の2つの画面の、いちばん下に出す', () => {
    const src = readFileSync('src/ui/Quiz.tsx', 'utf8').replace(/\r\n/g, '\n');
    expect(src.match(/<ThanksNote \/>/g)?.length).toBe(2);
    // どちらも「ホームへ戻る」の並びの直後(結果の画面の最後)。ボタンの中には置かない
    const after = /ホームへ戻る<\/button>\n\s*<\/div>\n\s*<ThanksNote \/>\n\s*<\/div>/g;
    expect(src.match(after)?.length).toBe(2);
  });

  it('お礼の一言は評価の窓の条件と結びつけない(お礼のファイルは review を読まない)', () => {
    const ui = readFileSync('src/ui/Thanks.tsx', 'utf8');
    const domain = readFileSync('src/domain/thanks.ts', 'utf8');
    expect(ui).not.toMatch(/review|InAppReview|askReview/);
    expect(domain).not.toMatch(/^import/m);
  });
});

describe('自前の評価のお願いを作っていない(5.6.1)', () => {
  it('アプリの画面の文に「★5」「星5」「レビューで」「評価をお願い」が無い', () => {
    const files = ['src/App.tsx', ...['Quiz', 'Home', 'NoteBook', 'Paywall', 'Stats', 'SettingsPage', 'parts', 'Thanks'].map((n) => `src/ui/${n}.tsx`)];
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/★\s*5|☆|星\s*5|星5つ|5つ星|レビューで|レビューをお願い|評価をお願いします|高評価/);
    }
  });

  it('評価の窓を呼ぶのは OS の物(in-app-review)の1か所だけ', () => {
    const native = readFileSync('src/platform/native.ts', 'utf8');
    expect(native.match(/InAppReview\.requestReview\(\)/g)?.length).toBe(1);
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app.match(/askReview\(\)/g)?.length).toBe(1);
  });
});
