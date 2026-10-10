import { EXAM, EXAMS } from '../domain/exam';
import { examRange } from '../domain/study';
import type { BillingState } from '../platform/billing';
import { lookOf } from './look';
import { TopBar } from './parts';
import { ICheck } from './Icons';

/** ストアの写真を撮るとき(開発サーバーの ?shot=1)は、値段と「無料」の行を出さない(App Store 2.3.7) */
const SHOT = import.meta.env.DEV && new URLSearchParams(location.search).get('shot') === '1';

/** 試験を切り替える。記録と完全版は試験ごと(切り替えても、ほかの試験の記録は混ざらない) */
export function ExamSwitch(p: { billing: BillingState; onPick: (dir: string) => void; onBack: () => void }) {
  return (
    <div className="page switch-page">
      <TopBar title="試験を切り替える" onClose={p.onBack} close="x" />
      <p className="lead">{EXAMS.length}つの国家試験から選べます。解いた記録・苦手・模試の結果は試験ごとに分けて残ります。{SHOT ? '' : 'どの試験も、いちばん新しい回は無料で解けます。'}</p>
      <ul className="ex-list">
        {EXAMS.map((e) => {
          const rounds = e.rounds ?? [];
          const owned = !!p.billing.access[e.dir];
          const price = p.billing.status === 'ready' ? p.billing.prices[e.productId] ?? e.price : e.price;
          const on = e.dir === EXAM.dir;
          const look = lookOf(e.dir);
          return (
            <li key={e.dir}>
              <button className={`ex-item ${on ? 'on' : ''}`} style={{ background: look.tint, ['--ex-ink' as string]: look.ink }} onClick={() => p.onPick(e.dir)} aria-current={on ? 'true' : undefined} data-exam={e.dir}>
                <img className="ex-art" src={look.img} alt="" />
                <span className="ex-body">
                  <b>{e.name}</b>
                  <span className="ex-catch">{look.catch}</span>
                  <span className="ex-meta">{rounds.length ? `${examRange(rounds[0], rounds[rounds.length - 1])}・${e.count ?? ''}問・全問解説つき` : ''}</span>
                  {!SHOT && <span className="ex-meta">無料: 第{e.freeExams.join('・')}回</span>}
                  {owned
                    ? <span className="ex-state owned">完全版 購入済み</span>
                    : !SHOT && <span className="ex-state">完全版 {price}(買い切り)</span>}
                </span>
                <span className={`ex-radio ${on ? 'on' : ''}`} aria-hidden>{on && <ICheck size={16} />}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small">完全版は試験ごとの買い切りです。ある試験の完全版を買っても、ほかの試験は開きません。</p>
    </div>
  );
}
