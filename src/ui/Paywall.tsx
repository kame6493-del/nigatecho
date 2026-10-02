import { useState } from 'react';
import type { Question } from '../domain/types';
import { EXAM } from '../domain/exam';
import { purchase, restore, type BillingState } from '../platform/billing';
import { TopBar } from './Quiz';

export function Paywall(p: {
  billing: BillingState; all: Question[];
  onClose: () => void; onBought: () => void; setBilling: (b: BillingState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const exams = [...new Set(p.all.map((q) => q.exam))].sort((a, b) => a - b);
  const free = p.all.filter((q) => EXAM.freeExams.includes(q.exam)).length;
  const price = p.billing.status === 'ready' ? p.billing.price ?? '' : '';

  const buy = async () => {
    setBusy(true); setMsg('');
    try {
      if (await purchase(p.billing)) p.onBought();
    } catch (e) {
      setMsg(`購入できませんでした(${(e as Error).message ?? e})`);
    } finally { setBusy(false); }
  };
  const doRestore = async () => {
    setBusy(true); setMsg('');
    try {
      if (await restore()) p.onBought();
      else setMsg('このアカウントでの購入は見つかりませんでした');
    } catch (e) {
      setMsg(`復元できませんでした(${(e as Error).message ?? e})`);
    } finally { setBusy(false); }
  };

  return (
    <div className="page paywall">
      <TopBar title="完全版" onClose={p.onClose} />
      <section className="pw-hero">
        <p className="pw-kicker">買い切り・月額なし</p>
        <h2>{exams.length}年分 {p.all.length}問で、<br />苦手を本番までに0へ。</h2>
      </section>
      <table className="pw-table">
        <thead><tr><th></th><th>無料</th><th>完全版</th></tr></thead>
        <tbody>
          <tr><td>過去問</td><td>第{EXAM.freeExams.join('・')}回 {free}問</td><td>第{exams[0]}〜{exams[exams.length - 1]}回 {p.all.length}問</td></tr>
          <tr><td>全問の解説</td><td>○</td><td>○</td></tr>
          <tr><td>苦手の自動復習</td><td>○</td><td>○</td></tr>
          <tr><td>科目別の正答率・予想点</td><td>○</td><td>○</td></tr>
          <tr><td>本番形式の模試</td><td>—</td><td>○ {exams.length}回分</td></tr>
          <tr><td>広告</td><td>なし</td><td>なし</td></tr>
        </tbody>
      </table>
      <div className="pw-cta">
        {p.billing.status === 'ready' ? (
          <button className="btn primary wide big" disabled={busy || !p.billing.pkg && !import.meta.env.DEV} onClick={buy}>
            {busy ? '処理中…' : `${price || '完全版'} で買う(1回だけ)`}
          </button>
        ) : (
          <button className="btn wide big" disabled>{p.billing.reason}</button>
        )}
        <button className="link" disabled={busy} onClick={doRestore}>以前に買った方はこちら(購入の復元)</button>
        {msg && <p className="err">{msg}</p>}
      </div>
      <p className="muted small">一度買えば、同じストアのアカウントの機種変更後も「購入の復元」で使えます。記録はこの端末の中だけに保存し、外へ送りません。</p>
    </div>
  );
}
