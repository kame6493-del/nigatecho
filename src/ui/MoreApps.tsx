import { Capacitor } from '@capacitor/core';
import { APP } from '../domain/exam';
import { moreAppsFor, playUrl, promoSource } from '../domain/moreApps';

/** 設定のいちばん下の「作者のほかのアプリ」。押すと Play のページが開く(Capacitor が外のアプリに渡す) */
export function MoreApps() {
  const apps = moreAppsFor(Capacitor.getPlatform(), APP.appId);
  if (!apps.length) return null;
  const source = promoSource(APP.appId);
  return (
    <section className="more-apps" aria-label="作者のほかのアプリ">
      <h2>作者のほかのアプリ</h2>
      <ul className="links">
        {apps.map((a) => (
          <li key={a.id}>
            <a className="more-app" href={playUrl(a.id, source)} target="_blank" rel="noreferrer">
              <img src={`${import.meta.env.BASE_URL}${a.icon}`} alt="" width={44} height={44} loading="lazy" />
              <span><b>{a.name}</b><small>{a.line}</small></span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
