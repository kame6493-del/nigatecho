import type { AppData, Question } from '../domain/types';
import { EXAM } from '../domain/exam';
import { examRange, unseen } from '../domain/study';
import { IBook, IChevron, IClip, IDoc, ILayers, IShuffle, IStar } from './Icons';

/** 問題を探す(見本の「どの方法で問題を探しますか?」)。並びと色は見本どおり */
export function Search(p: {
  all: Question[]; open: Question[]; data: AppData; premium: boolean;
  onExams: () => void; onSubjects: () => void; onUnseen: () => void; onRandom: () => void; onMarks: () => void;
  onMock: () => void; onPaywall: () => void; onMockHistory: () => void;
}) {
  const exams = [...new Set(p.all.map((q) => q.exam))].sort((a, b) => a - b);
  const fresh = unseen(p.open, p.data).length;
  const rows = [
    { key: 'exams', cls: 't-red', icon: <IBook size={34} />, title: '年度別', sub: `${examRange(exams[0], exams[exams.length - 1])}の過去問から選ぶ`, on: p.onExams },
    { key: 'subjects', cls: 't-blue', icon: <ILayers size={34} />, title: '科目別', sub: `${EXAM.subjects.length}科目から絞って解く`, on: p.onSubjects },
    { key: 'unseen', cls: 't-yellow', icon: <IDoc size={34} />, title: 'まだ解いていない問題', sub: `未回答の問題だけを集めて解く(${fresh}問)`, on: p.onUnseen, disabled: fresh === 0 },
    { key: 'random', cls: 't-green', icon: <IShuffle size={34} />, title: 'ランダム10問', sub: 'ランダムに10問。すきま時間に', on: p.onRandom },
    { key: 'marks', cls: 't-purple', icon: <IStar size={34} />, title: 'しるし', sub: `しるしを付けた問題から解く(${p.data.marks.length}問)`, on: p.onMarks, disabled: p.data.marks.length === 0 },
    { key: 'mock', cls: 't-pink', icon: <IClip size={34} />, title: '本番形式の模試', sub: p.premium ? `${EXAM.perExam}問を時間を計って解く` : '完全版で解けます', on: p.premium ? p.onMock : p.onPaywall },
  ];
  return (
    <div className="page search-page">
      <header className="tab-head"><h1>問題を探す</h1></header>
      <p className="lead center">どの方法で問題を探しますか?</p>
      <ul className="find-list">
        {rows.map((r) => (
          <li key={r.key}>
            <button className={`find-row ${r.cls}`} onClick={r.on} disabled={r.disabled} data-find={r.key}>
              <span className="find-ico">{r.icon}</span>
              <span className="find-body"><b>{r.title}</b><span>{r.sub}</span></span>
              <IChevron />
            </button>
          </li>
        ))}
      </ul>
      {p.data.mocks.length > 0 && <button className="more-link" onClick={p.onMockHistory}>模試の記録({p.data.mocks.length}回)<IChevron size={16} /></button>}
    </div>
  );
}
