import { useState } from 'react';
import type { AppData, Settings } from '../domain/types';
import { EXAM } from '../domain/exam';
import { restore, resetMock } from '../platform/billing';
import { setDailyReminder } from '../platform/native';
import { TopBar } from './Quiz';

const SITE = EXAM.site;

export function SettingsPage(p: {
  data: AppData; premium: boolean;
  onBack: () => void; onChange: (s: Partial<Settings>) => void; onReset: () => void;
  onPaywall: () => void; onRestored: () => void;
}) {
  const s = p.data.settings;
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');

  const setRemind = async (on: boolean, time = s.remindAt) => {
    const ok = await setDailyReminder(on, time, '前に間違えた問題を、今日も数問だけ。');
    if (on && !ok) { setMsg('お知らせが許可されていません。端末の設定から許可してください。'); return; }
    setMsg('');
    p.onChange({ remind: on, remindAt: time });
  };

  return (
    <div className="page settings">
      <TopBar title="設定" onClose={p.onBack} />
      <ul className="form">
        <li>
          <label htmlFor="exam-date">試験日</label>
          <input id="exam-date" type="date" value={s.examDate} onChange={(e) => p.onChange({ examDate: e.target.value })} />
        </li>
        <li>
          <span>文字の大きさ</span>
          <div className="seg">
            {[0.9, 1, 1.15, 1.3].map((v) => (
              <button key={v} className={s.fontScale === v ? 'on' : ''} onClick={() => p.onChange({ fontScale: v })}>{v === 0.9 ? '小' : v === 1 ? '中' : v === 1.15 ? '大' : '特大'}</button>
            ))}
          </div>
        </li>
        <li>
          <span>毎日のお知らせ</span>
          <div className="row-right">
            <input type="time" value={s.remindAt} disabled={!s.remind} onChange={(e) => setRemind(true, e.target.value)} />
            <button className={`toggle ${s.remind ? 'on' : ''}`} onClick={() => setRemind(!s.remind)} aria-pressed={s.remind}><i /></button>
          </div>
        </li>
      </ul>
      {msg && <p className="err">{msg}</p>}

      <ul className="form">
        <li><span>完全版</span>{p.premium ? <b>購入済み</b> : <button className="btn small" onClick={p.onPaywall}>見る</button>}</li>
        <li>
          <span>購入の復元</span>
          <button className="btn small" onClick={async () => { const ok = await restore(); setMsg(ok ? '復元しました' : '購入は見つかりませんでした'); if (ok) p.onRestored(); }}>復元</button>
        </li>
        <li><span>記録を消す</span><button className="btn small danger" onClick={() => setConfirm(true)}>消す</button></li>
        {import.meta.env.DEV && <li><span>(開発用)疑似購入を戻す</span><button className="btn small" onClick={() => { resetMock(); location.reload(); }}>戻す</button></li>}
      </ul>

      <ul className="links">
        <li><a href={`${SITE}support.html`} target="_blank" rel="noreferrer">問い合わせ・問題の誤りの報告</a></li>
        <li><a href={`${SITE}privacy.html`} target="_blank" rel="noreferrer">プライバシーポリシー</a></li>
        <li><a href={`${SITE}terms.html`} target="_blank" rel="noreferrer">利用規約</a></li>
      </ul>
      <p className="credit">{EXAM.credit}</p>
      <p className="credit">本アプリは厚生労働省とは関係のない個人の制作物です。</p>

      {confirm && (
        <div className="sheet-backdrop" onClick={() => setConfirm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>記録を消しますか</h3>
            <p>解いた記録・苦手・しるし・模試の結果がすべて消えます。元には戻せません。完全版の購入は消えません。</p>
            <div className="sheet-actions">
              <button className="btn" onClick={() => setConfirm(false)}>やめる</button>
              <button className="btn danger" onClick={() => { p.onReset(); setConfirm(false); }}>消す</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
