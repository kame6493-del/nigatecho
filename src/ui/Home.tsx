import { useMemo } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM } from '../domain/exam';
import { dayKey, examRange, isNigate, streakDays, unseen } from '../domain/study';
import { lastDays } from '../domain/summary';
import { ART, lookOf, weekday } from './look';
import { ExamDateCard, ForecastCard } from './parts';
import { IBook, IChart, IChevron, IClip, IDoc, IGear, ILayers, IRepeat, IShuffle, IStar, IArrow } from './Icons';

interface Props {
  data: AppData;
  all: Question[];
  open: Question[];
  premium: boolean;
  onNigate: () => void;
  onUnseen: () => void;
  onRandom: () => void;
  onMarks: () => void;
  onExams: () => void;
  onSubjects: () => void;
  onMock: () => void;
  onPaywall: () => void;
  onSettings: () => void;
  onSources: () => void;
  /** 試験を切り替える画面へ */
  onSwitchExam: () => void;
  /** 予想点を免除を受けた受け方(精神保健福祉士の専門科目だけ)で見るかを切り替える */
  onExemptOnly: (on: boolean) => void;
  /** 苦手ノート・成績のタブへ */
  onNote: () => void;
  onStats: () => void;
}

export function Home(p: Props) {
  const now = Date.now();
  const look = lookOf(EXAM.dir);
  const nigate = p.open.filter((q) => isNigate(p.data.records[q.id])).length;
  const fresh = unseen(p.open, p.data).length;
  const scorable = p.open.filter((q) => !q.excluded).length;
  const seen = p.open.filter((q) => p.data.records[q.id]).length;
  const streak = streakDays(p.data.daily, now);
  const today = p.data.daily[dayKey(now)] ?? 0;
  const lockedCount = p.all.length - p.open.length;
  const exams = useMemo(() => [...new Set(p.all.map((q) => q.exam))].sort((a, b) => b - a), [p.all]);
  const week = lastDays(p.data.daily, now, 7);
  const weekSum = week.reduce((s, d) => s + d.n, 0);
  const weekMax = Math.max(1, ...week.map((d) => d.n));

  return (
    <div className="page home">
      <header className="app-head">
        <div className="logo">
          <img src={ART.logo} alt="" />
          <span><b>ニガテ帳</b><small>国家試験の過去問</small></span>
        </div>
        <button className="icon" onClick={p.onSettings} aria-label="設定"><IGear /></button>
      </header>

      <section className="exam-card" style={{ background: look.tint }}>
        <button className="exam-card-main" onClick={p.onSwitchExam} aria-label={`いまの試験 ${EXAM.name}`}>
          <span className="exam-tag">現在の試験</span>
          <span className="exam-name brand-sub" data-exam={EXAM.dir}>{EXAM.name}</span>
          <img className="exam-art" src={look.img} alt="" />
          <span className="exam-chev"><IChevron /></span>
        </button>
        <button className="btn primary wide exam-switch" onClick={p.onSwitchExam} aria-label="試験を切り替える">試験を切り替える<IRepeat size={18} /></button>
      </section>

      {seen === 0 ? (
        <section className="card hero hero-first">
          <img className="hero-art" src={ART.birdQ} alt="" />
          <p className="hero-lead">間違えた問題だけが、ここに残ります。</p>
          <p className="hero-sub">2回続けて正解すると消えます。0問になったら、本番に持っていく苦手はありません。</p>
          <button className="btn primary wide" onClick={p.onRandom}>まず10問解いてみる<IArrow size={18} /></button>
        </section>
      ) : (
        <>
          <button className="card stat-card hero" onClick={p.onNote}>
            <span className="stat-ico"><IChart size={26} /></span>
            <span className="stat-body">
              {nigate > 0
                ? <span className="hero-num">あと <b>{nigate}</b> 問わからない</span>
                : <span className="hero-num">苦手は <b>0</b> 問</span>}
              <span className="hero-sub">{nigate > 0 ? '(苦手ノートに残っている問題)' : fresh > 0 ? `まだ解いていない問題が ${fresh}問 あります` : '解ける問題はすべて片づきました'}</span>
              <span className="mini-bar"><i style={{ width: `${scorable ? (seen / scorable) * 100 : 0}%` }} /></span>
              <span className="mini-cap">解いた問題 {seen} / {scorable}問</span>
            </span>
            <IChevron />
          </button>
          {nigate > 0
            ? <button className="btn primary wide big" onClick={p.onNigate}>苦手を解く({nigate}問)<IArrow size={18} /></button>
            : fresh > 0 && <button className="btn primary wide big" onClick={p.onUnseen}>まだ解いていない問題へ<IArrow size={18} /></button>}
        </>
      )}

      <ExamDateCard data={p.data} onSet={p.onSettings} />

      <h2 className="sec-title">クイックメニュー</h2>
      <section className="quick menu">
        <button onClick={p.onExams}><IBook className="c-red" /><b>年度別</b><span>{examRange(exams[exams.length - 1], exams[0])}</span></button>
        <button onClick={p.onSubjects}><ILayers className="c-blue" /><b>科目別</b><span>{EXAM.subjects.length}科目</span></button>
        <button onClick={p.onUnseen} disabled={fresh === 0}><IDoc className="c-green" /><b>未回答</b><span>まだ解いていない {fresh}問</span></button>
        <button onClick={p.onRandom}><IShuffle className="c-teal" /><b>ランダム10問</b><span>すきま時間に</span></button>
        <button onClick={p.onMarks} disabled={p.data.marks.length === 0}><IStar className="c-yellow" /><b>しるし</b><span>{p.data.marks.length}問</span></button>
        <button onClick={p.premium ? p.onMock : p.onPaywall}><IClip className="c-purple" /><b>模試</b><span>{p.premium ? `本番形式 ${EXAM.perExam}問` : '本番形式(完全版)'}</span></button>
      </section>

      <ForecastCard data={p.data} all={p.all} open={p.open} onExemptOnly={p.onExemptOnly} more={p.onStats} />

      <section className="card week">
        <h2 className="card-title">学習サマリー(直近7日)</h2>
        <div className="week-nums">
          <p><b>{weekSum}</b><span>解いた問題</span></p>
          <p><b>{today}</b><span>今日</span></p>
          <p><b>{streak}</b><span>連続日数</span></p>
        </div>
        <div className="week-bars" aria-hidden>
          {week.map((d) => (
            <span key={d.key} className={d.key === dayKey(now) ? 'today' : ''}>
              <i style={{ height: `${(d.n / weekMax) * 100}%` }} />
              <small>{weekday(d.t)}</small>
            </span>
          ))}
        </div>
      </section>

      {!p.premium && lockedCount > 0 && (
        <button className="unlock" onClick={p.onPaywall}>
          <span className="unlock-title">完全版で、あと{lockedCount}問</span>
          <span className="unlock-sub">{examRange(exams[exams.length - 1], exams[1])}と本番形式の模試。買い切りで、月額はかかりません。</span>
          <IChevron />
        </button>
      )}

      <p className="credit">{EXAM.credit}</p>
      <p className="credit"><button className="linkish" onClick={p.onSources}>出典と参考文献・{EXAM.notice ? 'ご注意' : '医療に関するご注意'}</button></p>
    </div>
  );
}
