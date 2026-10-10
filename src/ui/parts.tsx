/** いくつかの画面で使う部品(上の帯・下のタブ・予想点・科目の棒・試験日) */
import { useMemo } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, short } from '../domain/exam';
import { daysLeft, estimate, examView, subEstimate, subjectStats, subjectWeights } from '../domain/study';
import { ART, fmtDate, subjectColor } from './look';
import { IBack, IChart, IChevron, IGear, IHome, INote, ISearch, ITarget, IX, ICalendar } from './Icons';

export function TopBar({ title, onClose, right, close = 'back' }: { title: string; onClose: () => void; right?: React.ReactNode; close?: 'back' | 'x' }) {
  return (
    <header className="topbar">
      <button className="icon" onClick={onClose} aria-label="閉じる">{close === 'x' ? <IX /> : <IBack />}</button>
      <h1>{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

export type Tab = 'home' | 'search' | 'note' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: 'home', label: 'ホーム', icon: IHome },
  { id: 'search', label: '問題を探す', icon: ISearch },
  { id: 'note', label: '苦手ノート', icon: INote },
  { id: 'stats', label: '成績', icon: IChart },
  { id: 'settings', label: '設定', icon: IGear },
];

export function TabBar({ tab, onTab, badge }: { tab: Tab; onTab: (t: Tab) => void; badge?: number }) {
  return (
    <nav className="tabbar" aria-label="メニュー">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab(t.id)} data-tab={t.id}>
          <span className="tab-ico">{t.icon({ size: 23 })}{t.id === 'note' && !!badge && <i className="tab-badge">{badge > 99 ? '99+' : badge}</i>}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** 本番の予想点(ホームと成績の画面)。共通科目の免除の切り替えもここ */
export function ForecastCard(p: { data: AppData; all: Question[]; open: Question[]; onExemptOnly: (on: boolean) => void; more?: () => void }) {
  const exemptOnly = !!(EXAM.exempt && p.data.settings.exemptOnly);
  const view = useMemo(() => examView(EXAM, exemptOnly), [exemptOnly]);
  const stats = useMemo(() => subjectStats(p.open, p.data, view), [p.open, p.data, view]);
  const weights = useMemo(() => subjectWeights(p.all, view), [p.all, view]);
  const est = estimate(stats, weights, view);
  const sub = useMemo(() => subEstimate(p.open, p.all, p.data, EXAM), [p.open, p.all, p.data]);
  const seen = stats.reduce((s, x) => s + x.seen, 0);
  // 毎年の合格点が変わる試験は、直近の回の公式の合格点を線にする(6割の線は実際の合格点よりずっと高い)
  const lineName = est?.passExam ? '直近の合格点' : '合格ライン';
  return (
    <section className="card forecast">
      <h2 className="card-title"><ITarget className="red" />本番の予想点</h2>
      {EXAM.exempt && (
        <div className="seg exempt-seg" role="group" aria-label="予想点の受け方">
          <button className={exemptOnly ? '' : 'on'} aria-pressed={!exemptOnly} onClick={() => p.onExemptOnly(false)}>全科目 {EXAM.perExam}問</button>
          <button className={exemptOnly ? 'on' : ''} aria-pressed={exemptOnly} onClick={() => p.onExemptOnly(true)} data-exempt="on">{EXAM.exempt.label}</button>
        </div>
      )}
      {exemptOnly && EXAM.exempt && <p className="muted small">{EXAM.exempt.note}</p>}
      {est ? (
        <>
          <div className="fc-row">
            <p className="fc-score"><b>{est.score}</b><span>/ {est.total}点</span></p>
            <p className="fc-pass"><small>{est.passExam ? '合格点' : '合格ライン'}</small><b>{est.pass}</b></p>
          </div>
          <div className="fc-bar" aria-hidden>
            <i className={est.score >= est.pass ? 'good' : ''} style={{ width: `${(est.score / est.total) * 100}%` }} />
            <em style={{ left: `${(est.pass / est.total) * 100}%` }}><span>{est.passExam ? '合格点' : '合格'} {est.pass}</span></em>
          </div>
          <p className={`fc-verdict ${est.score >= est.pass ? 'good' : 'bad'}`}>
            {est.score >= est.pass ? `${lineName}を ${est.score - est.pass}点 上回っています。この調子で苦手を減らしましょう。` : `${lineName}まで あと${est.pass - est.score}点。苦手の多い科目から解きましょう。`}
          </p>
          {est.passExam && (
            <p className="muted small fc-line">直近の合格点 {est.pass}点(第{est.passExam}回)。合格点は回ごとの難しさで変わります(6割なら{est.ratioPass}点)。</p>
          )}
          {sub && (
            <p className={`fc-sub ${sub.score >= sub.pass ? 'good' : 'bad'}`}>
              {sub.label} {sub.score}/{sub.total}点(基準の目安 {sub.pass}点){sub.score >= sub.pass ? '' : ` あと${sub.pass - sub.score}点`}
            </p>
          )}
          {est.coverage < 1 && <p className="muted small">まだ解いていない科目は、ほかの科目の正答率で見積もっています</p>}
        </>
      ) : (
        <p className="muted fc-wait">あと {Math.max(0, 30 - seen)}問 解くと、いまの実力で本番を受けたときの点数を出します。</p>
      )}
      {p.more && <button className="more-link" onClick={p.more}>科目ごとの正答率を見る<IChevron size={16} /></button>}
    </section>
  );
}

/** 科目ごとの正答率(色の棒)。押すとその科目を解く */
export function SubjectBars(p: { data: AppData; open: Question[]; onSubject: (s: string) => void }) {
  const exemptOnly = !!(EXAM.exempt && p.data.settings.exemptOnly);
  const view = useMemo(() => examView(EXAM, exemptOnly), [exemptOnly]);
  const stats = useMemo(() => subjectStats(p.open, p.data, view), [p.open, p.data, view]);
  const seen = stats.reduce((s, x) => s + x.seen, 0);
  const okAll = stats.reduce((s, x) => s + x.lastOk, 0);
  return (
    <section className="card">
      <h2 className="card-title"><IChart className="red" />科目ごとの正答率</h2>
      <ul className="subjects">
        <li className="subj-all"><span className="subj-name">全体</span><span className="subj-rate">{seen ? `${Math.round((okAll / seen) * 100)}%` : '—'}</span>
          <span className="subj-bar"><i style={{ width: `${seen ? (okAll / seen) * 100 : 0}%`, background: '#e8524f' }} /><em style={{ left: `${EXAM.passRatio * 100}%` }} /></span></li>
        {stats.map((s, i) => (
          <li key={s.subject}>
            <button className="subj-row" onClick={() => p.onSubject(s.subject)} disabled={s.total === 0}>
              <span className="subj-name">{short(s.subject)}{s.nigate ? <small className="subj-ng">苦手{s.nigate}</small> : null}</span>
              <span className="subj-rate">{s.rate === null ? '—' : `${Math.round(s.rate * 100)}%`}</span>
              <span className="subj-bar">
                <i style={{ width: `${(s.rate ?? 0) * 100}%`, background: subjectColor(i) }} />
                <em style={{ left: `${EXAM.passRatio * 100}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="muted small">最後に解いたときの結果で数えています。{view.passScores ? '点線は正答率6割の目安で、合格点ではありません。' : '点線は合格基準の6割。'}{view.groups ? `本番は${view.groups.length}つの科目群のうち1つでも0点があると不合格です。` : ''}</p>
    </section>
  );
}

/** 試験日まで あと N日(チューリップの絵) */
export function ExamDateCard({ data, onSet }: { data: AppData; onSet: () => void }) {
  const left = daysLeft(data.settings.examDate, Date.now());
  return (
    <button className="card date-card" onClick={onSet} aria-label="試験日">
      <span className="date-ico"><ICalendar size={26} /></span>
      <span className="date-body">
        <span className="date-label">試験日まで</span>
        {left !== null
          ? <><span className="date-num">あと <b>{left}</b> 日</span><span className="date-day">{fmtDate(data.settings.examDate)}</span></>
          : <span className="date-num small-num">試験日を入れる</span>}
      </span>
      <img className="date-art" src={ART.tulip} alt="" />
    </button>
  );
}

/** 丸い正答率のグラフ */
export function Ring({ ok, total, label }: { ok: number; total: number; label?: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const v = total ? ok / total : 0;
  return (
    <div className="ring">
      <svg viewBox="0 0 128 128" width="150" height="150" aria-hidden>
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f3e3e0" strokeWidth="12" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="#d6383a" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 64 64)" />
      </svg>
      <div className="ring-txt"><b>{ok}</b><span>/ {total} {label ?? '問'}</span><small>正解率 {Math.round(v * 100)}%</small></div>
    </div>
  );
}
