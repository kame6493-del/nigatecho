import { useMemo, useState } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, short } from '../domain/exam';
import { CLEAR_STREAK, isNigate, nigateOrder } from '../domain/study';
import { ART, subjectColor } from './look';
import { IArrow, IChevron, IInfo } from './Icons';

/**
 * 苦手ノート(見本の4枚目)。間違えた問題が科目ごとに残り、同じ問題に2回続けて正解すると消える。
 * 並びは「苦手を解く」と同じ(続けて正解した数の少ない順)。鍵のかかった回の問題は出さない。
 */
export function NoteBook(p: {
  data: AppData; open: Question[];
  onSolve: (title: string, qs: Question[]) => void;
  onNigate: () => void;
  onRandom: () => void;
}) {
  const list = useMemo(() => nigateOrder(p.open, p.data), [p.open, p.data]);
  const groups = useMemo(() => EXAM.subjects
    .map((s, i) => ({ s, i, qs: list.filter((q) => q.subject === s) }))
    .filter((g) => g.qs.length > 0), [list]);
  const [filter, setFilter] = useState<string | null>(null);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const seen = p.open.some((q) => p.data.records[q.id]);
  const shown = filter ? groups.filter((g) => g.s === filter) : groups;

  return (
    <div className="page note-page">
      <header className="tab-head"><h1>苦手ノート</h1></header>
      <section className="note-rule">
        <IInfo size={20} />
        <p>まちがえた問題が残り、同じ問題に<b>2回続けて正解</b>するとノートから消えます。</p>
      </section>

      {list.length === 0 ? (
        <section className="card empty-note">
          <img src={seen ? ART.birdParty : ART.birdQ} alt="" />
          <p className="empty-title">{seen ? '苦手は 0問 です' : 'まだ苦手はありません'}</p>
          <p className="muted">{seen ? '本番に持っていく苦手はありません。新しい問題も解いてみましょう。' : '問題を解いて間違えると、ここに残ります。'}</p>
          <button className="btn primary wide" onClick={p.onRandom}>ランダム10問を解く<IArrow size={18} /></button>
        </section>
      ) : (
        <>
          <div className="chip-row" role="tablist" aria-label="科目でしぼる">
            <button className={filter === null ? 'on' : ''} onClick={() => setFilter(null)}>すべて({list.length})</button>
            {groups.map((g) => (
              <button key={g.s} className={filter === g.s ? 'on' : ''} onClick={() => setFilter(g.s)}>{short(g.s)} {g.qs.length}</button>
            ))}
          </div>
          {shown.map((g) => {
            const col = subjectColor(g.i);
            const isClosed = !!closed[g.s];
            return (
              <section key={g.s} className="note-group" style={{ ['--gc' as string]: col }}>
                <button className="note-head" onClick={() => setClosed({ ...closed, [g.s]: !isClosed })} aria-expanded={!isClosed}>
                  <span className="note-mark">{short(g.s).slice(0, 1)}</span>
                  <b>{short(g.s)}</b><span className="note-count">{g.qs.length}問</span>
                  <span className={`note-caret ${isClosed ? '' : 'open'}`}><IChevron size={18} /></span>
                </button>
                {!isClosed && (
                  <>
                    <ul className="note-items">
                      {g.qs.map((q) => {
                        const r = p.data.records[q.id];
                        const st = r && isNigate(r) ? r.streak : 0;
                        return (
                          <li key={q.id}>
                            <button onClick={() => p.onSolve('苦手ノート', [q])} data-qid={q.id}>
                              <span className="ni-dot" />
                              <span className="ni-body">
                                <span className="ni-stem">{q.stem.replace(/\s+/g, ' ')}</span>
                                <span className="ni-src">第{q.exam}回 {q.session} 問{q.no}</span>
                              </span>
                              <span className={`ni-streak ${st > 0 ? 'half' : ''}`}>連続正解 {st}/{CLEAR_STREAK}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <button className="note-solve" onClick={() => p.onSolve(`${short(g.s)} 苦手`, g.qs)}>この科目の苦手を解く({g.qs.length}問)<IChevron size={16} /></button>
                  </>
                )}
              </section>
            );
          })}
          <div className="bottom-bar over-tab">
            <button className="btn primary wide big" onClick={p.onNigate}>苦手をまとめて解く({Math.min(20, list.length)}問)<IArrow size={18} /></button>
          </div>
        </>
      )}
    </div>
  );
}
