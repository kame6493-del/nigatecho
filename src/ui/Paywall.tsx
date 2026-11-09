import { useState } from 'react';
import type { AppData, Question } from '../domain/types';
import { EXAM, EXAMS, SINGLE, bundleOffer, short } from '../domain/exam';
import { dayKey, examRange, isLocked } from '../domain/study';
import { jpDate, lockedPreview, partRows, seasonFacts, subPassGrowth, subPassMine, weakSubjectGrowth } from '../domain/upsell';
import { canBuy, canBuyBundle, purchase, purchaseBundle, restore, setAttrs, type BillingState } from '../platform/billing';
import { boughtAttrs } from '../domain/track';
import { TopBar } from './parts';
import { lookOf } from './look';
import { ICheck, ILock } from './Icons';

/** いま選んでいる試験の完全版。商品は試験ごとに別(買った試験だけが開く) */
export function Paywall(p: {
  billing: BillingState; all: Question[];
  /** 本人の記録(増える分を、本人の苦手の科目で具体的に見せる)。無ければ出さない */
  data?: AppData;
  /** どこから開いたか(買ったときに購入管理の属性 bought_from に入れる) */
  from?: string;
  onClose: () => void; onBought: () => void; setBilling: (b: BillingState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const exams = [...new Set(p.all.map((q) => q.exam))].sort((a, b) => a - b);
  const free = p.all.filter((q) => EXAM.freeExams.includes(q.exam)).length;
  const price = p.billing.status === 'ready' ? p.billing.prices[EXAM.productId] ?? '' : '';
  const owned = !!p.billing.access[EXAM.dir];
  /**
   * セット(介護福祉士・社会福祉士・精神保健福祉士)。いまの試験が入っていて、3つのどれも持っておらず、ストアにセットの商品があるときだけ出す。
   * どれか1つでも買った人には出さない(二重に払わせない)。値段はストアの priceString のまま
   */
  const offer = !owned ? bundleOffer(EXAM.dir, p.billing.access) : undefined;
  const set = offer && canBuyBundle(p.billing, offer) ? offer : undefined;
  const setPrice = set && p.billing.status === 'ready' ? p.billing.prices[set.productId] ?? '' : '';
  const setNames = set ? set.exams.map((d) => EXAMS.find((e) => e.dir === d)?.name ?? d) : [];
  const freeRounds = EXAM.freeExams.filter((e) => exams.includes(e));
  const lockedRounds = exams.filter((e) => !freeRounds.includes(e));
  /** 本人の記録から: 苦手の多い科目の問題が、いま何問で完全版で何問になるか(実際の問題数だけ) */
  /** 看護師の必修問題(8割の基準)が何問から何問になるか */
  const sub = subPassGrowth(p.all, EXAM);
  const growth = !owned && p.data
    ? weakSubjectGrowth(p.all, p.all.filter((q) => !isLocked(q, false, EXAM)), p.data)
    : null;
  /** 看護師: 無料の回の必修の本人の正答と、まだ解いていない回の必修(本物の問題を1問、問題文だけ) */
  const subMine = !owned && p.data ? subPassMine(p.all, p.data, EXAM, (q) => isLocked(q, false, EXAM)) : null;
  const subPreview = subMine
    ? lockedPreview(p.all, (q) => isLocked(q, false, EXAM) && !p.data!.records[q.id], EXAM.subPass?.subjects ?? [], dayKey(Date.now()))
    : null;
  /** 看護師: 必修問題・一般問題・状況設定問題が、無料と完全版でそれぞれ何問か(問題データから数える) */
  const parts = !owned ? partRows(p.all, EXAM) : null;
  const caseRow = parts?.find((r) => r.key === 'case');
  /** 管理栄養士・看護師: 試験までの日数と願書の受付期間(その日の日付から) */
  const season = !owned ? seasonFacts(EXAM, Date.now()) : null;
  /** 社会福祉士: セットを上に出す(セットが買えるときだけ) */
  const setFirst = !!set && !!set.first?.includes(EXAM.dir);
  const setRows = setFirst && set ? [EXAM.dir, ...set.exams.filter((d) => d !== EXAM.dir && d !== 'kaigo'), ...set.exams.filter((d) => d !== EXAM.dir && d === 'kaigo')].map((d) => {
    const e = EXAMS.find((x) => x.dir === d);
    const rs = e?.rounds ?? [];
    const range = rs.length ? (rs.length === 2 ? `第${rs[0]}・${rs[1]}回` : examRange(rs[0], rs[rs.length - 1])) : '';
    return { dir: d, name: e?.name ?? d, range, count: e?.count ?? 0, am: e?.sessionCounts?.['午前'] ?? 0, pm: e?.sessionCounts?.['午後'] ?? 0 };
  }) : [];

  const buy = async () => {
    setBusy(true); setMsg('');
    try {
      if (await purchase(p.billing, EXAM)) {
        setAttrs(boughtAttrs(EXAM.dir, p.from ?? 'other'));
        p.onBought();
      }
    } catch (e) {
      setMsg(`購入できませんでした(${(e as Error).message ?? e})`);
    } finally { setBusy(false); }
  };
  const buySet = async () => {
    if (!set) return;
    setBusy(true); setMsg('');
    try {
      if (await purchaseBundle(p.billing, set)) {
        setAttrs(boughtAttrs(`set_${set.id}`, p.from ?? 'other'));
        p.onBought();
      }
    } catch (e) {
      setMsg(`購入できませんでした(${(e as Error).message ?? e})`);
    } finally { setBusy(false); }
  };
  const doRestore = async () => {
    setBusy(true); setMsg('');
    try {
      const names = await restore();
      if (names.length) p.onBought();
      else setMsg('このアカウントでの購入は見つかりませんでした');
    } catch (e) {
      setMsg(`復元できませんでした(${(e as Error).message ?? e})`);
    } finally { setBusy(false); }
  };

  return (
    <div className="page paywall">
      <TopBar title={`${EXAM.name} 完全版`} onClose={p.onClose} close="x" />
      {setFirst && set && (
        <section className="card pw-setfirst" data-upsell="paywall-set-first">
          <p className="pw-mine-title">{EXAM.name}を受ける人に</p>
          <h3>{setNames.length}つセットで開く問題</h3>
          {setRows.map((r) => (
            <div className="pw-set-row" key={r.dir} data-exam={r.dir}>
              <p><span>{r.name}</span><b>{r.range} {r.count.toLocaleString('ja-JP')}問</b></p>
              {r.dir === 'seishin' && r.am > 0 && <small>共通科目{r.am}問は社会福祉士の第37・38回と同じ問題です。新しく解けるのは専門科目{r.pm}問です</small>}
              {r.dir === EXAM.dir && lockedRounds.length > 0 && <small>第{freeRounds.join('・')}回は無料、{examRange(lockedRounds[0], lockedRounds[lockedRounds.length - 1])}の{p.all.length - free}問が開きます</small>}
            </div>
          ))}
          <p className="muted small pw-setfirst-note">{EXAM.name}だけの完全版も、下で選べます</p>
        </section>
      )}
      <section className="pw-hero" style={{ background: lookOf(EXAM.dir).tint }}>
        <img className="pw-art" src={lookOf(EXAM.dir).img} alt="" />
        <p className="pw-kicker">{EXAM.name}・買い切り・月額なし</p>
        {season && (
          <div className="pw-season" data-upsell="paywall-season">
            <p className="pw-season-days">{season.examLabel}の試験まで あと{season.days}日</p>
            <p className="pw-season-sub"><span>試験日 {jpDate(season.examDate)}</span></p>
            {season.apply && (
              <p className="pw-season-sub"><span>{season.apply.state === 'open'
                ? `願書の受付は ${jpDate(season.apply.to, Date.now())}まで`
                : `願書の受付 ${jpDate(season.apply.from, Date.now())}〜${jpDate(season.apply.to, Date.now())}`}</span>{season.apply.note && <span>({season.apply.note})</span>}</p>
            )}
          </div>
        )}
        <h2>{exams.length}年分 {p.all.length}問で、<br />苦手を本番までに0へ。</h2>
        <ul className="checks">
          <li><ICheck size={16} />{lockedRounds.length ? `${examRange(lockedRounds[0], lockedRounds[lockedRounds.length - 1])}の過去問 ${p.all.length - free}問が増える` : `${examRange(exams[0], exams[exams.length - 1])}の過去問すべて`}</li>
          {sub && <li data-upsell="paywall-subpass"><ICheck size={16} />{sub.label}({Math.round(sub.ratio * 10)}割が基準)が {sub.now}問 → {sub.full}問に</li>}
          {caseRow && caseRow.full > caseRow.free && <li data-upsell="paywall-case"><ICheck size={16} />{caseRow.label}(事例つき)が {caseRow.free}問 → {caseRow.full}問に</li>}
          <li><ICheck size={16} />本番形式の模試が{exams.length}回分に</li>
          <li><ICheck size={16} />増えた分も解説・苦手ノート・予想点に入る</li>
        </ul>
      </section>
      {parts && (
        <section className="card pw-parts" data-upsell="paywall-parts">
          <p className="pw-mine-title">本番と同じ3つの区分で</p>
          <table className="pw-parts-table">
            <thead><tr><th></th><th>無料<br /><small>第{freeRounds.join('・')}回</small></th><th>完全版<br /><small>{examRange(exams[0], exams[exams.length - 1])}</small></th></tr></thead>
            <tbody>
              {parts.map((r) => (
                <tr key={r.key} data-part={r.key}>
                  <td>{r.label}{r.ratio ? <small>{Math.round(r.ratio * 10)}割が基準</small> : r.key === 'case' ? <small>事例を読んで答える</small> : null}</td>
                  <td>{r.free}問</td>
                  <td><b>{r.full}問</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {subMine && (
        <section className="card pw-sub" data-upsell="paywall-subpass-mine">
          <p className="pw-mine-title">あなたの{subMine.label}({Math.round(subMine.ratio * 10)}割が基準)</p>
          <p className="pw-mine-row"><span>第{subMine.freeRounds.join('・')}回(無料)の{subMine.label}</span>
            <b>{subMine.seen > 0 ? `${subMine.seen}問中 ${subMine.ok}問正解(${Math.round((subMine.ok / subMine.seen) * 100)}%)` : `${subMine.freeTotal}問 まだ解いていません`}</b></p>
          {subMine.seen > 0 && subMine.seen < subMine.freeTotal && <p className="pw-mine-row"><span>第{subMine.freeRounds.join('・')}回の{subMine.label}の残り</span><b>あと {subMine.freeTotal - subMine.seen}問(無料)</b></p>}
          <p className="pw-mine-row"><span>まだ解いていない回の{subMine.label}</span><b>{examRange(subMine.lockedRounds[0], subMine.lockedRounds[subMine.lockedRounds.length - 1])} {subMine.lockedUnseen}問</b></p>
          {subPreview && (
            <div className="lp-card pw-sub-q" data-qid={subPreview.id}>
              <p className="lp-src">第{subPreview.exam}回 {subPreview.session} 問{subPreview.no}・{short(subPreview.subject)}(完全版の問題)</p>
              <p className="lp-stem">{subPreview.stem}</p>
              <p className="lp-hidden"><ILock size={15} />選択肢({subPreview.choices.length}つ)・正解・解説は完全版で</p>
            </div>
          )}
        </section>
      )}
      {growth && (
        <section className="card pw-mine" data-upsell="paywall-mine">
          <p className="pw-mine-title">あなたの記録では</p>
          <p className="pw-mine-row"><span>{growth.nigate > 0 ? '苦手の多い' : '正答率の低い'} {short(growth.subject)}</span><b>いま {growth.now}問 → 完全版で {growth.full}問</b></p>
          <p className="pw-mine-row"><span>本番形式の模試</span><b>いま {freeRounds.length}回分 → 完全版で {exams.length}回分</b></p>
        </section>
      )}
      <table className="pw-table">
        <thead><tr><th></th><th>無料</th><th>完全版</th></tr></thead>
        <tbody>
          <tr><td>過去問</td><td>第{freeRounds.join('・')}回 {free}問</td><td>{examRange(exams[0], exams[exams.length - 1])} {p.all.length}問</td></tr>
          <tr><td>本番形式の模試</td><td>{freeRounds.length}回分<br /><small>(第{freeRounds.join("・")}回)</small></td><td>{exams.length}回分</td></tr>
          <tr><td>解説・苦手の自動復習・予想点・広告なし</td><td colSpan={2} className="pw-both">どちらも同じ</td></tr>
        </tbody>
      </table>
      <div className="pw-cta">
        {owned ? (
          <p className="pw-owned">{EXAM.name}の完全版は購入済みです</p>
        ) : p.billing.status === 'ready' && set ? (
          <div className={`pw-opts${setFirst ? ' set-first' : ''}`} data-set={set.id}>
            <button className="pw-opt" disabled={busy || !canBuy(p.billing, EXAM)} onClick={buy} data-buy="single">
              <span className="pw-opt-name"><b>{EXAM.name}だけ</b><small>{EXAM.name}の完全版</small></span>
              <span className="pw-opt-price">{busy ? '処理中…' : price || '完全版'}</span>
            </button>
            <button className="pw-opt set" disabled={busy} onClick={buySet} data-buy="set">
              <span className="pw-opt-name"><b>{setNames.length}つセット</b><small>{setNames.join('・')}の完全版がすべて開きます</small></span>
              <span className="pw-opt-price">{busy ? '処理中…' : setPrice || 'セット'}</span>
            </button>
            <p className="muted small pw-opts-note">どちらも買い切り(1回だけ)。押すとストアの確認が出ます</p>
          </div>
        ) : p.billing.status === 'ready' ? (
          <button className="btn primary wide big" disabled={busy || !canBuy(p.billing, EXAM)} onClick={buy}>
            {busy ? '処理中…' : `${price || '完全版'} で買う(1回だけ)`}
          </button>
        ) : (
          <button className="btn wide big" disabled>{p.billing.reason}</button>
        )}
        <button className="link" disabled={busy} onClick={doRestore}>以前に買った方はこちら(購入の復元)</button>
        {msg && <p className="err">{msg}</p>}
      </div>
      {EXAM.paywallNote && <p className="muted small">{EXAM.paywallNote}</p>}
      {!SINGLE && <p className="muted small">{set ? `「${EXAM.name}だけ」で開くのは${EXAM.name}の問題だけです。「${setNames.length}つセット」は1回の購入で${setNames.join('・')}の${setNames.length}つの完全版が開きます。` : `この完全版で開くのは${EXAM.name}の問題だけです。ほかの試験の完全版は、それぞれの試験の画面から別に購入できます。`}</p>}
      <p className="muted small">一度買えば、同じストアのアカウントの機種変更後も「購入の復元」で使えます。解いた記録はこの端末の中だけに保存し、外へ送りません。購入の管理には、選んだ試験・購入画面を開いた場所と回数・解いた問題の数だけを匿名の識別子と一緒に送ります(個人を特定する情報は送りません)。</p>
    </div>
  );
}
