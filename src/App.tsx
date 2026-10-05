import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import type { AppData, MockResult, Question } from './domain/types';
import { EXAM } from './domain/exam';
import { isLocked, nigateOrder, record, rng, shuffle, toggleMark, unseen } from './domain/study';
import { loadData, saveData } from './platform/storage';
import { loadBilling, type BillingState } from './platform/billing';
import { askReview } from './platform/native';
import { Home } from './ui/Home';
import { Quiz, type Session } from './ui/Quiz';
import { ExamPicker, SubjectPicker } from './ui/Pickers';
import { Paywall } from './ui/Paywall';
import { SettingsPage } from './ui/SettingsPage';
import { MockHistory } from './ui/MockHistory';
import { SourcesPage } from './ui/SourcesPage';

export type Route =
  | { name: 'home' }
  | { name: 'quiz'; session: Session }
  | { name: 'exams'; mock: boolean }
  | { name: 'subjects' }
  | { name: 'paywall'; from: string }
  | { name: 'settings' }
  | { name: 'mocks' }
  | { name: 'sources' };

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [all, setAll] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [billing, setBilling] = useState<BillingState>({ status: 'unavailable', reason: '読み込み中' });
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1];
  const dataRef = useRef<AppData | null>(null);

  useEffect(() => {
    loadData().then((d) => { dataRef.current = d; setData(d); });
    fetch('./data/questions.json')
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((qs: Question[]) => setAll(qs))
      .catch((e) => setLoadError(`問題を読み込めませんでした(${e})`));
    loadBilling().then(setBilling);
  }, []);

  const premium = billing.status === 'ready' && billing.premium;

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

  const sessionsDone = useRef(0);
  const onSessionEnd = useCallback((correctRate: number) => {
    sessionsDone.current++;
    // よく解けた回の終わりにだけ、評価をお願いする(出すかどうかは OS が決める)
    if (sessionsDone.current >= 2 && correctRate >= 0.7) askReview();
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
          onPaywall={() => push({ name: 'paywall', from: 'quiz' })}
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
