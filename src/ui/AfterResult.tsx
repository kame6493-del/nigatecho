import type { AppData, Question } from '../domain/types';
import { EXAM, short } from '../domain/exam';
import { afterResultView } from '../domain/afterResult';
import { IChevron } from './Icons';

/**
 * 結果の画面を出たあとに下から1枚出す「この試験の続き」(出す条件は domain/afterResult.ts)。
 * 値段は出さない。急がせる言葉・期限は書かない。閉じるボタンは押す所と同じ大きさで、外を押しても閉じる。
 */
export function AfterResultSheet(p: { all: Question[]; open: Question[]; data: AppData; onClose: () => void; onOpen: () => void }) {
  const v = afterResultView(p.all, p.open, p.data, EXAM, Date.now());
  if (!v) return null;
  return (
    <div className="sheet-backdrop after-result-backdrop" onClick={p.onClose}>
      <div className="sheet after-result" role="dialog" aria-modal="true" aria-labelledby="after-result-title" data-upsell="after-result" onClick={(e) => e.stopPropagation()}>
        <h3 id="after-result-title">{EXAM.name}の続き</h3>
        <p>{v.freeLeft > 0 ? '' : `無料の${v.freeRounds}は、全部解き終えました。`}{v.lockedRange}({v.lockedCount.toLocaleString('ja-JP')}問)と、その回の本番形式の模試は、完全版で解けます。</p>
        <ul className="full-progress" data-after-result="rows">
          <li data-row="free"><span>{v.freeRounds}(無料)の残り</span><b>あと {v.freeLeft}問</b></li>
          {v.weak && <li data-row="weak"><span>{v.weak.nigate > 0 ? '苦手の多い' : '正答率の低い'} {short(v.weak.subject)}</span><b>{v.weak.now}問 → 完全版 {v.weak.full}問</b></li>}
          {v.sub && <li data-row="sub"><span>{v.sub.label}(基準 {Math.round(v.sub.ratio * 10)}割)</span><b>{v.sub.now}問 → 完全版 {v.sub.full}問</b></li>}
          {v.plan && <li data-row="plan"><span>試験まで {v.plan.days}日</span><b>完全版 {v.plan.unseenFull.toLocaleString('ja-JP')}問 → 1日 {v.plan.perDay}問</b></li>}
        </ul>
        <div className="sheet-actions">
          <button className="btn" onClick={p.onClose} data-after-result="close">閉じる</button>
          <button className="btn primary" onClick={p.onOpen} data-after-result="open">完全版を見る<IChevron size={16} /></button>
        </div>
      </div>
    </div>
  );
}
