import { useMemo } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, SINGLE } from '../domain/exam';
import { byAmPm, dayKey, daysLeft, examRange, halfName, isNigate, streakDays, unseen, type AmPm } from '../domain/study';
import { lastDays } from '../domain/summary';
import { admitFacts, freeLeft, homeUpsell, nearFree, partRows, studyPlan, subFreeDone, subPassGrowth, subSeen } from '../domain/upsell';
import { TODAY_GOAL, todayMix } from '../domain/today';
import { ART, lookOf, weekday } from './look';
import { AmPmSwitch, ExamDateCard, ForecastCard } from './parts';
import { IBook, IChart, IChevron, IClip, IDoc, IGear, ILayers, IRepeat, IShuffle, IStar, IArrow, IX } from './Icons';

interface Props {
  data: AppData;
  all: Question[];
  open: Question[];
  premium: boolean;
  onNigate: () => void;
  onUnseen: () => void;
  onRandom: () => void;
  /** 今日の10問(苦手→まだ解いていない問題)。1問でも解いた人のホームに出す */
  onToday?: () => void;
  /** 必修問題(別の基準がある問題)だけを10問。基準の無い試験では渡さない */
  onSub?: () => void;
  /** 試験日の目安から購入画面へ */
  onPaywallPlan?: () => void;
  onMarks: () => void;
  onExams: () => void;
  onSubjects: () => void;
  onMock: () => void;
  onPaywall: () => void;
  /** 無料の回の必修問題を解き終えた案内から購入画面へ(看護師) */
  onPaywallSub?: () => void;
  /** 無料の回を解き終えた1枚・未回答のボタン(解き終えたあと)・無料の残りが少ない知らせから購入画面へ(入り口を分けて数える) */
  onPaywallFinished?: () => void;
  onPaywallUnseen?: () => void;
  onPaywallNear?: () => void;
  /** 無料の残りが少ない知らせを閉じたか(試験ごと)と、閉じる */
  nearClosed?: boolean;
  onNearClose?: () => void;
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
  /** 今日の10問の中身(範囲の中の苦手→まだ解いていない問題)と、済んだか */
  const mix = todayMix(openIn, p.data);
  const todayDone = today >= TODAY_GOAL;
  const week = lastDays(p.data.daily, now, 7);
  const weekSum = week.reduce((s, d) => s + d.n, 0);
  const weekMax = Math.max(1, ...week.map((d) => d.n));
  /** 完全版の案内の出し方(30問を超えたら予想点の下・無料の回を解き終えたら上に1枚) */
  const free = EXAM.freeExams;
  const left = freeLeft(p.open, p.data, EXAM);
  const subDone = subSeen(p.open, p.data, EXAM);
  const upsell = homeUpsell({ premium: p.premium, lockedCount, seen, freeLeft: left, hasFree: free.length > 0, subSeen: subDone });
  /** 無料の残りが20問を切ったら、上に小さく1行(閉じたらこの試験ではもう出さない) */
  const near = nearFree({ premium: p.premium, lockedCount, seen, freeLeft: left, hasFree: free.length > 0, closed: p.nearClosed ?? true });
  /** 未回答が0で、完全版にまだ解いていない問題があるときは、未回答のボタンを完全版の案内にする(押せないままにしない) */
  const lockedIn = byAmPm(p.all, ampm).length - openIn.length;
  const unseenToFull = freshIn === 0 && !p.premium && free.length > 0 && lockedIn > 0;
  /** 試験日までに1周する1日の数。買っていない人には完全版の分も(実際の問題数だけ) */
  const plan = studyPlan({
    days: daysLeft(p.data.settings.examDate, now),
    unseenNow: unseen(p.open.filter((q) => !q.excluded), p.data).length,
    unseenFull: p.premium || lockedCount <= 0 ? null : unseen(p.all.filter((q) => !q.excluded), p.data).length,
  });
  const lockedRange = examRange(exams[exams.length - 1], exams.find((e) => !free.includes(e)) ?? exams[0]);
  /** 看護師の必修問題のように別の基準がある試験は、増える分のうちの数も書く */
  const sub = subPassGrowth(p.all, EXAM);
  /** 看護師: 無料の回の必修問題を全部解き終えたら、その記録と、完全版で増える必修・状況設定の数を1枚で出す */
  const subDone2 = !p.premium && lockedCount > 0 && upsell !== 'finished' ? subFreeDone(p.open, p.data, EXAM) : null;
  const subRest = subDone2 && sub ? sub.full - sub.now : 0;
  const caseRow = subDone2 ? partRows(p.all, EXAM)?.find((r) => r.key === 'case') : undefined;
  const band = (
    <button className={`unlock ${upsell === 'raised' ? 'raised' : ''}`} onClick={p.onPaywall} data-upsell={`home-${upsell}`}>
      <span className="unlock-title">完全版で、あと{lockedCount}問</span>
      <span className="unlock-sub">{lockedRange}の過去問{sub ? `(${sub.label} ${sub.full - sub.now}問を含む)` : ''}と、その回の本番形式の模試。買い切りで、月額はかかりません。</span>
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

      {/* はじめての人には出さない(まず10問。範囲は解いてから選べば足りる) */}
      {p.ampm && seen > 0 && <AmPmSwitch value={p.ampm} onChange={p.onAmPm} note="苦手を解く・未回答・ランダム10問・模試に効きます" />}

      {near && (
        <div className="near-note" data-upsell="home-near">
          <button className="near-main" onClick={p.onPaywallNear ?? p.onPaywall}>
            <span>第{free.join('・')}回(無料)は 残り<b>{left}</b>問</span>
            <small>その先の{lockedRange} {lockedCount.toLocaleString('ja-JP')}問は完全版で</small>
          </button>
          <button className="near-x" onClick={p.onNearClose} aria-label="この知らせを閉じる" data-near="close"><IX size={16} /></button>
        </div>
      )}

      {upsell === 'finished' && (
        <section className="card done-card" data-upsell="home-finished">
          <p className="done-title">第{free.join('・')}回は、すべて解きました</p>
          <p className="done-left">完全版なら 残り<b>{lockedCount.toLocaleString('ja-JP')}</b>問</p>
          <p className="done-sub">{lockedRange}の過去問と、その回の本番形式の模試が解けます。解いた分は苦手ノートと予想点にも入ります。</p>
          <button className="btn primary wide" onClick={p.onPaywallFinished ?? p.onPaywall}>完全版を見る<IChevron size={16} /></button>
        </section>
      )}

      {subDone2 && subRest > 0 && (
        <section className="card done-card sub-done" data-upsell="home-sub-done">
          <p className="done-title">第{subDone2.rounds.join('・')}回の{EXAM.subPass!.label}を、全部解きました</p>
          <p className={`done-score ${subDone2.ok >= subDone2.need ? 'good' : 'bad'}`}>最後の答えで {subDone2.ok}/{subDone2.total}問 正解(基準の目安 {subDone2.need}問){subDone2.ok >= subDone2.need ? '' : ` あと${subDone2.need - subDone2.ok}問`}</p>
          <p className="done-sub">{lockedRange}の{EXAM.subPass!.label} {subRest}問{caseRow && caseRow.full > caseRow.free ? `と${caseRow.label} ${caseRow.full - caseRow.free}問` : ''}は、完全版で解けます。間違えた{EXAM.subPass!.label}は、このまま苦手ノートから解けます。</p>
          <button className="btn primary wide" onClick={p.onPaywallSub ?? p.onPaywall}>完全版の{EXAM.subPass!.label}を見る<IChevron size={16} /></button>
        </section>
      )}

      {seen === 0 ? (
        <section className="card hero hero-first">
          <img className="hero-art" src={ART.birdQ} alt="" />
          <p className="hero-lead">間違えた問題だけが、ここに残ります。</p>
          <p className="hero-sub">2回続けて正解すると消えます。0問になったら、本番に持っていく苦手はありません。</p>
          {EXAM.subPass?.separate && p.onSub ? (
            <>
              <p className="hero-sub" data-first="sub">{EXAM.subPass.label}は{Math.round(EXAM.subPass.ratio * 10)}割が基準です。10問解くと、いまの{EXAM.subPass.label}の点数を出します。</p>
              <button className="btn primary wide" onClick={p.onSub} data-home="sub-first">まず{EXAM.subPass.label}を10問<IArrow size={18} /></button>
              <button className="btn wide hero-alt" onClick={p.onRandom}>ほかの問題もまぜて10問</button>
            </>
          ) : (
            <button className="btn primary wide" onClick={p.onRandom}>まず10問解いてみる<IArrow size={18} /></button>
          )}
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
          {mix.nigate + mix.fresh > 0 && p.onToday && (
            <section className={`card today-card ${todayDone ? 'done' : ''}`} data-home="today">
              <p className="today-head">
                <b>今日の{TODAY_GOAL}問{half ? `・${half}` : ''}</b>
                <span className="today-count"><b>{Math.min(today, TODAY_GOAL)}</b> / {TODAY_GOAL}問</span>
              </p>
              <span className="mini-bar"><i style={{ width: `${(Math.min(today, TODAY_GOAL) / TODAY_GOAL) * 100}%` }} /></span>
              <p className="today-sub">{todayDone
                ? `今日の分は済みました。${streak >= 2 ? `${streak}日続いています。` : ''}明日も苦手から続きが出ます。`
                : [mix.nigate > 0 ? `苦手ノートの${mix.nigate}問` : '', mix.fresh > 0 ? `まだ解いていない${mix.fresh}問` : ''].filter(Boolean).join('と') + '。苦手から先に出します。'}</p>
              <button className={`btn wide big ${todayDone ? '' : 'primary'}`} onClick={p.onToday} data-home="today-start">{todayDone ? `もう${TODAY_GOAL}問解く` : today > 0 ? '今日の続きを解く' : `今日の${TODAY_GOAL}問を解く`}<IArrow size={18} /></button>
            </section>
          )}
          {nigateIn > 0
            ? <button className={`btn wide ${p.onToday ? '' : 'primary big'}`} onClick={p.onNigate} data-home="nigate">苦手だけを解く{half ? `・${half}` : ''}({nigateIn}問)<IArrow size={18} /></button>
            : nigate > 0
              ? <button className="btn wide" disabled data-home="nigate">{half}の苦手はありません</button>
              : freshIn > 0 && !p.onToday && <button className="btn primary wide big" onClick={p.onUnseen}>まだ解いていない問題へ<IArrow size={18} /></button>}
        </>
      )}

      <ExamDateCard data={p.data} onSet={p.onSettings} plan={seen > 0 ? plan : null} onPlanFull={p.onPaywallPlan ?? p.onPaywall} admit={admitFacts(EXAM, p.data.settings.examDate, now)} />

      <h2 className="sec-title">クイックメニュー</h2>
      <section className="quick menu">
        <button onClick={p.onExams}><IBook className="c-red" /><b>年度別</b><span>{examRange(exams[exams.length - 1], exams[0])}</span></button>
        <button onClick={p.onSubjects}><ILayers className="c-blue" /><b>科目別</b><span>{EXAM.subjects.length}科目</span></button>
        {unseenToFull
          ? <button onClick={p.onPaywallUnseen ?? p.onPaywall} className="to-full" data-upsell="home-unseen"><IDoc className="c-green" /><b>未回答</b><span>完全版なら残り {lockedIn.toLocaleString('ja-JP')}問</span></button>
          : <button onClick={p.onUnseen} disabled={freshIn === 0}><IDoc className="c-green" /><b>未回答</b><span>まだ解いていない {freshIn}問</span></button>}
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
