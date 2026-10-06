import { EXAM, EXAMS } from '../domain/exam';
import { examRange } from '../domain/study';
import type { BillingState } from '../platform/billing';
import { TopBar } from './Quiz';

/** 試験を切り替える。記録と完全版は試験ごと(切り替えても、ほかの試験の記録は混ざらない) */
export function ExamSwitch(p: { billing: BillingState; onPick: (dir: string) => void; onBack: () => void }) {
  return (
    <div className="page">
      <TopBar title="試験を切り替える" onClose={p.onBack} />
      <p className="lead">解いた記録・苦手・模試の結果は試験ごとに分けて残ります。どの試験も、いちばん新しい回は無料で解けます。</p>
      <ul className="ex-list">
        {EXAMS.map((e) => {
          const rounds = e.rounds ?? [];
          const owned = !!p.billing.access[e.dir];
          const price = p.billing.status === 'ready' ? p.billing.prices[e.productId] ?? e.price : e.price;
          const on = e.dir === EXAM.dir;
          return (
            <li key={e.dir}>
              <button className={`ex-item ${on ? 'on' : ''}`} onClick={() => p.onPick(e.dir)} aria-current={on ? 'true' : undefined} data-exam={e.dir}>
                <b>{e.name}{on ? '(いま選んでいる試験)' : ''}</b>
                <span className="ex-meta">{rounds.length ? `${examRange(rounds[0], rounds[rounds.length - 1])}・${e.count ?? ''}問・全問解説つき` : ''}</span>
                <span className="ex-meta">無料: 第{e.freeExams.join('・')}回</span>
                <span className={`ex-state ${owned ? 'owned' : ''}`}>{owned ? '完全版 購入済み' : `完全版 ${price}(買い切り)`}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small">完全版は試験ごとの買い切りです。ある試験の完全版を買っても、ほかの試験は開きません。</p>
    </div>
  );
}
