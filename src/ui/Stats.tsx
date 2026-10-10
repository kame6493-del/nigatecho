import { useMemo, useState } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, short } from '../domain/exam';
import { daysLeft, examView, isNigate, passScoreOf, streakDays, subjectStats, unseen } from '../domain/study';
import { dailyPace, lastDays } from '../domain/summary';
import { ART, subjectColor } from './look';
import { ExamDateCard, ForecastCard, SubjectBars } from './parts';
import { IArrow, IBell, ICalendar, IChevron, INote } from './Icons';

type StatTab = 'all' | 'subjects' | 'trend' | 'plan';
const TABS: { id: StatTab; label: string }[] = [
  { id: 'all', label: '総合' }, { id: 'subjects', label: '科目別' }, { id: 'trend', label: '推移' }, { id: 'plan', label: '計画' },
];

/** 成績(見本の5枚目): 総合・科目別・推移・計画 */
export function Stats(p: {
  data: AppData; all: Question[]; open: Question[];
  onExemptOnly: (on: boolean) => void;
  onSubject: (s: string) => void;
  onNote: () => void;
  onNigate: () => void;
  onUnseen: () => void;
  onRandom: () => void;
  onSettings: () => void;
  onMockHistory: () => void;
  onRemind: (on: boolean) => void;
  remindMsg: string;
}) {
  const [tab, setTab] = useState<StatTab>('all');
  const now = Date.now();
  const nigate = p.open.filter((q) => isNigate(p.data.records[q.id])).length;
  const fresh = unseen(p.open, p.data).length;
  const scorable = p.open.filter((q) => !q.excluded).length;

  return (
    <div className="page stats-page">
      <header className="tab-head"><h1>成績</h1></header>
      <div className="seg-tabs four" role="tablist">
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} data-stab={t.id}>{t.label}</button>)}
      </div>

      {tab === 'all' && (
        <>
          <ForecastCard data={p.data} all={p.all} open={p.open} onExemptOnly={p.onExemptOnly} />
          <section className="card left-card">
            <h2 className="card-title">あと何問わからない?</h2>
            <img className="left-art" src={ART.birdQ} alt="" />
            <p className="left-num"><b>{nigate}</b> 問 わからない</p>
            <p className="muted small center">解ける問題 {scorable}問 のうち、苦手ノートに残っている問題</p>
            <button className="btn soft wide" onClick={p.onNote}><INote size={18} />苦手ノートを見る<IChevron size={16} /></button>
          </section>
          <SubjectBars data={p.data} open={p.open} onSubject={p.onSubject} />
        </>
      )}

      {tab === 'subjects' && <SubjectList {...p} />}

      {tab === 'trend' && <Trend data={p.data} now={now} onMockHistory={p.onMockHistory} />}

      {tab === 'plan' && (
        <>
          <ExamDateCard data={p.data} onSet={p.onSettings} />
          <Plan nigate={nigate} fresh={fresh} left={daysLeft(p.data.settings.examDate, now)} />
          <section className="card remind-card">
            <h2 className="card-title"><IBell className="red" />毎日のお知らせ</h2>
            <div className="remind-row">
              <span>毎日 {p.data.settings.remindAt} にお知らせ</span>
              <button className={`toggle ${p.data.settings.remind ? 'on' : ''}`} onClick={() => p.onRemind(!p.data.settings.remind)} aria-pressed={p.data.settings.remind} aria-label="毎日のお知らせ"><i /></button>
            </div>
            <p className="muted small">「前に間違えた問題を、今日も数問だけ。」とお知らせします。時刻は設定で変えられます。</p>
            {p.remindMsg && <p className="err">{p.remindMsg}</p>}
          </section>
          {nigate > 0
            ? <button className="btn primary wide big" onClick={p.onNigate}>苦手を解く({nigate}問)<IArrow size={18} /></button>
            : fresh > 0 ? <button className="btn primary wide big" onClick={p.onUnseen}>まだ解いていない問題を解く<IArrow size={18} /></button>
              : <button className="btn primary wide big" onClick={p.onRandom}>ランダム10問を解く<IArrow size={18} /></button>}
        </>
      )}
    </div>
  );
}

