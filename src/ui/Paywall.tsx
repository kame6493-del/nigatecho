import { useState } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, SINGLE, short } from '../domain/exam';
import { examRange, isLocked } from '../domain/study';
import { weakSubjectGrowth } from '../domain/upsell';
import { canBuy, purchase, restore, type BillingState } from '../platform/billing';
import { TopBar } from './parts';
import { lookOf } from './look';
import { ICheck } from './Icons';

/** いま選んでいる試験の完全版。商品は試験ごとに別(買った試験だけが開く) */
export function Paywall(p: {
  billing: BillingState; all: Question[];
  /** 本人の記録(増える分を、本人の苦手の科目で具体的に見せる)。無ければ出さない */
  data?: AppData;
  onClose: () => void; onBought: () => void; setBilling: (b: BillingState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const exams = [...new Set(p.all.map((q) => q.exam))].sort((a, b) => a - b);
  const free = p.all.filter((q) => EXAM.freeExams.includes(q.exam)).length;
  const price = p.billing.status === 'ready' ? p.billing.prices[EXAM.productId] ?? '' : '';
  const owned = !!p.billing.access[EXAM.dir];
  const freeRounds = EXAM.freeExams.filter((e) => exams.includes(e));
  const lockedRounds = exams.filter((e) => !freeRounds.includes(e));
  /** 本人の記録から: 苦手の多い科目の問題が、いま何問で完全版で何問になるか(実際の問題数だけ) */
  const growth = !owned && p.data
    ? weakSubjectGrowth(p.all, p.all.filter((q) => !isLocked(q, false, EXAM)), p.data)
    : null;

  const buy = async () => {
    setBusy(true); setMsg('');
    try {
      if (await purchase(p.billing, EXAM)) p.onBought();
    } catch (e) {
      setMsg(`購入できませんでした(${(e as Error).message ?? e})`);
    } finally { setBusy(false); }
  };
  const doRestore = async () => {
    setBusy(true); setMsg('');
    try {
      const names = await restore();
      if (names.length) p.onBought();
      else setMsg('このアカウントでの購入は見つかりませんでした');
    } catch (e) {
      setMsg(`復元できませんでした(${(e as Error).message ?? e})`);
    } finally { setBusy(false); }
  };

  return (
    <div className="page paywall">
      <TopBar title={`${EXAM.name} 完全版`} onClose={p.onClose} close="x" />
      <section className="pw-hero" style={{ background: lookOf(EXAM.dir).tint }}>
        <img className="pw-art" src={lookOf(EXAM.dir).img} alt="" />
        <p className="pw-kicker">{EXAM.name}・買い切り・月額なし</p>
        <h2>{exams.length}年分 {p.all.length}問で、<br />苦手を本番までに0へ。</h2>
        <ul className="checks">
          <li><ICheck size={16} />{lockedRounds.length ? `${examRange(lockedRounds[0], lockedRounds[lockedRounds.length - 1])}の過去問 ${p.all.length - free}問が増える` : `${examRange(exams[0], exams[exams.length - 1])}の過去問すべて`}</li>
          <li><ICheck size={16} />本番形式の模試が{exams.length}回分に</li>
          <li><ICheck size={16} />増えた分も解説・苦手ノート・予想点に入る</li>
        </ul>
      </section>
      {growth && (
        <section className="card pw-mine" data-upsell="paywall-mine">
          <p className="pw-mine-title">あなたの記録では</p>
          <p className="pw-mine-row"><span>{growth.nigate > 0 ? '苦手の多い' : '正答率の低い'} {short(growth.subject)}</span><b>いま {growth.now}問 → 完全版で {growth.full}問</b></p>
          <p className="pw-mine-row"><span>本番形式の模試</span><b>いま {freeRounds.length}回分 → 完全版で {exams.length}回分</b></p>
        </section>
      )}
      <table className="pw-table">
        <thead><tr><th></th><th>無料</th><th>完全版</th></tr></thead>
        <tbody>
          <tr><td>過去問</td><td>第{freeRounds.join('・')}回 {free}問</td><td>{examRange(exams[0], exams[exams.length - 1])} {p.all.length}問</td></tr>
          <tr><td>本番形式の模試</td><td>{freeRounds.length}回分<br /><small>(第{freeRounds.join("・")}回)</small></td><td>{exams.length}回分</td></tr>
          <tr><td>解説・苦手の自動復習・予想点・広告なし</td><td colSpan={2} className="pw-both">どちらも同じ</td></tr>
        </tbody>
      </table>
      <div className="pw-cta">
        {owned ? (
          <p className="pw-owned">{EXAM.name}の完全版は購入済みです</p>
        ) : p.billing.status === 'ready' ? (
          <button className="btn primary wide big" disabled={busy || !canBuy(p.billing, EXAM)} onClick={buy}>
            {busy ? '処理中…' : `${price || '完全版'} で買う(1回だけ)`}
          </button>
        ) : (
          <button className="btn wide big" disabled>{p.billing.reason}</button>
        )}
        <button className="link" disabled={busy} onClick={doRestore}>以前に買った方はこちら(購入の復元)</button>
        {msg && <p className="err">{msg}</p>}
      </div>
      {EXAM.paywallNote && <p className="muted small">{EXAM.paywallNote}</p>}
      {!SINGLE && <p className="muted small">この完全版で開くのは{EXAM.name}の問題だけです。ほかの試験の完全版は、それぞれの試験の画面から別に購入できます。</p>}
      <p className="muted small">一度買えば、同じストアのアカウントの機種変更後も「購入の復元」で使えます。記録はこの端末の中だけに保存し、外へ送りません。</p>
    </div>
  );
}
