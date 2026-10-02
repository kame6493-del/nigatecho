import type { AppData } from '../domain/types';
import { EXAM } from '../domain/exam';
import { TopBar } from './Quiz';

export function MockHistory({ data, onBack }: { data: AppData; onBack: () => void }) {
  const list = data.mocks.slice().reverse();
  return (
    <div className="page">
      <TopBar title="模試の記録" onClose={onBack} />
      <ul className="rows">
        {list.map((m) => {
          const pass = Math.ceil(m.total * EXAM.passRatio);
          const d = new Date(m.at);
          return (
            <li key={m.at} className="exam-row">
              <div className="exam-head">
                <b>{m.exam ? `第${m.exam}回` : '混合'}</b>
                <span className="muted">{d.getMonth() + 1}月{d.getDate()}日</span>
              </div>
              <p className={`mock-score ${m.score >= pass ? 'good' : 'bad'}`}>{m.score}<small> / {m.total}点(合格基準 {pass})</small></p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
