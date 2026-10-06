export interface Question {
  /** "40-001" = 第40回の1問目 */
  id: string;
  exam: number;
  session: '午前' | '午後';
  no: number;
  subject: string;
  stem: string;
  choices: string[];
  /** 1始まり。1つ選ぶ問題で複数あるときは、どれを選んでも正解。2つ選ぶ問題では正答の組(accepted があるときはその和) */
  answer: number[];
  /** 正解として扱う組の一覧(公式が複数の答え方を正解とした問題だけ)。例 [[3,4],[3,5],[4,5]] */
  accepted?: number[][];
  /** 選ぶ数。省略は1。2なら「2つ選べ」で、answer の2つと選んだ2つが完全に一致したときだけ正解 */
  pick?: number;
  /** 配点。省略は1(理学療法士の実地問題は3) */
  points?: number;
  /** 採点対象から除外された問題。解けるが得点には数えない */
  excluded: boolean;
  note: string;
  /** "fig/40-001.png" */
  figure: string | null;
  source: string;
  explanation?: string;
  /** 事例問題の事例文(同じ事例の問題で共通。原文のまま。介護福祉士) */
  case?: string;
  /** 選択肢の後ろに付いている用語の注「（注）…」(原文のまま。社会福祉士) */
  footnote?: string;
  /** 選択肢が図の中にだけある問題(図の番号を選ぶ) */
  figChoices?: boolean;
}

/** 試験ごとの設定。exams/<試験>/exam.json と同じ形 */
export interface ExamConfig {
  key: string;
  dir: string;
  /** "管理栄養士" */
  name: string;
  /** 単体のアプリのときの ID と名前(まとめアプリでは使わない) */
  appId?: string;
  appName?: string;
  homeName: string;
  productId: string;
  price: string;
  /** サポート・規約の置き場所(末尾は /) */
  site: string;
  /** 次の本番 "2027-02-28" */
  examDate: string;
  examDateNote: string;
  /** いちばん新しい回とその年 */
  latestExam: number;
  latestYear: number;
  /** 1回の問題数 */
  perExam: number;
  /** 合格基準(総得点に対する割合) */
  passRatio: number;
  /**
   * 総得点とは別の合格基準(理学療法士の実地問題: 配点3の問題で約35%以上)。
   * 回ごとに基準の点は少し違うので、ここは目安の割合。
   */
  subPass?: { label: string; points: number; ratio: number };
  /** 無料で解ける回 */
  freeExams: number[];
  /** 出題基準の科目(並び順もこのまま使う) */
  subjects: string[];
  /** 科目名の短い形 */
  short: Record<string, string>;
  /** 出典の表示 */
  credit: string;
  /** 問題ごとの出典。{n} が回の番号になる(無ければ 厚生労働省「第{n}回<試験名>国家試験」) */
  sourceLabel?: string;
  /** 実施団体と関係が無いことの表示(無ければ「厚生労働省とは関係のない個人の制作物」) */
  disclaimer?: string;
  /** 出典のリンク(厚生労働省・社会福祉振興・試験センターの掲載ページと利用の条件) */
  sources?: ExamSources;
  /** 出典の画面の最後に出す注意(無ければ医療に関するご注意) */
  notice?: { title: string; body: string };
  /** 合格に「すべての群で得点」が要る科目群(介護福祉士の11科目群、社会福祉士の6科目群) */
  groups?: { name: string; subjects: string[] }[];
  /** 回ごとの公式の合格点(問題の難易度で補正された点)。{"38": 64} */
  passScores?: Record<string, number>;
  /** 収録した問題の数と回(scripts/use-multi.mjs が数えて入れる) */
  count?: number;
  rounds?: number[];
  /** RevenueCat の公開APIキー(アプリに埋め込む物。秘密ではない) */
  revenuecat?: { ios: string; android: string };
  /** RevenueCat の entitlement */
  entitlement?: string;
}

export interface SourceLink { title: string; url: string }

export interface ExamSources {
  /** 問題を公表している所。無ければ厚生労働省 */
  org?: string;
  /** 試験そのものの案内ページ(社会福祉振興・試験センターは「過去の試験問題」のページ) */
  top: SourceLink;
  /** 回ごとの「問題および正答について」のページ。キーは回の番号 */
  pages: Record<string, SourceLink>;
  /** 回のページが無い(公開が終わった)回のときに出す、いま公開中のページ */
  current?: SourceLink;
  /** 公共データ利用規約(社会福祉振興・試験センターは「過去問題利用にあたっての留意事項等」) */
  license: SourceLink;
  /** 利用の条件の説明(無ければ公共データ利用規約の文) */
  usage?: string[];
  /** top のページにいま載っている回(回ごとのページが無い所) */
  listedExams?: number[];
  /** top のページに載っていない回の説明 */
  archivedNote?: string;
}

export interface Record1 {
  /** 解いた回数 */
  n: number;
  /** 正解した回数 */
  ok: number;
  /** 最後に解いた時刻(ms) */
  at: number;
  /** 最後の結果から続いている正解の数。間違えると0 */
  streak: number;
  /** 一度でも間違えたか */
  missed: boolean;
}

export interface MockResult {
  at: number;
  /** どの回を本番形式で解いたか。0 = いろいろな回から混ぜた */
  exam: number;
  score: number;
  total: number;
  bySubject: Record<string, { ok: number; n: number }>;
  seconds: number;
}

export interface Settings {
  fontScale: number;
  /** "2027-03-01" 試験日。空なら残り日数を出さない */
  examDate: string;
  remindAt: string;
  remind: boolean;
}

export interface AppData {
  version: 1;
  records: Record<string, Record1>;
  marks: string[];
  mocks: MockResult[];
  settings: Settings;
  /** 毎日の解いた数 "2026-10-01" -> 件数 */
  daily: Record<string, number>;
}
