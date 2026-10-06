import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import type { AppData, MockResult, Question, Settings } from './domain/types';
import { EXAM, selectExam } from './domain/exam';
import { isLocked, nigateOrder, record, rng, shuffle, toggleMark, unseen } from './domain/study';
import { loadData, loadExamChoice, loadReview, saveData, saveExamChoice, saveReview } from './platform/storage';
import { reviewOnSessionEnd, type SessionEnd } from './domain/review';
import { EMPTY_ACCESS, loadBilling, type BillingState } from './platform/billing';
import { askReview } from './platform/native';
import { Home } from './ui/Home';
import { Quiz, type Session } from './ui/Quiz';
import { ExamPicker, SubjectPicker } from './ui/Pickers';
import { Paywall } from './ui/Paywall';
import { SettingsPage } from './ui/SettingsPage';
import { MockHistory } from './ui/MockHistory';
import { SourcesPage } from './ui/SourcesPage';
import { ExamSwitch } from './ui/ExamSwitch';

export type Route =
  | { name: 'home' }
  | { name: 'quiz'; session: Session }
  | { name: 'exams'; mock: boolean }
  | { name: 'subjects' }
  | { name: 'paywall'; from: string }
  | { name: 'settings' }
  | { name: 'mocks' }
  | { name: 'sources' }
  | { name: 'switch' };

/** 評価のお願いの記録は読んで書くまでを1本ずつ(続けて解き終えても数え漏れない) */
let reviewChain: Promise<void> = Promise.resolve();

/** 試験をまたいで同じにする設定(文字の大きさ・毎日のお知らせ。お知らせは端末に1つだけ) */
type Carry = Pick<Settings, 'fontScale' | 'remind' | 'remindAt'>;

/**
 * 試験を選ぶ所。前に選んだ試験(無ければ管理栄養士)で開く。
 * 試験を替えたら、画面ごと作り直す(記録・問題・完全版は試験ごと)。
 */
export default function Root() {
  const [dir, setDir] = useState<string | null>(null);
  const [carry, setCarry] = useState<Carry | null>(null);

  useEffect(() => {
    loadExamChoice().then((d) => setDir(selectExam(d).dir));
  }, []);

  const switchExam = useCallback((next: string, c: Carry) => {
    // EXAM の切り替えと画面の作り直しを同じ瞬間にする(前の試験の画面を新しい試験の設定で描かない)
    const e = selectExam(next);
    saveExamChoice(e.dir).catch((err) => console.error('[nigatecho] save exam', err));
    setCarry(c);
    setDir(e.dir);
  }, []);

  if (!dir) return <div className="splash"><span>ニガテ帳</span></div>;
  return <App key={dir} carry={carry} onSwitchExam={switchExam} />;
}

