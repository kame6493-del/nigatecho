import { useMemo } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, short } from '../domain/exam';
import { dayKey, daysLeft, estimate, isNigate, streakDays, subjectStats, subjectWeights, unseen } from '../domain/study';

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
  onMockHistory: () => void;
  onSubject: (s: string) => void;
  onPaywall: () => void;
  onSettings: () => void;
}

export function Home(p: Props) {
  const now = Date.now();
  const stats = useMemo(() => subjectStats(p.open, p.data, EXAM), [p.open, p.data]);
  const weights = useMemo(() => subjectWeights(p.all, EXAM), [p.all]);
  const est = estimate(stats, weights, EXAM);
  const nigate = p.open.filter((q) => isNigate(p.data.records[q.id])).length;
  const fresh = unseen(p.open, p.data).length;
  const seen = stats.reduce((s, x) => s + x.seen, 0);
  const left = daysLeft(p.data.settings.examDate, now);
  const streak = streakDays(p.data.daily, now);
  const today = p.data.daily[dayKey(now)] ?? 0;
  const lockedCount = p.all.length - p.open.length;
  const exams = [...new Set(p.all.map((q) => q.exam))].sort((a, b) => b - a);

  return (
    <div className="page home">
      <header className="home-head">
        <div className="brand">
          <span className="brand-name">ニガテ帳</span>
          <span className="brand-sub">{EXAM.name} 過去問</span>
        </div>
        <button className="icon" onClick={p.onSettings} aria-label="設定">⚙</button>
      </header>

      <div className="chips">
        {left !== null && <span className="chip">試験まで <b>{left}</b> 日</span>}
        <span className="chip">今日 <b>{today}</b> 問</span>
        {streak > 0 && <span className="chip">連続 <b>{streak}</b> 日</span>}
      </div>

      <section className="hero">
        {seen === 0 ? (
          <>
            <p className="hero-lead">間違えた問題だけが、ここに残ります。</p>
            <p className="hero-sub">2回続けて正解すると消えます。0問になったら、本番に持っていく苦手はありません。</p>
            <button className="btn primary wide" onClick={p.onRandom}>まず10問解いてみる</button>
          </>
        ) : nigate > 0 ? (
          <>
            <p className="hero-label">いまの苦手</p>
            <p className="hero-num"><b>{nigate}</b><span>問</span></p>
            <p className="hero-sub">2回続けて正解すると消えます</p>
            <button className="btn primary wide" onClick={p.onNigate}>苦手を解く</button>
          </>
        ) : (
          <>
            <p className="hero-label">いまの苦手</p>
            <p className="hero-num"><b>0</b><span>問</span></p>
            <p className="hero-sub">{fresh > 0 ? `まだ解いていない問題が ${fresh}問 あります` : '解ける問題はすべて片づきました'}</p>
            {fresh > 0 && <button className="btn primary wide" onClick={p.onUnseen}>まだ解いていない問題へ</button>}
          </>
        )}
      </section>

      <section className="card forecast">
        <h2>本番の予想点</h2>
        {est ? (
          <>
            <div className="fc-row">
              <p className="fc-score"><b>{est.score}</b><span>/ {est.total}点</span></p>
              <p className={`fc-verdict ${est.score >= est.pass ? 'good' : 'bad'}`}>
                {est.score >= est.pass ? `合格ラインを ${est.score - est.pass}点 上回っています` : `合格ラインまで あと${est.pass - est.score}点`}
              </p>
            </div>
            <div className="fc-bar" aria-hidden>
              <i style={{ width: `${(est.score / est.total) * 100}%` }} />
              <em style={{ left: `${(est.pass / est.total) * 100}%` }}><span>合格 {est.pass}</span></em>
            </div>
            {est.coverage < 1 && <p className="muted small">まだ解いていない科目は、ほかの科目の正答率で見積もっています</p>}
          </>
        ) : (
          <p className="muted">あと {Math.max(0, 30 - seen)}問 解くと、いまの実力で本番を受けたときの点数を出します。</p>
        )}
      </section>

      <section className="card">
        <h2>科目ごとの正答率</h2>
        <ul className="subjects">
          {stats.map((s) => (
            <li key={s.subject}>
              <button className="subj-row" onClick={() => p.onSubject(s.subject)} disabled={s.total === 0}>
                <span className="subj-name">{short(s.subject)}</span>
                <span className="subj-bar">
                  <i className={s.rate !== null && s.rate < EXAM.passRatio ? 'low' : ''} style={{ width: `${(s.rate ?? 0) * 100}%` }} />
                  <em style={{ left: `${EXAM.passRatio * 100}%` }} />
                </span>
                <span className="subj-rate">{s.rate === null ? '—' : `${Math.round(s.rate * 100)}%`}</span>
                <span className={`subj-ng ${s.nigate ? 'has' : ''}`}>{s.nigate ? `苦手${s.nigate}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">最後に解いたときの結果で数えています。点線は合格基準の6割。</p>
      </section>

      <section className="menu">
        <button onClick={p.onExams}><b>年度別</b><span>第{exams[exams.length - 1]}〜{exams[0]}回</span></button>
        <button onClick={p.onSubjects}><b>科目別</b><span>{EXAM.subjects.length}科目</span></button>
        <button onClick={p.onUnseen} disabled={fresh === 0}><b>まだ解いていない</b><span>{fresh}問</span></button>
        <button onClick={p.onRandom}><b>ランダム10問</b><span>すきま時間に</span></button>
        <button onClick={p.onMarks} disabled={p.data.marks.length === 0}><b>しるし</b><span>{p.data.marks.length}問</span></button>
        <button onClick={p.premium ? p.onMock : p.onPaywall}><b>本番形式の模試</b><span>{p.premium ? '200問・時間を計る' : '完全版'}</span></button>
        {p.data.mocks.length > 0 && <button onClick={p.onMockHistory}><b>模試の記録</b><span>{p.data.mocks.length}回</span></button>}
      </section>

      {!p.premium && lockedCount > 0 && (
        <button className="unlock" onClick={p.onPaywall}>
          <span className="unlock-title">完全版で、あと{lockedCount}問</span>
          <span className="unlock-sub">第{exams[exams.length - 1]}〜{exams[1]}回と本番形式の模試。買い切りで、月額はかかりません。</span>
        </button>
      )}

      <p className="credit">{EXAM.credit}</p>
    </div>
  );
}
