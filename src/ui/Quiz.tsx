import { useEffect, useMemo, useState } from 'react';
import type { AppData, MockResult, Question } from '../domain/types';
import { EXAM, short, yearOf } from '../domain/exam';
import { CLEAR_STREAK, examRange, isCorrect, isLocked, isNigate, lockedSummary, passScoreOf, pickCount, pointsOf, zeroGroups } from '../domain/study';
import { splitExplanation } from '../domain/explain';
import { buzz } from '../platform/native';
import type { SessionEnd } from '../domain/review';
import { isMhlw, orgOf, sourceLabelOf, sourcePageFor } from '../domain/sources';
import { ART } from './look';
import { Ring, TopBar } from './parts';
import { IArrow, IBookmark, IBulb, ICheck, IChevron, IDoc, IRepeat, IX, IBook } from './Icons';

export { TopBar } from './parts';

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
  /** 解き終えたとき(評価のお願いの時機を決める) */
  onEnd: (e: SessionEnd) => void;
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

/* ---------- 練習: 選んで答え合わせ → 解説 ---------- */

function Practice(p: Props & { qs: Question[] }) {
  const { qs } = p;
  const [order, setOrder] = useState(qs);
  const [i, setI] = useState(0);
  /** 答え合わせした選択。null なら答え合わせ前 */
  const [picked, setPicked] = useState<number[] | null>(null);
  /** 答え合わせ前に選んでいる番号 */
  const [sel, setSel] = useState<number[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [finished, setFinished] = useState(false);
  const q = order[i];

  useEffect(() => { window.scrollTo(0, 0); }, [i, finished, picked]);

  if (finished) {
    const ok = done.filter((d) => d.ok).length;
    const cleared = done.filter((d) => d.wasNigate && !isNigate(p.data.records[d.id])).length;
    const fresh = done.filter((d) => !d.wasNigate && isNigate(p.data.records[d.id])).length;
    const nigateLeft = Object.values(p.data.records).filter(isNigate).length;
    const skipped = order.length - done.length;
    const rate = done.length ? ok / done.length : 0;
    return (
      <div className="page result">
        <TopBar title={`${p.session.title} 結果`} onClose={p.onClose} close="x" />
        <section className="result-hero">
          <Ring ok={ok} total={done.length} />
          <div className="cheer">
            <p className="bubble">{rate >= 0.8 ? 'よくがんばりました!\nこの調子で続けましょう。' : rate >= 0.5 ? 'よくがんばりました!\n苦手を見直して\n次につなげましょう。' : '間違えた問題は\n苦手ノートに残りました。\n1つずつ消していきましょう。'}</p>
            <img src={ART.womanCheer} alt="" />
          </div>
          <div className="result-score"><b>{ok}</b><span>/ {done.length} 問 正解</span></div>
        </section>
        <ul className="tally card">
          <li><span className="t-ok"><ICheck size={16} /></span>正解<b>{ok}<small>問</small></b></li>
          <li><span className="t-ng"><IX size={16} /></span>不正解<b>{done.length - ok}<small>問</small></b></li>
          {skipped > 0 && <li><span className="t-na">−</span>採点対象外<b>{skipped}<small>問</small></b></li>}
        </ul>
        <ul className="result-moves card">
          <li><span>苦手から外れた</span><b className="good">{cleared}問</b></li>
          <li><span>新しく苦手に入った</span><b className="bad">{fresh}問</b></li>
          <li><span>残りの苦手</span><b>{nigateLeft}問</b></li>
        </ul>
        <ol className="result-list card">
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
          {nigateLeft > 0 && <button className="btn soft-red" onClick={p.onNigate}><IDoc size={20} />間違えた問題を復習する(苦手を解く {nigateLeft}問)</button>}
          <button className="btn soft-red" onClick={() => { setOrder(order.slice()); setI(0); setPicked(null); setSel([]); setDone([]); setFinished(false); }}><IRepeat size={20} />もう一度同じ問題で解く</button>
          <button className="btn" onClick={p.onHome}><IBook size={20} />ホームへ戻る</button>
        </div>
        <FullVersionNote {...p} qs={qs} />
      </div>
    );
  }

  if (!q) return <div className="page"><TopBar title={p.session.title} onClose={p.onClose} close="x" /><p className="empty">解ける問題がありません。</p></div>;

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
    if (need === 1) { setSel([n]); return; }
    setSel((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : cur.length < need ? [...cur, n] : cur));
  };

  const next = () => {
    if (i + 1 >= order.length) {
      setFinished(true);
      const n = done.length || 1;
      p.onEnd({
        cleared: done.filter((d) => d.wasNigate && !isNigate(p.data.records[d.id])).length,
        nigateLeft: Object.values(p.data.records).filter(isNigate).length,
        correctRate: done.filter((d) => d.ok).length / n,
      });
      return;
    }
    setI(i + 1);
    setPicked(null);
    setSel([]);
  };

  const head = (
    <>
      <TopBar title={reveal ? '解説' : p.session.title} onClose={p.onClose} close="x"
        right={<button className={`icon mark-btn ${marked ? 'on' : ''}`} onClick={() => p.onMark(q.id)} aria-label="しるし" aria-pressed={marked}><IBookmark on={marked} /></button>} />
      <div className="progress-row">
        <div className="progress"><i style={{ width: `${((i + (reveal ? 1 : 0)) / order.length) * 100}%` }} /></div>
        <span className="count">{i + 1}<small> / {order.length}</small></span>
      </div>
    </>
  );

  if (reveal) {
    const last = done[done.length - 1];
    return (
      <div className="page quiz explain-page">
        {head}
        <p className="q-src-line"><span className="q-src">第{q.exam}回 {q.session} 問{q.no}</span>({yearOf(q.exam)}年)・{short(q.subject)}</p>
        <Verdict q={q} ok={ok} />
        {!q.excluded && last?.id === q.id && <NigateStatus q={q} data={p.data} ok={ok} wasNigate={last.wasNigate} />}
        <details className="q-again">
          <summary>問題文を見る</summary>
          <QuestionView q={q} />
        </details>
        <Explanation q={q} picked={picked!} />
        <SourceLine q={q} onSources={p.onSources} />
        <div className="bottom-bar two">
          <button className={`btn mark-wide ${marked ? 'on' : ''}`} onClick={() => p.onMark(q.id)} aria-pressed={marked}><IBookmark on={marked} size={20} />しるし</button>
          <button className="btn primary next" onClick={next}>{i + 1 >= order.length ? '結果を見る' : '次の問題へ'}<IArrow size={18} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="page quiz">
      {head}
      <QuestionView q={q} record={p.data.records[q.id]} />
      <ol className="choices">
        {q.choices.map((c, k) => {
          const n = k + 1;
          return (
            <li key={k}>
              <button className={`choice ${sel.includes(n) ? 'is-picked' : ''}`} onClick={() => choose(n)} aria-pressed={sel.includes(n)}>
                <span className="num">{n}</span>
                <span className="txt">{c}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {q.footnote && <p className="footnote">{q.footnote}</p>}
      <div className="bottom-bar two">
        <button className={`btn mark-wide ${marked ? 'on' : ''}`} onClick={() => p.onMark(q.id)} aria-pressed={marked}><IBookmark on={marked} size={20} />しるし</button>
        <button className="btn primary next" disabled={sel.length !== need} onClick={() => judge(sel)}>
          {sel.length === need ? <>答え合わせをする<IArrow size={18} /></> : need === 1 ? '答えを選んでください' : `${need}つ選んでください(あと${need - sel.length}つ)`}
        </button>
      </div>
    </div>
  );
}

/** 正解・不正解の帯 */
function Verdict({ q, ok }: { q: Question; ok: boolean }) {
  const ans = q.answer.length ? `正答 ${q.answer.join('・')}` : '正答なし(全員正解の扱い)';
  if (q.excluded) {
    return <section className="verdict neutral"><h3>採点対象外の問題<span>{ans}</span></h3>{q.note && <p className="note">{q.note}</p>}</section>;
  }
  return (
    <section className={`verdict ${ok ? 'good' : 'bad'}`}>
      <div className="v-main">
        <span className="v-mark">{ok ? '○' : '×'}</span>
        <div>
          <h3>{ok ? '正解!' : '不正解'}<span>{ans}</span></h3>
          <p className="v-sub">{ok ? 'よくできました!' : 'この問題は苦手ノートに残ります'}</p>
        </div>
      </div>
      {ok && <img className="v-art" src={ART.girlOk} alt="" />}
      {q.note && <p className="note">{q.note}</p>}
    </section>
  );
}

/** この問題の苦手ノートでの状態(連続正解 1/2 など)。2回続けて正解すると消える */
function NigateStatus({ q, data, ok, wasNigate }: { q: Question; data: AppData; ok: boolean; wasNigate: boolean }) {
  const r = data.records[q.id];
  if (!r) return null;
  const cleared = wasNigate && !isNigate(r);
  if (!cleared && !isNigate(r)) return null;
  const st = cleared ? CLEAR_STREAK : r.streak;
  return (
    <section className={`status ${cleared ? 'cleared' : ''}`}>
      {cleared && (
        <div className="status-party">
          <p>やったね!<br />苦手を克服しました!</p>
          <img src={ART.birdParty} alt="" />
        </div>
      )}
      <p className="status-label">この問題のステータス</p>
      <div className="status-box">
        {!cleared && ok && <p className="status-hint">あと1回で<br />ノートから消えます!</p>}
        <div className="dots" aria-hidden>
          {Array.from({ length: CLEAR_STREAK }, (_, k) => <i key={k} className={k < st ? 'on' : ''} />)}
        </div>
        <p className="dots-cap">連続正解 <b>{st}</b> / {CLEAR_STREAK}</p>
      </div>
      <p className={`status-note ${cleared ? 'good' : ''}`}>
        {cleared
          ? 'この問題は苦手ノートから消えました。'
          : ok ? 'もう一度、同じ問題に正解すると苦手ノートから消えます。この調子でがんばりましょう!'
            : '苦手ノートに入りました。同じ問題に2回続けて正解すると消えます。'}
      </p>
    </section>
  );
}

/** 解説: 正答の理由と、選択肢ごとの理由(解説の文は変えずに見出しで分けるだけ) */
function Explanation({ q, picked }: { q: Question; picked: number[] }) {
  const parts = splitExplanation(q.explanation);
  const byNo = new Map(parts.choices.map((c) => [c.no, c]));
  return (
    <>
      <section className="card exp-card">
        <h2 className="card-title"><IBulb className="gold" />{parts.parsed ? '正答の理由' : '解説'}</h2>
        <div className="explain">{parts.reason || '解説は準備中です。'}</div>
      </section>
      <section className="card exp-card">
        <h2 className="card-title"><IDoc className="red" />選択肢ごとの解説</h2>
        <ol className="ans-list">
          {q.choices.map((c, k) => {
            const n = k + 1;
            const isAns = q.answer.includes(n);
            const mine = picked.includes(n);
            const why = byNo.get(n);
            return (
              <li key={k} className={`ans-choice ${isAns ? 'is-answer' : mine ? 'is-wrong' : ''}`}>
                <div className="ans-head">
                  <span className="num">{n}</span>
                  {q.answer.length > 0 && (isAns ? <span className="tag ok">正答</span> : <span className="tag ng">誤り</span>)}
                  {mine && <span className="tag mine">あなたの答え</span>}
                </div>
                <p className="ans-txt">{c}</p>
                {why && <p className="ans-why">{why.text}</p>}
              </li>
            );
          })}
        </ol>
      </section>
    </>
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
    // 模試は苦手の出入りを数えない(前の版と同じ「よく解けた回」だけで見る)
    p.onEnd({ cleared: 0, nigateLeft: -1, correctRate: m.score / Math.max(1, m.total) });
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
        <TopBar title={`${p.session.title} 結果`} onClose={p.onClose} close="x" />
        <section className="result-hero">
          <Ring ok={result.score} total={result.total} label="点" />
          <div className="result-score"><b>{result.score}</b><span>/ {result.total} 点</span></div>
          <p className={`pass-line ${result.score >= pass ? 'good' : 'bad'}`}>{!ps.official ? '合格基準' : ps.exam === result.exam ? `第${result.exam}回の合格点` : `直近の合格点(第${ps.exam}回)`} {pass}点 に{result.score >= pass ? `${result.score - pass}点の余裕` : `あと${pass - result.score}点`}</p>
          {sp && subTotal > 0 && (
            <p className={`pass-line ${subOk ? 'good' : 'bad'}`}>{sp.label} {subScore}/{subTotal}点(基準の目安 {subPassPts}点){subOk ? '' : ` あと${subPassPts - subScore}点`}</p>
          )}
          {sp && <p className="muted small">合格は総得点と{sp.label}の両方の基準を満たしたとき。{passed ? '今回は両方とも届いています。' : ''}</p>}
          {EXAM.groups && (zeros.length === 0
            ? <p className="pass-line good">{EXAM.groups.length}科目群すべてで得点できています</p>
            : <p className="pass-line bad">0点の科目群があります: {zeros.join('/')}(1つでも0点だと総得点に関係なく不合格)</p>)}
          <p className="muted">かかった時間 {fmtTime(result.seconds)}・未回答 {qs.length - answeredCount}問</p>
        </section>
        <table className="subject-table card">
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
          <button className="btn soft-red" onClick={p.onNigate}><IDoc size={20} />間違えた{wrong.length}問を苦手から解く</button>
          <button className="btn" onClick={p.onHome}><IBook size={20} />ホームへ戻る</button>
        </div>
        <FullVersionNote {...p} qs={qs} />
      </div>
    );
  }

  if (!q) return <div className="page"><TopBar title={p.session.title} onClose={p.onClose} close="x" /><p className="empty">解ける問題がありません。</p></div>;

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
      <TopBar title={p.session.title} onClose={p.onClose} close="x" right={<span className="timer">{fmtTime(Math.round((now - startAt) / 1000))}</span>} />
      <div className="progress-row">
        <div className="progress"><i style={{ width: `${(answeredCount / qs.length) * 100}%` }} /></div>
        <button className="count link-count" onClick={() => setList(true)}>{i + 1}<small> / {qs.length}</small></button>
      </div>
      <div className="mock-nav">
        <button className="link" onClick={() => setList(true)}>問題の一覧(回答 {answeredCount})<IChevron size={14} /></button>
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
          ? <button className="btn primary" onClick={() => setI(i + 1)}>次へ<IArrow size={18} /></button>
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

/**
 * 結果の下の、完全版の案内(1枚だけ・押したときだけ購入画面へ)。
 * 出すのは、この試験を買っていない人が無料の回の問題を解き終えたときだけ。
 */
function FullVersionNote(p: Props & { qs: Question[] }) {
  if (p.premium || p.qs.length === 0 || p.qs.some((x) => isLocked(x, false, EXAM))) return null;
  const s = lockedSummary(p.byId.values(), EXAM);
  if (!s) return null;
  return (
    <section className="full-note">
      <p>{EXAM.name}の{examRange(s.from, s.to)}({s.count.toLocaleString('ja-JP')}問)と本番形式の模試は、完全版で解けます。</p>
      <button className="btn" onClick={p.onPaywall}>完全版を見る<IChevron size={16} /></button>
    </section>
  );
}

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

function QuestionView({ q, record }: { q: Question; record?: AppData['records'][string] }) {
  return (
    <section className="question">
      <div className="q-card">
        <div className="q-meta">
          <span className="q-src">第{q.exam}回 {q.session} 問{q.no}</span>
          <span className="q-year">({yearOf(q.exam)}年)</span>
          <span className="q-subj">{EXAM.name}・{short(q.subject)}</span>
        </div>
        {record && <span className={`q-hist ${isNigate(record) ? 'bad' : ''}`}>{isNigate(record) ? `苦手ノート・連続正解 ${record.streak}/${CLEAR_STREAK}` : `${record.n + 1}回目・これまで正解${record.ok}回`}</span>}
      </div>
      <span className="q-no">問{q.no}</span>
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

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}
