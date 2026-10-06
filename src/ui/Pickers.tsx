import { useMemo } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, short, yearOf } from '../domain/exam';
import { isLocked, isNigate } from '../domain/study';
import { TopBar } from './Quiz';

const byNo = (a: Question, b: Question) => (a.session === b.session ? a.no - b.no : a.session === '午前' ? -1 : 1);

export function ExamPicker(p: {
  all: Question[]; data: AppData; premium: boolean; mock: boolean;
  onBack: () => void; onLocked: () => void;
  onStart: (title: string, qs: Question[], exam: number) => void;
}) {
  const exams = useMemo(() => [...new Set(p.all.map((q) => q.exam))].sort((a, b) => b - a), [p.all]);
  return (
    <div className="page">
      <TopBar title={p.mock ? '本番形式の模試' : '年度別'} onClose={p.onBack} />
      {p.mock && <p className="lead">本番と同じ{EXAM.perExam}問を、答え合わせなしで最後まで解きます。時間を計り、最後に科目ごとの点数を出します。</p>}
      <ul className="rows">
        {exams.map((exam) => {
          const qs = p.all.filter((q) => q.exam === exam).sort(byNo);
          const locked = isLocked(qs[0], p.premium, EXAM);
          const seen = qs.filter((q) => p.data.records[q.id]).length;
          const ng = qs.filter((q) => isNigate(p.data.records[q.id])).length;
          const last = p.data.mocks.filter((m) => m.exam === exam).at(-1);
          return (
            <li key={exam} className="exam-row">
              <div className="exam-head">
                <b>第{exam}回</b>
                <span className="muted">{yearOf(exam)}年{locked ? '・完全版' : ''}</span>
              </div>
              {!p.mock && <p className="exam-meta">{seen}/{qs.length}問 解いた{ng ? `・苦手${ng}` : ''}</p>}
              {p.mock && last && <p className="exam-meta">前回 {last.score}/{last.total}点</p>}
              <div className="exam-actions">
                {locked ? (
                  <button className="btn small" onClick={p.onLocked}>完全版で解く</button>
                ) : p.mock ? (
                  <button className="btn small primary" onClick={() => p.onStart(`第${exam}回 模試`, qs, exam)}>始める</button>
                ) : (
                  <>
                    <button className="btn small" onClick={() => p.onStart(`第${exam}回 ${EXAM.sessionNames?.午前 ?? '午前'}`, qs.filter((q) => q.session === '午前'), exam)}>{EXAM.sessionNames?.午前 ?? '午前'}</button>
                    <button className="btn small" onClick={() => p.onStart(`第${exam}回 ${EXAM.sessionNames?.午後 ?? '午後'}`, qs.filter((q) => q.session === '午後'), exam)}>{EXAM.sessionNames?.午後 ?? '午後'}</button>
                    {seen > 0 && seen < qs.length && (
                      <button className="btn small primary" onClick={() => p.onStart(`第${exam}回 続き`, qs.filter((q) => !p.data.records[q.id] && !q.excluded), exam)}>続きから</button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SubjectPicker(p: {
  open: Question[]; all: Question[]; data: AppData; premium: boolean;
  onBack: () => void; onPaywall: () => void;
  onStart: (title: string, qs: Question[]) => void;
}) {
  return (
    <div className="page">
      <TopBar title="科目別" onClose={p.onBack} />
      <ul className="rows">
        {EXAM.subjects.map((s) => {
          const mine = p.open.filter((q) => q.subject === s && !q.excluded);
          const total = p.all.filter((q) => q.subject === s && !q.excluded).length;
          const ng = mine.filter((q) => isNigate(p.data.records[q.id]));
          const fresh = mine.filter((q) => !p.data.records[q.id]);
          return (
            <li key={s} className="exam-row">
              <div className="exam-head"><b>{short(s)}</b><span className="muted">{mine.length}問{!p.premium && total > mine.length ? `(完全版 ${total}問)` : ''}</span></div>
              <p className="exam-meta">{s}</p>
              <div className="exam-actions">
                <button className="btn small" disabled={!mine.length} onClick={() => p.onStart(short(s), mine.slice().sort(order))}>順に解く</button>
                <button className="btn small" disabled={!fresh.length} onClick={() => p.onStart(`${short(s)} 未回答`, fresh.slice().sort(order))}>未回答 {fresh.length}</button>
                <button className="btn small primary" disabled={!ng.length} onClick={() => p.onStart(`${short(s)} 苦手`, ng)}>苦手 {ng.length}</button>
              </div>
            </li>
          );
        })}
      </ul>
      {!p.premium && <button className="unlock" onClick={p.onPaywall}><span className="unlock-title">完全版で全科目の問題を増やす</span></button>}
    </div>
  );
}

const order = (a: Question, b: Question) => b.exam - a.exam || byNo(a, b);
