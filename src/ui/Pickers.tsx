import { useMemo } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, short, yearOf } from '../domain/exam';
import { examRange, isLocked, isNigate } from '../domain/study';
import { subjectColor } from './look';
import { TopBar } from './parts';
import { ICheck, IChevron, ILock } from './Icons';

const byNo = (a: Question, b: Question) => (a.session === b.session ? a.no - b.no : a.session === '午前' ? -1 : 1);

/** 年度別・科目別の切り替え(見本の「問題一覧」の上のタブ) */
function ListTabs({ on, onExams, onSubjects }: { on: 'exams' | 'subjects'; onExams: () => void; onSubjects: () => void }) {
  return (
    <div className="seg-tabs" role="tablist">
      <button role="tab" aria-selected={on === 'exams'} className={on === 'exams' ? 'on' : ''} onClick={onExams}>年度別</button>
      <button role="tab" aria-selected={on === 'subjects'} className={on === 'subjects' ? 'on' : ''} onClick={onSubjects}>科目別</button>
    </div>
  );
}

export function ExamPicker(p: {
  all: Question[]; data: AppData; premium: boolean; mock: boolean;
  onBack: () => void; onLocked: () => void;
  onStart: (title: string, qs: Question[], exam: number) => void;
  onSubjects?: () => void;
}) {
  const exams = useMemo(() => [...new Set(p.all.map((q) => q.exam))].sort((a, b) => b - a), [p.all]);
  const lockedExams = exams.filter((e) => !EXAM.freeExams.includes(e));
  return (
    <div className="page list-page">
      <TopBar title={p.mock ? '本番形式の模試' : '問題一覧'} onClose={p.onBack} />
      {!p.mock && p.onSubjects && <ListTabs on="exams" onExams={() => {}} onSubjects={p.onSubjects} />}
      {p.mock && <p className="lead">本番と同じ{EXAM.perExam}問を、答え合わせなしで最後まで解きます。時間を計り、最後に科目ごとの点数を出します。</p>}
      <ul className="rows">
        {exams.map((exam) => {
          const qs = p.all.filter((q) => q.exam === exam).sort(byNo);
          const locked = isLocked(qs[0], p.premium, EXAM);
          const seen = qs.filter((q) => p.data.records[q.id]).length;
          const ng = qs.filter((q) => isNigate(p.data.records[q.id])).length;
          const last = p.data.mocks.filter((m) => m.exam === exam).at(-1);
          const free = !p.premium && EXAM.freeExams.includes(exam);
          return (
            <li key={exam} className={`exam-row ${locked ? 'locked' : ''}`}>
              <div className="exam-head">
                {locked && <span className="lock-ico"><ILock size={20} /></span>}
                <div className="exam-title">
                  {free && <span className="badge red">無料</span>}
                  {locked && <span className="badge gold">完全版</span>}
                  <b>第{exam}回</b><span className="muted">({yearOf(exam)}年)</span>
                </div>
              </div>
              {!p.mock && !locked && (
                <>
                  <p className="exam-meta">{seen}/{qs.length}問 解いた{ng ? `・苦手${ng}` : ''}</p>
                  <span className="mini-bar"><i style={{ width: `${(seen / qs.length) * 100}%` }} /></span>
                </>
              )}
              {locked && <p className="exam-meta">完全版で解ける回です</p>}
              {p.mock && last && <p className="exam-meta">前回 {last.score}/{last.total}点</p>}
              <div className="exam-actions">
                {locked ? (
                  <button className="btn small" onClick={p.onLocked}>完全版で解く<IChevron size={16} /></button>
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
      {!p.premium && lockedExams.length > 0 && (
        <section className="card plan-card">
          <p className="plan-title">完全版で、{examRange(lockedExams[lockedExams.length - 1], lockedExams[0])}も解けます</p>
          <ul className="checks">
            <li><ICheck size={16} />{EXAM.name}の過去の回の問題すべて</li>
            <li><ICheck size={16} />本番形式の模試</li>
            <li><ICheck size={16} />買い切り(月額はかかりません)</li>
          </ul>
          <button className="btn primary wide" onClick={p.onLocked}>完全版を見る<IChevron size={16} /></button>
        </section>
      )}
    </div>
  );
}

export function SubjectPicker(p: {
  open: Question[]; all: Question[]; data: AppData; premium: boolean;
  onBack: () => void; onPaywall: () => void;
  onStart: (title: string, qs: Question[]) => void;
  onExams?: () => void;
}) {
  return (
    <div className="page list-page">
      <TopBar title="問題一覧" onClose={p.onBack} />
      {p.onExams && <ListTabs on="subjects" onExams={p.onExams} onSubjects={() => {}} />}
      <ul className="rows">
        {EXAM.subjects.map((s, i) => {
          const mine = p.open.filter((q) => q.subject === s && !q.excluded);
          const total = p.all.filter((q) => q.subject === s && !q.excluded).length;
          const ng = mine.filter((q) => isNigate(p.data.records[q.id]));
          const fresh = mine.filter((q) => !p.data.records[q.id]);
          return (
            <li key={s} className="exam-row">
              <div className="exam-head"><span className="subj-dot" style={{ background: subjectColor(i) }} /><b>{short(s)}</b><span className="muted">{mine.length}問{!p.premium && total > mine.length ? `(完全版 ${total}問)` : ''}</span></div>
              {short(s) !== s && <p className="exam-meta">{s}</p>}
              <div className="exam-actions">
                <button className="btn small" disabled={!mine.length} onClick={() => p.onStart(short(s), mine.slice().sort(order))}>順に解く</button>
                <button className="btn small" disabled={!fresh.length} onClick={() => p.onStart(`${short(s)} 未回答`, fresh.slice().sort(order))}>未回答 {fresh.length}</button>
                <button className="btn small primary" disabled={!ng.length} onClick={() => p.onStart(`${short(s)} 苦手`, ng)}>苦手 {ng.length}</button>
              </div>
            </li>
          );
        })}
      </ul>
      {!p.premium && <button className="unlock" onClick={p.onPaywall}><span className="unlock-title">完全版で全科目の問題を増やす</span><IChevron /></button>}
    </div>
  );
}

const order = (a: Question, b: Question) => b.exam - a.exam || byNo(a, b);
