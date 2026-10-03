import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

if (import.meta.env.DEV) {
  const params = new URLSearchParams(location.search);
  // 見本データを書き終えてから描く(待たないと、空の記録を先に読んでしまう)
  if (params.get('demo') === '1') await (await import('./dev/demo')).installDemo(params);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// App Review 用の録画ビルドだけ(VITE_REVIEW_TOUR=1)。製品版では import ごと消える
if (import.meta.env.VITE_REVIEW_TOUR === '1') void import('./dev/reviewTour').then((m) => m.runReviewTour());
