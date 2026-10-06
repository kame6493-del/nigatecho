import { useEffect, useMemo, useState } from 'react';
import type { AppData, MockResult, Question } from '../domain/types';
import { EXAM, short } from '../domain/exam';
import { isCorrect, isNigate, passScoreOf, pickCount, pointsOf, zeroGroups } from '../domain/study';
import { buzz } from '../platform/native';
import { isMhlw, orgOf, sourceLabelOf, sourcePageFor } from '../domain/sources';

export interface Session {
  title: string;
  ids: string[];
  mode: 'practice' | 'mock';
  /** 模試で解いた回 */
  exam?: number;
  seed: number;
}

interface Props {
  session: Session;
  byId: Map<string, Question>;
  data: AppData;
  premium: boolean;
  onAnswer: (q: Question, ok: boolean) => void;
  onMark: (id: string) => void;
  onMockDone: (m: MockResult, answers: { q: Question; ok: boolean }[]) => void;
  onEnd: (correctRate: number) => void;
  onClose: () => void;
  onHome: () => void;
  onNigate: () => void;
  onPaywall: () => void;
  /** 出典と参考文献の画面へ */
  onSources?: () => void;
}

interface Done { id: string; ok: boolean; wasNigate: boolean }

export function Quiz(p: Props) {
  const qs = useMemo(() => p.session.ids.map((id) => p.byId.get(id)).filter((q): q is Question => !!q), [p.session.ids, p.byId]);
  return p.session.mode === 'mock' ? <MockRun {...p} qs={qs} /> : <Practice {...p} qs={qs} />;
}

/* ---------- 練習: 1問ずつ答え合わせ ---------- */

