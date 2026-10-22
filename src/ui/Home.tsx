import { useMemo } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, SINGLE } from '../domain/exam';
import { byAmPm, dayKey, examRange, halfName, isNigate, streakDays, unseen, type AmPm } from '../domain/study';
import { lastDays } from '../domain/summary';
import { freeLeft, homeUpsell } from '../domain/upsell';
import { ART, lookOf, weekday } from './look';
import { AmPmSwitch, ExamDateCard, ForecastCard } from './parts';
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
  /** 苦手を解く・未回答・ランダム10問・模試の範囲。null は午前・午後の区分が無い試験(切り替えを出さない) */
  ampm: AmPm | null;
  onAmPm: (v: AmPm) => void;
}

export function Home(p: Props) {
  const now = Date.now();
  const look = lookOf(EXAM.dir);
  const nigate = p.open.filter((q) => isNigate(p.data.records[q.id])).length;
  const fresh = unseen(p.open, p.data).length;
  const ampm = p.ampm ?? 'both';
  const half = ampm === 'both' ? '' : halfName(ampm, EXAM);
  const openIn = byAmPm(p.open, ampm);
  /** 範囲の中の苦手・未回答(ボタンの数。上の「あと N 問」は苦手ノート全体の数のまま) */
  const nigateIn = openIn.filter((q) => isNigate(p.data.records[q.id])).length;
  const freshIn = unseen(openIn, p.data).length;
  const scorable = p.open.filter((q) => !q.excluded).length;
  const seen = p.open.filter((q) => p.data.records[q.id]).length;
  const streak = streakDays(p.data.daily, now);
  const today = p.data.daily[dayKey(now)] ?? 0;
  const lockedCount = p.all.length - p.open.length;
  const exams = useMemo(() => [...new Set(p.all.map((q) => q.exam))].sort((a, b) => b - a), [p.all]);
  const week = lastDays(p.data.daily, now, 7);
  const weekSum = week.reduce((s, d) => s + d.n, 0);
  const weekMax = Math.max(1, ...week.map((d) => d.n));
  /** 完全版の案内の出し方(30問を超えたら予想点の下・無料の回を解き終えたら上に1枚) */
  const free = EXAM.freeExams;
  const left = freeLeft(p.open, p.data, EXAM);
  const upsell = homeUpsell({ premium: p.premium, lockedCount, seen, freeLeft: left, hasFree: free.length > 0 });
  const lockedRange = examRange(exams[exams.length - 1], exams.find((e) => !free.includes(e)) ?? exams[0]);
  const band = (
    <button className={`unlock ${upsell === 'raised' ? 'raised' : ''}`} onClick={p.onPaywall} data-upsell={`home-${upsell}`}>
      <span className="unlock-title">完全版で、あと{lockedCount}問</span>
      <span className="unlock-sub">{lockedRange}の過去問と、その回の本番形式の模試。買い切りで、月額はかかりません。</span>
      <IChevron />
    </button>
  );

  return (
    <div className="page home">
      <header className="app-head">
        <div className="logo">
          <img src={ART.logo} alt="" />
          <span><b>ニガテ帳</b><small>{SINGLE ? `${EXAM.name}の過去問` : '国家試験の過去問'}</small></span>
        </div>
        <button className="icon" onClick={p.onSettings} aria-label="設定"><IGear /></button>
      </header>

      {SINGLE ? (
      <section className="exam-card single" style={{ background: look.tint }}>
        <div className="exam-card-main">
          <span className="exam-tag">受ける試験</span>
          <span className="exam-name brand-sub" data-exam={EXAM.dir} style={{ color: look.ink }}>{EXAM.name}</span>
          <img className="exam-art" src={look.img} alt="" />
        </div>
        <p className="exam-catch">{look.catch}</p>
      </section>
      ) : (
      <section className="exam-card" style={{ background: look.tint }}>
        <button className="exam-card-main" onClick={p.onSwitchExam} aria-label={`いまの試験 ${EXAM.name}`}>
          <span className="exam-tag">現在の試験</span>
          <span className="exam-name brand-sub" data-exam={EXAM.dir}>{EXAM.name}</span>
          <img className="exam-art" src={look.img} alt="" />
          <span className="exam-chev"><IChevron /></span>
        </button>
        <button className="btn primary wide exam-switch" onClick={p.onSwitchExam} aria-label="試験を切り替える">試験を切り替える<IRepeat size={18} /></button>
      </section>
      )}

      {p.ampm && <AmPmSwitch value={p.ampm} onChange={p.onAmPm} note="苦手を解く・未回答・ランダム10問・模試に効きます" />}

      {upsell === 'finished' && (
        <section className="card done-card" data-upsell="home-finished">
          <p className="done-title">第{free.join('・')}回は、すべて解きました</p>
          <p className="done-sub">{lockedRange}の{lockedCount}問と、その回の本番形式の模試は完全版で解けます。解いた分は苦手ノートと予想点にも入ります。</p>
          <button className="btn primary wide" onClick={p.onPaywall}>完全版を見る<IChevron size={16} /></button>
        </section>
      )}

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
          {nigateIn > 0
            ? <button className="btn primary wide big" onClick={p.onNigate} data-home="nigate">苦手を解く{half ? `・${half}` : ''}({nigateIn}問)<IArrow size={18} /></button>
            : nigate > 0
              ? <button className="btn primary wide big" disabled data-home="nigate">{half}の苦手はありません</button>
              : freshIn > 0 && <button className="btn primary wide big" onClick={p.onUnseen}>まだ解いていない問題へ<IArrow size={18} /></button>}
        </>
      )}

      <ExamDateCard data={p.data} onSet={p.onSettings} />

      <h2 className="sec-title">クイックメニュー</h2>
      <section className="quick menu">
        <button onClick={p.onExams}><IBook className="c-red" /><b>年度別</b><span>{examRange(exams[exams.length - 1], exams[0])}</span></button>
        <button onClick={p.onSubjects}><ILayers className="c-blue" /><b>科目別</b><span>{EXAM.subjects.length}科目</span></button>
        <button onClick={p.onUnseen} disabled={freshIn === 0}><IDoc className="c-green" /><b>未回答</b><span>まだ解いていない {freshIn}問</span></button>
        <button onClick={p.onRandom}><IShuffle className="c-teal" /><b>ランダム10問</b><span>{half ? `${half}から` : 'すきま時間に'}</span></button>
        <button onClick={p.onMarks} disabled={p.data.marks.length === 0}><IStar className="c-yellow" /><b>しるし</b><span>{p.data.marks.length}問</span></button>
        <button onClick={p.onMock}><IClip className="c-purple" /><b>模試</b><span>{half ? `本番形式・${half}` : `本番形式 ${EXAM.perExam}問`}</span></button>
      </section>

      <ForecastCard data={p.data} all={p.all} open={p.open} onExemptOnly={p.onExemptOnly} more={p.onStats} />

      {upsell === 'raised' && band}

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

      {upsell === 'bottom' && band}

      <p className="credit">{EXAM.credit}</p>
      <p className="credit"><button className="linkish" onClick={p.onSources}>出典と参考文献・{EXAM.notice ? 'ご注意' : '医療に関するご注意'}</button></p>
    </div>
  );
}