function App({ carry, onSwitchExam }: { carry: Carry | null; onSwitchExam: (dir: string, c: Carry) => void }) {
  const [data, setData] = useState<AppData | null>(null);
  const [all, setAll] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [billing, setBilling] = useState<BillingState>({ status: 'unavailable', reason: '読み込み中', access: EMPTY_ACCESS });
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1];
  const dataRef = useRef<AppData | null>(null);

  useEffect(() => {
    loadData().then((loaded) => {
      let d = loaded;
      // 文字の大きさとお知らせは、切り替える前の試験の設定を引き継ぐ
      if (carry && (d.settings.fontScale !== carry.fontScale || d.settings.remind !== carry.remind || d.settings.remindAt !== carry.remindAt)) {
        d = { ...d, settings: { ...d.settings, ...carry } };
        saveData(d);
      }
      dataRef.current = d;
      setData(d);
    });
    fetch(`./data/${EXAM.dir}/questions.json`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((qs: Question[]) => setAll(qs))
      .catch((e) => setLoadError(`問題を読み込めませんでした(${e})`));
    loadBilling().then(setBilling);
  }, []);

  /** いま選んでいる試験の完全版を持っているか */
  const premium = !!billing.access[EXAM.dir];

  const update = useCallback((f: (d: AppData) => AppData) => {
    const cur = dataRef.current;
    if (!cur) return;
    const next = f(cur);
    dataRef.current = next;
    setData(next);
    saveData(next);
  }, []);

  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const home = useCallback(() => setStack([{ name: 'home' }]), []);

  // Android の戻るボタン
  useEffect(() => {
    const h = CapApp.addListener('backButton', () => {
      setStack((s) => {
        if (s.length > 1) return s.slice(0, -1);
        CapApp.minimizeApp().catch(() => {});
        return s;
      });
    });
    return () => { h.then((x) => x.remove()).catch(() => {}); };
  }, []);

  /** 鍵の無い問題(買っていなければ無料の回だけ) */
  const open = useMemo(() => (all ?? []).filter((q) => !isLocked(q, premium, EXAM)), [all, premium]);
  const byId = useMemo(() => new Map((all ?? []).map((q) => [q.id, q])), [all]);

  const start = useCallback((title: string, qs: Question[], mode: Session['mode'] = 'practice', exam?: number) => {
    if (qs.length === 0) return;
    push({ name: 'quiz', session: { title, ids: qs.map((q) => q.id), mode, exam, seed: Date.now() } });
  }, [push]);

  const starters = useMemo(() => ({
    nigate: (limit = 20) => data && start('苦手を解く', nigateOrder(open, data).slice(0, limit)),
    unseen: () => data && start('まだ解いていない問題', shuffle(unseen(open, data), rng(Date.now())).slice(0, 20)),
    random: () => start('ランダム10問', shuffle(open.filter((q) => !q.excluded), rng(Date.now())).slice(0, 10)),
    marks: () => data && start('しるしを付けた問題', data.marks.map((id) => byId.get(id)).filter((q): q is Question => !!q && !isLocked(q, premium, EXAM))),
  }), [data, open, byId, premium, start]);

  const finishMock = useCallback((m: MockResult, answers: { q: Question; ok: boolean }[]) => {
    update((d) => {
      let n = d;
      const t = Date.now();
      answers.forEach((a, i) => { n = record(n, a.q, a.ok, t + i); });
      return { ...n, mocks: [...n.mocks, m] };
    });
  }, [update]);

  const answered = useCallback((q: Question, ok: boolean) => {
    update((d) => record(d, q, ok, Date.now()));
  }, [update]);

  /** 解き終えたとき。苦手が減った直後にだけ評価をお願いする(出すかどうかは OS が決める) */
  const onSessionEnd = useCallback((e: SessionEnd) => {
    reviewChain = reviewChain.then(async () => {
      const { state, ask } = reviewOnSessionEnd(await loadReview(), e, Date.now());
      await saveReview(state);
      if (ask) askReview();
    }).catch((err) => console.error('[nigatecho] review', err));
  }, []);

  if (loadError) return <div className="fatal">{loadError}</div>;
  if (!data || !all) return <div className="splash"><span>ニガテ帳</span></div>;

  const fontStyle = { ['--fs' as string]: String(data.settings.fontScale) };

  return (
    <div className="app" style={fontStyle}>
      {route.name === 'home' && (
        <Home
          data={data} all={all} open={open} premium={premium}
          onNigate={() => starters.nigate()}
          onUnseen={starters.unseen}
          onRandom={starters.random}
          onMarks={starters.marks}
          onExams={() => push({ name: 'exams', mock: false })}
          onSubjects={() => push({ name: 'subjects' })}
          onMock={() => push({ name: 'exams', mock: true })}
          onMockHistory={() => push({ name: 'mocks' })}
          onSubject={(s) => start(s, open.filter((q) => q.subject === s && !q.excluded).sort((a, b) => sortNigateFirst(a, b, data)))}
          onPaywall={() => push({ name: 'paywall', from: 'home' })}
          onSettings={() => push({ name: 'settings' })}
          onSources={() => push({ name: 'sources' })}
          onSwitchExam={() => push({ name: 'switch' })}
          onExemptOnly={(on) => update((d) => ({ ...d, settings: { ...d.settings, exemptOnly: on } }))}
        />
      )}
      {route.name === 'switch' && (
        <ExamSwitch
          billing={billing}
          onBack={back}
          onPick={(dir) => {
            if (dir === EXAM.dir) { home(); return; }
            const s = data.settings;
            onSwitchExam(dir, { fontScale: s.fontScale, remind: s.remind, remindAt: s.remindAt });
          }}
        />
      )}
      {route.name === 'exams' && (
        <ExamPicker
          all={all} data={data} premium={premium} mock={route.mock}
          onBack={back}
          onLocked={() => push({ name: 'paywall', from: 'exam' })}
          onStart={(title, qs, exam) => start(title, qs, route.mock ? 'mock' : 'practice', exam)}
        />
      )}
      {route.name === 'subjects' && (
        <SubjectPicker
          open={open} all={all} data={data} premium={premium}
          onBack={back}
          onPaywall={() => push({ name: 'paywall', from: 'subject' })}
          onStart={(title, qs) => start(title, qs)}
        />
      )}
      {route.name === 'quiz' && (
        <Quiz
          key={route.session.seed}
          session={route.session} byId={byId} data={data} premium={premium}
          onAnswer={answered}
          onMark={(id) => update((d) => toggleMark(d, id))}
          onMockDone={finishMock}
          onEnd={onSessionEnd}
          onClose={back}
          onHome={home}
          onNigate={() => { back(); starters.nigate(); }}
          // 結果の画面から開いた購入画面は、閉じたら問題の前の画面へ(同じ問題の1問目に戻さない)
          onPaywall={() => setStack((s) => [...s.slice(0, -1), { name: 'paywall', from: 'quiz' }])}
          onSources={() => push({ name: 'sources' })}
        />
      )}
      {route.name === 'paywall' && (
        <Paywall
          billing={billing} all={all}
          onClose={back}
          onBought={() => { loadBilling().then(setBilling); back(); }}
          setBilling={setBilling}
        />
      )}
      {route.name === 'settings' && (
        <SettingsPage
          data={data} premium={premium}
          onBack={back}
          onChange={(s) => update((d) => ({ ...d, settings: { ...d.settings, ...s } }))}
          onReset={() => update((d) => ({ ...d, records: {}, marks: [], mocks: [], daily: {} }))}
          onPaywall={() => push({ name: 'paywall', from: 'settings' })}
          onRestored={() => loadBilling().then(setBilling)}
          onSources={() => push({ name: 'sources' })}
          onSwitchExam={() => push({ name: 'switch' })}
        />
      )}
      {route.name === 'mocks' && <MockHistory data={data} onBack={back} />}
      {route.name === 'sources' && <SourcesPage exams={[...new Set(all.map((q) => q.exam))]} onBack={back} />}
    </div>
  );

  // 科目を選んだら、苦手 → まだ解いていない → 解けた問題の順に並べる
  function sortNigateFirst(a: Question, b: Question, d: AppData) {
    const ra = d.records[a.id], rb = d.records[b.id];
    const ka = ra ? (ra.missed && ra.streak < 2 ? 0 : 2) : 1;
    const kb = rb ? (rb.missed && rb.streak < 2 ? 0 : 2) : 1;
    return ka - kb || a.exam - b.exam || a.no - b.no;
  }
}