function SubjectList(p: { data: AppData; open: Question[]; onSubject: (s: string) => void }) {
  const exemptOnly = !!(EXAM.exempt && p.data.settings.exemptOnly);
  const view = useMemo(() => examView(EXAM, exemptOnly), [exemptOnly]);
  const stats = useMemo(() => subjectStats(p.open, p.data, view), [p.open, p.data, view]);
  return (
    <>
      <p className="tip">苦手な科目を中心に解いて、正答率を上げましょう。押すとその科目を苦手から順に解きます。</p>
      <ul className="subj-cards">
        {stats.map((s, i) => (
          <li key={s.subject}>
            <button onClick={() => p.onSubject(s.subject)} disabled={s.total === 0} style={{ ['--gc' as string]: subjectColor(i) }}>
              <span className="note-mark">{short(s.subject).slice(0, 1)}</span>
              <span className="sc-body">
                <span className="sc-name">{short(s.subject)}</span>
                <span className="subj-bar"><i style={{ width: `${(s.rate ?? 0) * 100}%`, background: subjectColor(i) }} /></span>
              </span>
              <span className="sc-rate"><b>{s.rate === null ? '—' : `${Math.round(s.rate * 100)}%`}</b><small>{s.lastOk} / {s.seen}{s.nigate ? `・苦手${s.nigate}` : ''}</small></span>
              <IChevron size={18} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Trend({ data, now, onMockHistory }: { data: AppData; now: number; onMockHistory: () => void }) {
  const days = lastDays(data.daily, now, 30);
  const studied = days.filter((d) => d.n > 0).length;
  const total = days.reduce((s, d) => s + d.n, 0);
  const max = Math.max(1, ...days.map((d) => d.n));
  const streak = streakDays(data.daily, now);
  const mocks = data.mocks.slice(-8);
  return (
    <>
      <section className="card">
        <h2 className="card-title"><ICalendar className="red" />学習日数(直近30日)</h2>
        <div className="trend-nums">
          <p><b>{studied}</b><span>日</span></p>
          <p className="sub">解いた問題 <b>{total}</b>問・連続 <b>{streak}</b>日</p>
        </div>
        <div className="bars30" aria-hidden>
          {days.map((d) => <i key={d.key} style={{ height: `${Math.max(d.n ? 6 : 2, (d.n / max) * 100)}%` }} className={d.n ? '' : 'zero'} />)}
        </div>
        <div className="bars30-cap"><span>{days[0].key.slice(5).replace('-', '/')}</span><span>今日</span></div>
      </section>
      <section className="card">
        <h2 className="card-title">本番形式の模試の点数</h2>
        {mocks.length === 0
          ? <p className="muted small">模試を解くと、ここに点数の移り変わりが出ます(完全版)。</p>
          : (
            <>
              <MockChart mocks={mocks} />
              <button className="more-link" onClick={onMockHistory}>模試の記録をすべて見る<IChevron size={16} /></button>
            </>
          )}
      </section>
    </>
  );
}

function MockChart({ mocks }: { mocks: AppData['mocks'] }) {
  const W = 300, H = 120, pad = 18;
  const pts = mocks.map((m, i) => {
    const x = mocks.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (mocks.length - 1);
    const y = H - pad - (m.score / Math.max(1, m.total)) * (H - pad * 2);
    return { x, y, m };
  });
  const last = mocks[mocks.length - 1];
  const pass = passScoreOf(last.exam, last.total, EXAM).score / Math.max(1, last.total);
  const py = H - pad - pass * (H - pad * 2);
  return (
    <svg className="mock-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="模試の点数の移り変わり">
      <line x1={pad} x2={W - pad} y1={py} y2={py} stroke="#e0b100" strokeDasharray="4 4" />
      <text x={W - pad} y={py - 4} textAnchor="end" fontSize="10" fill="#9a7a00">合格の線</text>
      <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#d6383a" strokeWidth="2.5" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#d6383a" />)}
      <text x={pts[pts.length - 1].x} y={pts[pts.length - 1].y - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#d6383a">{last.score}点</text>
    </svg>
  );
}

function Plan({ nigate, fresh, left }: { nigate: number; fresh: number; left: number | null }) {
  const pace = dailyPace(nigate, fresh, left);
  return (
    <section className="card plan">
      <h2 className="card-title">試験までの目安</h2>
      <div className="plan-row">
        <p>苦手 <b>{nigate}</b>問<br />まだ解いていない <b>{fresh}</b>問</p>
        <img src={ART.birdPencil} alt="" />
      </div>
      {pace !== null && (
        <div className="pace">
          <span>1日あたりの目安</span>
          <p><b>{pace}</b> 問</p>
          <small>試験日までに苦手をすべて消し(1問につき2回正解)、まだ解いていない問題も解き終えるペースです。</small>
        </div>
      )}
    </section>
  );
}
