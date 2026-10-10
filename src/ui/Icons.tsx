/** 画面の小さな絵記号(線の太さ 2・角は丸く。見本の記号に形を寄せて描いた) */
type P = { size?: number; className?: string };

const svg = (paths: React.ReactNode, { size = 22, className }: P, fill = false) => (
  <svg className={`ico ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden
    fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

export const IHome = (p: P) => svg(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h5v-5h3v5h5V10" /></>, p);
export const ISearch = (p: P) => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>, p);
export const INote = (p: P) => svg(<><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /><path d="M3.5 7h3M3.5 12h3M3.5 17h3" /></>, p);
export const IChart = (p: P) => svg(<><path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /></>, p);
export const IGear = (p: P) => svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" /><circle cx="12" cy="12" r="7" /></>, p);
export const IBook = (p: P) => svg(<><path d="M3 5.5c3-1.3 6-1.3 9 .8 3-2.1 6-2.1 9-.8V19c-3-1.3-6-1.3-9 .8-3-2.1-6-2.1-9-.8z" /><path d="M12 6.3v13.5" /></>, p);
export const ILayers = (p: P) => svg(<><path d="m12 3 9 4.5-9 4.5-9-4.5z" /><path d="m3 12 9 4.5 9-4.5" /><path d="m3 16.5 9 4.5 9-4.5" /></>, p);
export const IDoc = (p: P) => svg(<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>, p);
export const IShuffle = (p: P) => svg(<><path d="M3 7h3.5c4 0 6 10 10.5 10H21" /><path d="M3 17h3.5c1.6 0 2.8-1.6 3.8-3.5M13.8 9.6C14.8 8 15.6 7 17 7h4" /><path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5" /></>, p);
export const IStar = (p: P) => svg(<path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />, p, true);
export const IClip = (p: P) => svg(<><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 3h6v3H9zM8.5 11h7M8.5 15h7" /></>, p);
export const IBookmark = (p: P & { on?: boolean }) => svg(<path d="M6.5 3.5h11V21L12 16.8 6.5 21z" />, p, !!p.on);
export const ICalendar = (p: P) => svg(<><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4M9 14h2v3" /></>, p);
export const IBell = (p: P) => svg(<><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>, p);
export const ILock = (p: P) => svg(<><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>, p);
export const ICheck = (p: P) => svg(<path d="m5 12.5 4.5 4.5L19 7.5" />, p);
export const IX = (p: P) => svg(<path d="M6 6l12 12M18 6 6 18" />, p);
export const IChevron = (p: P) => svg(<path d="m9 5 7 7-7 7" />, p);
export const IBack = (p: P) => svg(<path d="m15 5-7 7 7 7" />, p);
export const IArrow = (p: P) => svg(<path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" />, p);
export const IRepeat = (p: P) => svg(<><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" /><path d="M20 4v4.5h-4.5" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" /><path d="M4 20v-4.5h4.5" /></>, p);
export const IBulb = (p: P) => svg(<><path d="M9 17.5h6M10 21h4" /><path d="M8.5 14.5a6 6 0 1 1 7 0c-.6.5-1 1.2-1 2v1h-5v-1c0-.8-.4-1.5-1-2z" /></>, p);
export const ITarget = (p: P) => svg(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>, p);
export const IFlag = (p: P) => svg(<><path d="M5 21V4" /><path d="M5 4.5h12l-2.5 4 2.5 4H5" /></>, p);
export const IInfo = (p: P) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></>, p);
export const IClock = (p: P) => svg(<><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4.5l3 2M9.5 2.8h5" /></>, p);
