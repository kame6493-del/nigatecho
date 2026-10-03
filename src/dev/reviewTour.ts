/**
 * App Review 用の画面録画で流す自動操作。VITE_REVIEW_TOUR=1 で作ったビルドだけで動く(製品版には入らない)。
 * 持ち主が iPhone を持っていないので、CI のシミュレーターでこれを流しながら録画する(.github/workflows/ios-review-video.yml)。
 * 起動 → 10問解く(解説を見せる)→ ホーム(苦手・予想点)→ 苦手を解く → 年度別 → 完全版の購入画面。押した所に丸を出す。
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tapMark(el: Element) {
  const r = el.getBoundingClientRect();
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'fixed', left: `${r.left + r.width / 2 - 22}px`, top: `${r.top + r.height / 2 - 22}px`,
    width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(210,64,42,0.35)',
    border: '2px solid rgba(210,64,42,0.8)', zIndex: '99999', pointerEvents: 'none', transition: 'opacity .6s, transform .6s',
  });
  document.body.appendChild(dot);
  requestAnimationFrame(() => { dot.style.transform = 'scale(1.4)'; dot.style.opacity = '0'; });
  setTimeout(() => dot.remove(), 700);
}

async function find(pred: (b: HTMLElement) => boolean, wait = 6000): Promise<HTMLElement | null> {
  const end = Date.now() + wait;
  while (Date.now() < end) {
    const el = [...document.querySelectorAll<HTMLElement>('button, a')].find((b) => b.offsetParent !== null && !(b as HTMLButtonElement).disabled && pred(b));
    if (el) return el;
    await sleep(200);
  }
  return null;
}

async function tap(pred: (b: HTMLElement) => boolean, pause = 1800) {
  const el = await find(pred);
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await sleep(500);
  tapMark(el);
  await sleep(250);
  el.click();
  await sleep(pause);
  return true;
}

const text = (s: string) => (b: HTMLElement) => b.innerText.replace(/\s+/g, '').includes(s.replace(/\s+/g, ''));

async function scrollSlow(to: number, ms = 1600) {
  const from = window.scrollY;
  const steps = 30;
  for (let k = 1; k <= steps; k++) { window.scrollTo(0, from + ((to - from) * k) / steps); await sleep(ms / steps); }
}

/** 1問答える。2つ選ぶ問題なら2つ押して答え合わせ。答えた後に解説までゆっくり下げて見せる */
async function answerOne(choiceIndex: number) {
  const choices = [...document.querySelectorAll<HTMLElement>('ol.choices button.choice')];
  if (choices.length === 0) return false;
  const target = choices[Math.min(choiceIndex, choices.length - 1)];
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await sleep(700);
  tapMark(target); target.click();
  await sleep(900);
  // 2つ選ぶ問題は1つ目を押すと「2つ選んでください(あと1つ)」が出る → もう1つ選んでから答え合わせ
  const needMore = [...document.querySelectorAll<HTMLElement>('button')].some((b) => b.innerText.includes('つ選んでください'));
  if (needMore) {
    const other = choices[(choiceIndex + 1) % choices.length];
    tapMark(other); other.click(); await sleep(700);
    await tap(text('答え合わせ'), 900);
  }
  await scrollSlow(document.body.scrollHeight, 2200);
  await sleep(2200);
  return true;
}

export async function runReviewTour() {
  await sleep(3500); // ホーム(初回)を見せる
  if (!(await tap(text('まず10問解いてみる'), 2000))) await tap(text('ランダム10問'), 2000);
  for (const k of [1, 0, 3]) {
    await answerOne(k);
    if (!(await tap(text('次の問題'), 1800))) break;
  }
  await answerOne(2);
  // ホームへ戻る(閉じるボタン)
  await tap((b) => b.getAttribute('aria-label') === '閉じる', 2500);
  await scrollSlow(600, 2000); await sleep(1500); await scrollSlow(0, 1200); await sleep(1000);
  // 間違えた問題が苦手として残っている → 苦手を解く
  if (await tap(text('苦手を解く'), 2000)) {
    await answerOne(0);
    await tap((b) => b.getAttribute('aria-label') === '閉じる', 2500);
  }
  // 年度別 → 鍵の付いた回 → 完全版の購入画面
  await tap(text('年度別'), 2500);
  await scrollSlow(500, 1500); await sleep(1200);
  if (!(await tap(text('完全版で解く'), 3500))) {
    await tap((b) => b.getAttribute('aria-label') === '閉じる', 1500);
    await tap(text('完全版で、あと'), 3500);
  }
  await scrollSlow(document.body.scrollHeight, 2500);
  await sleep(2500);
  // 購入ボタン(シミュレーターでストアの商品が取れたときだけ押せる)
  await tap((b) => b.classList.contains('primary') && /買う|購入|¥|円|\$/.test(b.innerText), 10000);
  await sleep(6000);
}
