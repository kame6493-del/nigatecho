import { APP, EXAM, yearOf } from '../domain/exam';
import { LICENSE_FALLBACK, disclaimerOf, hasOwnPage, isMhlw, orgOf, sourcePageFor } from '../domain/sources';
import { TopBar } from './Quiz';

/** 外のページへのリンク(アプリの外のブラウザで開く。設定画面のリンクと同じ開き方) */
export function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="ext" href={href} target="_blank" rel="noreferrer">{children}</a>;
}

/** 出典と参考文献(いま選んでいる試験の物)。設定とホームの下から開く */
export function SourcesPage(p: { exams: number[]; onBack: () => void }) {
  const s = EXAM.sources;
  const org = orgOf(EXAM);
  const mhlw = isMhlw(EXAM);
  const license = s?.license ?? LICENSE_FALLBACK;
  const exams = [...p.exams].sort((a, b) => b - a);

  return (
    <div className="page sources">
      <TopBar title={`出典と参考文献(${EXAM.name})`} onClose={p.onBack} />

      <section className="card">
        <h2>問題と正答の出典</h2>
        {mhlw
          ? <p>問題文・選択肢・図・正答は、厚生労働省が公表している{EXAM.name}国家試験の「問題および正答」です。各回の掲載ページは次のとおりです。</p>
          : <p>問題文・選択肢・図・正答は、公益財団法人 {org}が公表している{EXAM.name}国家試験の過去の試験問題と正答です。掲載ページは次のとおりです。</p>}
        <ul className="src-list">
          {exams.map((n) => {
            const link = sourcePageFor(n, EXAM);
            return (
              <li key={n}>
                <span className="src-year">第{n}回({yearOf(n)}年)</span>
                {link && hasOwnPage(n, EXAM)
                  ? <ExtLink href={link.url}>{org}「{link.title}」</ExtLink>
                  : mhlw
                    ? <span className="muted">厚生労働省ホームページ(各回の掲載当時)。この回の問題は現在、厚生労働省のサイトでの公開が終わっています。{link && <> 最新の回: <ExtLink href={link.url}>厚生労働省「{link.title}」</ExtLink></>}</span>
                    : <span className="muted">{s?.archivedNote ?? `${org}ホームページ(掲載当時)。`}{link && <> 現在の掲載: <ExtLink href={link.url}>{org}「{link.title}」</ExtLink></>}</span>}
              </li>
            );
          })}
        </ul>
        {s?.top && mhlw && <p>試験の案内: <ExtLink href={s.top.url}>厚生労働省「{s.top.title}」</ExtLink></p>}
      </section>

      <section className="card">
        <h2>利用の条件</h2>
        {s?.usage?.length
          ? <>
              {s.usage.map((t) => <p key={t}>{t}</p>)}
              <p>利用の条件の原文: <ExtLink href={license.url}>{org}「{license.title}」</ExtLink></p>
            </>
          : <p>上の問題と正答は、出典を記載したうえで、政府の <ExtLink href={license.url}>{license.title}</ExtLink> にもとづいて利用しています。選択肢の番号付けと表示を編集・加工しています。</p>}
      </section>

      <section className="card">
        <h2>解説について</h2>
        <p>解説は本アプリの独自作成です。{org}が公表した正答にもとづいて書いたもので、{org}の見解ではありません{mhlw ? '' : `。${org}とは関係ありません`}。</p>
        <p>解説の誤りに気づいたときは、<ExtLink href={`${APP.site}support.html`}>問い合わせ</ExtLink>から知らせてください。</p>
      </section>

      <section className="card">
        {EXAM.notice
          ? <><h2>{EXAM.notice.title}</h2><p>{EXAM.notice.body}</p></>
          : <><h2>医療に関するご注意</h2><p>本アプリは国家試験の学習のためのものです。診断・治療などの医療上の助言を目的としたものではありません。ご自身やほかの人の健康・医療についての判断は、医師などの専門家に相談してください。</p></>}
      </section>

      <p className="credit">{EXAM.credit}</p>
      <p className="credit">{disclaimerOf(EXAM)}</p>
    </div>
  );
}