function Practice(p: Props & { qs: Question[] }) {
  const { qs } = p;
  const [order, setOrder] = useState(qs);
  const [i, setI] = useState(0);
  /** 答え合わせした選択。null なら答え合わせ前 */
  const [picked, setPicked] = useState<number[] | null>(null);
  /** 2つ選ぶ問題で、答え合わせ前に選んでいる番号 */
  const [sel, setSel] = useState<number[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [finished, setFinished] = useState(false);
  const q = order[i];

  useEffect(() => { window.scrollTo(0, 0); }, [i, finished]);

  if (finished) {
    const ok = done.filter((d) => d.ok).length;
    const cleared = done.filter((d) => d.wasNigate && !isNigate(p.data.records[d.id])).length;
    const fresh = done.filter((d) => !d.wasNigate && isNigate(p.data.records[d.id])).length;
    const nigateLeft = Object.values(p.data.records).filter(isNigate).length;
    return (
      <div className="page result">
        <TopBar title={p.session.title} onClose={p.onClose} />
        <section className="result-hero">
          <div className="result-score"><b>{ok}</b><span>/ {done.length} 問 正解</span></div>
          <ul className="result-moves">
            <li><span>苦手から外れた</span><b className="good">{cleared}問</b></li>
            <li><span>新しく苦手に入った</span><b className="bad">{fresh}問</b></li>
            <li><span>残りの苦手</span><b>{nigateLeft}問</b></li>
          </ul>
        </section>
        <ol className="result-list">
          {done.map((d, k) => {
            const x = p.byId.get(d.id)!;
            return (
              <li key={d.id + k} className={d.ok ? 'ok' : 'ng'}>
                <span className="mark">{d.ok ? '○' : '×'}</span>
                <span className="src">第{x.exam}回 {x.session}{x.no}</span>
                <span className="subj">{short(x.subject)}</span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          {nigateLeft > 0 && <button className="btn primary" onClick={p.onNigate}>苦手を解く({nigateLeft}問)</button>}
          <button className="btn" onClick={() => { setOrder(order.slice()); setI(0); setPicked(null); setSel([]); setDone([]); setFinished(false); }}>同じ問題をもう一度</button>
          <button className="btn ghost" onClick={p.onHome}>ホームへ</button>
        </div>
      </div>
    );
  }

  if (!q) return <div className="page"><TopBar title={p.session.title} onClose={p.onClose} /><p className="empty">解ける問題がありません。</p></div>;

  const reveal = picked !== null;
  const ok = reveal && isCorrect(q, picked!);
  const marked = p.data.marks.includes(q.id);

  const need = pickCount(q);

  const judge = (xs: number[]) => {
    if (reveal) return;
    const good = isCorrect(q, xs);
    setPicked(xs);
    buzz(good);
    if (!q.excluded) {
      setDone((d) => [...d, { id: q.id, ok: good, wasNigate: isNigate(p.data.records[q.id]) }]);
      p.onAnswer(q, good);
    }
  };

  const choose = (n: number) => {
    if (reveal) return;
    if (need === 1) { judge([n]); return; }
    setSel((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : cur.length < need ? [...cur, n] : cur));
  };

  const next = () => {
    if (i + 1 >= order.length) {
      setFinished(true);
      const n = done.length || 1;
      p.onEnd(done.filter((d) => d.ok).length / n);
      return;
    }
    setI(i + 1);
    setPicked(null);
    setSel([]);
  };

  return (
    <div className="page quiz">
      <TopBar title={p.session.title} onClose={p.onClose} right={<span className="count">{i + 1}<small> / {order.length}</small></span>} />
      <div className="progress"><i style={{ width: `${((i + (reveal ? 1 : 0)) / order.length) * 100}%` }} /></div>
      <QuestionView q={q} record={p.data.records[q.id]} marked={marked} onMark={() => p.onMark(q.id)} />
      <ol className="choices">
        {q.choices.map((c, k) => {
          const n = k + 1;
          const isAns = q.answer.includes(n);
          const cls = !reveal ? (sel.includes(n) ? 'is-picked' : '') : isAns ? 'is-answer' : picked!.includes(n) ? 'is-wrong' : 'is-dim';
          return (
            <li key={k}>
              <button className={`choice ${cls}`} onClick={() => choose(n)} disabled={reveal}>
                <span className="num">{n}</span>
                <span className="txt">{c}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {q.footnote && <p className="footnote">{q.footnote}</p>}
      {reveal && (
        <section className={`verdict ${q.excluded ? 'neutral' : ok ? 'good' : 'bad'}`}>
          <h3>{q.excluded ? '採点対象外の問題' : ok ? '正解' : '不正解'}<span>{q.answer.length ? `正答 ${q.answer.join('・')}` : '正答なし(全員正解の扱い)'}</span></h3>
          {q.note && <p className="note">{q.note}</p>}
          <div className="explain">{q.explanation ?? '解説は準備中です。'}</div>
          <SourceLine q={q} onSources={p.onSources} />
        </section>
      )}
      <div className="bottom-bar">
        {reveal
          ? <button className="btn primary wide" onClick={next}>{i + 1 >= order.length ? '結果を見る' : '次の問題'}</button>
          : need === 1
            ? <p className="hint">答えだと思う番号を押してください</p>
            : <button className="btn primary wide" disabled={sel.length !== need} onClick={() => judge(sel)}>{sel.length === need ? '答え合わせ' : `${need}つ選んでください(あと${need - sel.length}つ)`}</button>}
      </div>
    </div>
  );
}

/* ---------- 模試: 最後にまとめて採点 ---------- */

function MockRun(p: Props & { qs: Question[] }) {
  const { qs } = p;
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<string, number[]>>({});
  const [startAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<MockResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [list, setList] = useState(false);
  const q = qs[i];

  useEffect(() => {
    if (result) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [result]);
  useEffect(() => { window.scrollTo(0, 0); }, [i, result]);

  /** 選ぶ数だけ選んだ問題を「回答済み」と数える */
  const answeredCount = qs.filter((x) => (ans[x.id]?.length ?? 0) >= pickCount(x)).length;
  const toggle = (x: Question, n: number) => {
    const need = pickCount(x);
    const cur = ans[x.id] ?? [];
    const next = need === 1 ? [n] : cur.includes(n) ? cur.filter((v) => v !== n) : cur.length < need ? [...cur, n] : cur;
    setAns({ ...ans, [x.id]: next });
  };

  const submit = () => {
    const scored = qs.filter((x) => !x.excluded);
    const answers = scored.map((x) => ({ q: x, ok: ans[x.id] !== undefined && isCorrect(x, ans[x.id]) }));
    const bySubject: MockResult['bySubject'] = {};
    for (const a of answers) {
      const s = (bySubject[a.q.subject] ??= { ok: 0, n: 0 });
      s.n += pointsOf(a.q);
      if (a.ok) s.ok += pointsOf(a.q);
    }
    const m: MockResult = {
      at: Date.now(),
      exam: p.session.exam ?? 0,
      score: answers.reduce((t, a) => t + (a.ok ? pointsOf(a.q) : 0), 0),
      total: answers.reduce((t, a) => t + pointsOf(a.q), 0),
      bySubject,
      seconds: Math.round((Date.now() - startAt) / 1000),
    };
    // 答えていない問題は記録に残さない(解いていない物を「苦手」にしない)
    p.onMockDone(m, answers.filter((a) => (ans[a.q.id]?.length ?? 0) > 0));
    setResult(m);
    p.onEnd(m.score / Math.max(1, m.total));
  };

  if (result) {
    const ps = passScoreOf(result.exam, result.total, EXAM);
    const pass = ps.score;
    // 総得点とは別の基準(理学療法士の実地問題)。解いた問題の配点から数える
    const sp = EXAM.subPass;
    const subQs = sp ? qs.filter((x) => !x.excluded && pointsOf(x) === sp.points) : [];
    const subTotal = subQs.reduce((t, x) => t + pointsOf(x), 0);
    const subScore = subQs.reduce((t, x) => t + (ans[x.id] !== undefined && isCorrect(x, ans[x.id]) ? pointsOf(x) : 0), 0);
    const subPassPts = sp ? Math.ceil(subTotal * sp.ratio) : 0;
    const subOk = !sp || subTotal === 0 || subScore >= subPassPts;
    const zeros = zeroGroups(result.bySubject, EXAM);
    const passed = result.score >= pass && subOk && zeros.length === 0;
    const wrong = qs.filter((x) => !x.excluded && !(ans[x.id] !== undefined && isCorrect(x, ans[x.id])));
    return (
      <div className="page result">
        <TopBar title={p.session.title} onClose={p.onClose} />
        <section className="result-hero">
          <div className="result-score"><b>{result.score}</b><span>/ {result.total} 点</span></div>
          <p className={`pass-line ${result.score >= pass ? 'good' : 'bad'}`}>{ps.official ? `第${result.exam}回の合格点` : '合格基準'} {pass}点 に{result.score >= pass ? `${result.score - pass}点の余裕` : `あと${pass - result.score}点`}</p>
          {sp && subTotal > 0 && (
            <p className={`pass-line ${subOk ? 'good' : 'bad'}`}>{sp.label} {subScore}/{subTotal}点(基準の目安 {subPassPts}点){subOk ? '' : ` あと${subPassPts - subScore}点`}</p>
          )}
          {sp && <p className="muted small">合格は総得点と{sp.label}の両方の基準を満たしたとき。{passed ? '今回は両方とも届いています。' : ''}</p>}
          {EXAM.groups && (zeros.length === 0
            ? <p className="pass-line good">{EXAM.groups.length}科目群すべてで得点できています</p>
            : <p className="pass-line bad">0点の科目群があります: {zeros.join('/')}(1つでも0点だと総得点に関係なく不合格)</p>)}
          <p className="muted">かかった時間 {fmtTime(result.seconds)}・未回答 {qs.length - answeredCount}問</p>
        </section>
        <table className="subject-table">
          <thead><tr><th>科目</th><th>得点</th><th>正答率</th></tr></thead>
          <tbody>
            {EXAM.subjects.filter((s) => result.bySubject[s]).map((s) => {
              const v = result.bySubject[s];
              const r = v.ok / v.n;
              return <tr key={s} className={r < EXAM.passRatio ? 'low' : ''}><td>{short(s)}</td><td>{v.ok}/{v.n}</td><td>{Math.round(r * 100)}%</td></tr>;
            })}
          </tbody>
        </table>
        <div className="result-actions">
          <button className="btn primary" onClick={p.onNigate}>間違えた{wrong.length}問を苦手から解く</button>
          <button className="btn ghost" onClick={p.onHome}>ホームへ</button>
        </div>
      </div>
    );
  }

  if (!q) return <div className="page"><TopBar title={p.session.title} onClose={p.onClose} /><p className="empty">解ける問題がありません。</p></div>;

  if (list) {
    return (
      <div className="page">
        <TopBar title="問題の一覧" onClose={() => setList(false)} />
        <div className="grid-nums">
          {qs.map((x, k) => (
            <button key={x.id} className={`${(ans[x.id]?.length ?? 0) >= pickCount(x) ? 'done' : ''} ${k === i ? 'cur' : ''}`} onClick={() => { setI(k); setList(false); }}>{k + 1}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page quiz">
      <TopBar
        title={p.session.title}
        onClose={p.onClose}
        right={<span className="timer">{fmtTime(Math.round((now - startAt) / 1000))}</span>}
      />
      <div className="progress"><i style={{ width: `${(answeredCount / qs.length) * 100}%` }} /></div>
      <div className="mock-nav">
        <button className="link" onClick={() => setList(true)}>{i + 1} / {qs.length}(回答 {answeredCount})</button>
      </div>
      <QuestionView q={q} />
      <ol className="choices">
        {q.choices.map((c, k) => (
          <li key={k}>
            <button className={`choice ${ans[q.id]?.includes(k + 1) ? 'is-picked' : ''}`} onClick={() => toggle(q, k + 1)}>
              <span className="num">{k + 1}</span><span className="txt">{c}</span>
            </button>
          </li>
        ))}
      </ol>
      {q.footnote && <p className="footnote">{q.footnote}</p>}
      <div className="bottom-bar two">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>前へ</button>
        {i + 1 < qs.length
          ? <button className="btn primary" onClick={() => setI(i + 1)}>次へ</button>
          : <button className="btn primary" onClick={() => setConfirm(true)}>採点する</button>}
      </div>
      {i + 1 < qs.length && <button className="link submit-early" onClick={() => setConfirm(true)}>ここで採点する</button>}
      {confirm && (
        <div className="sheet-backdrop" onClick={() => setConfirm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>採点しますか</h3>
            <p>{qs.length - answeredCount > 0 ? `まだ ${qs.length - answeredCount}問 答えていません。答えていない問題は不正解として数えます。` : '全問に答えました。'}</p>
            <div className="sheet-actions">
              <button className="btn" onClick={() => setConfirm(false)}>戻る</button>
              <button className="btn primary" onClick={() => { setConfirm(false); submit(); }}>採点する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 部品 ---------- */

/** 解説の下の出典。問題を公表した所(厚生労働省・社会福祉振興・試験センター)の掲載ページへのリンクつき */
function SourceLine({ q, onSources }: { q: Question; onSources?: () => void }) {
  const link = sourcePageFor(q.exam, EXAM);
  const org = orgOf(EXAM);
  return (
    <div className="source">
      {isMhlw(EXAM)
        ? <p>出典: {sourceLabelOf(q.exam, EXAM)}{q.session} 問題{q.no}(問題・正答)。解説は本アプリの独自作成です。</p>
        : <p>出典: {sourceLabelOf(q.exam, EXAM)} 問題{q.no}(問題・正答)。解説は本アプリの独自作成で、{org}とは関係ありません。</p>}
      <p className="source-links">
        {link && <a href={link.url} target="_blank" rel="noreferrer">{org}の問題・正答のページ</a>}
        {onSources && <button className="linkish" onClick={onSources}>出典と参考文献</button>}
      </p>
    </div>
  );
}

function QuestionView({ q, record, marked, onMark }: { q: Question; record?: AppData['records'][string]; marked?: boolean; onMark?: () => void }) {
  return (
    <section className="question">
      <div className="q-meta">
        <span className="q-src">第{q.exam}回 {q.session} 問{q.no}</span>
        <span className="q-subj">{short(q.subject)}</span>
        {record && <span className={`q-hist ${isNigate(record) ? 'bad' : ''}`}>{record.n}回目 ・ 正解{record.ok}</span>}
        {onMark && <button className={`star ${marked ? 'on' : ''}`} onClick={onMark} aria-label="しるし">{marked ? '★' : '☆'}</button>}
      </div>
      {q.case && (
        <details className="case" open>
          <summary>事例を読む</summary>
          <p>{q.case}</p>
        </details>
      )}
      <p className="stem">{q.stem}</p>
      {pickCount(q) > 1 && <p className="pick-note">{pickCount(q)}つ選ぶ問題です</p>}
      {q.figure && <img className="figure" src={`./data/${EXAM.dir}/${q.figure}`} alt="問題の図" />}
    </section>
  );
}

export function TopBar({ title, onClose, right }: { title: string; onClose: () => void; right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <button className="icon" onClick={onClose} aria-label="閉じる">‹</button>
      <h1>{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}
