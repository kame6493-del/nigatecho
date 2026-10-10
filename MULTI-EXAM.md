# 試験を選べる1本のアプリにする(multi-exam ブランチ)

2026-10-06。App Review 4.3(a) で試験ごとのアプリが出せなくなったため、公開中の管理栄養士のアプリ(jp.nigatecho.kanrieiyoushi / App Store 6818535389)の中で試験を選べるようにした。理学療法士・介護福祉士・社会福祉士の単体のアプリは出し直さない。

## 中身
- 試験: 管理栄養士(第36〜40回 1,000問)・理学療法士(第57〜61回 1,000問)・介護福祉士(第33〜38回 750問)・社会福祉士(第37・38回 258問)
- 組み方: `node scripts/use-multi.mjs`(exams/multi.json の順。先頭の管理栄養士で、はじめて開く)→ `npm run build` → `npx cap sync`
- 問題は public/data/<試験>/。記録は試験ごとに `nigatecho.<試験の key>.v1`(管理栄養士は前の版と同じ `nigatecho.kanri-eiyoushi.v1`)。最後に選んだ試験は `nigatecho.exam`
- 文字の大きさと毎日のお知らせは、試験を替えても引き継ぐ(お知らせは端末に1つ)。試験日・記録・しるし・模試は試験ごと
- 介護福祉士の科目パックはやめ、完全版1つにした
- 臨床検査技師は入れていない。単体のアプリ(6818536142)で売っていて、ここに入れると買った人にもう一度払わせることになり、同じ中身のアプリが2本になる(4.3 の対象)。入れるなら exams/multi.json に足すだけで、単体のアプリを買った人の扱いを先に決める

## 作る商品(App Store Connect・RevenueCat。まだ作っていない)
| 試験 | 商品ID | entitlement | 値段 | 無料 |
|---|---|---|---|---|
| 管理栄養士 | nigatecho_kanri_full(今のまま) | full(今のまま) | ¥980 | 第40回 |
| 理学療法士 | nigatecho_multi_pt_full | pt_full | ¥980 | 第61回 |
| 介護福祉士 | nigatecho_multi_kaigo_full | kaigo_full | ¥900 | 第38回 |
| 社会福祉士 | nigatecho_multi_shakai_full | shakai_full | ¥900 | 第38回 |
| 精神保健福祉士(v1.2) | nigatecho_multi_seishin_full | seishin_full | ¥900 | 第28回 |

- どれも非消耗型。管理栄養士のアプリ(6818535389)の App内課金として作る
- RevenueCat: 管理栄養士のアプリの current offering に4つのパッケージを並べる(アプリは商品IDで見分ける)。新しい3つの商品を entitlement "full" に付けないこと(付けると理学療法士を買った人に管理栄養士も開く)
- 単体の理学療法士のアプリ用の nigatecho_pt_full は別アプリの商品なので使えない

## 名前・版・ストアの素材(v1.1.0)
- ストアの名前「ニガテ帳 国家試験の過去問」(13字)・サブタイトル「管理栄養士・理学療法士・介護福祉士・社会福祉士」(23字)。掲載文・新機能・App Review へのメモ(英語)は store/multi/listing_ja.md
- 名前は exams/multi.json の appName(capacitor の appName)、ホーム画面の名前は homeName「ニガテ帳」。use-multi.mjs が組むたびに exams/kanri の Info.plist(CFBundleDisplayName)と Android の strings.xml(app_name)に書く。patch_native.py は `python scripts/patch_native.py multi` で同じ名前を書く
- 版: iOS 1.1.0(MARKETING_VERSION。ビルド番号は TestFlight のワークフローの実行番号)・Android 1.1.0(versionCode 3)
- iOS の組み立て: GitHub Actions「iOS TestFlight」の exam に multi を選ぶ(use-multi.mjs で組み、殻は exams/kanri)
- Android の組み立て: node scripts/use-multi.mjs → npm run build → npx cap sync android → powershell -File scripts/build-android.ps1 -Exam kanri
- 画面写真: python scripts/make_store_multi.py(開発サーバー npx vite --port 5191 を出しておく)→ store/multi/iphone 1〜6(1枚目は試験を選ぶ画面)・ipad 1〜5・iap(購入画面4枚。ios_release/iap_shots/multi_<試験>.png にも写した)

## v1.2: 精神保健福祉士を足す(v1.2-seishin ブランチ。2026-10-07)
- 収録: 第27・28回 264問。各回 共通科目(午前 1〜84)と専門科目(午後 1〜48)。id は共通が `27-001`、専門が `27-s001`
- 共通科目168問は社会福祉士 第37・38回の 1〜84番をそのまま写した(問題・正答・解説・注。source は社会福祉士の冊子のURL。センターの精神保健福祉士の過去問のページがその冊子にリンクしている)。冊子は社会福祉士の元データと同じファイル(cmp で一致)、正答は精神保健福祉士の se_kijun_seitou.pdf の共通科目の表と168問すべて一致
- 専門科目96問は se_pm_01〜06 から組み、解説は新しく書いた。元データと組み方は `Downloads/精神保健福祉士ニガテ帳_2026-10-07/data`(parse_answers.py → build.py → validate.py → merge_all.py。merge_all.py が exams/seishin/data/questions.json を書く)。解説の検査の記録は同じ所の review/
- 合格: 公式の合格点 第27回 70・第28回 62(132点満点)、9科目群すべてで得点
- 共通科目免除(社会福祉士の資格がある人): ホームの予想点で「専門科目だけ」に切り替えると、専門6科目・48点満点・5科目群で出す(exam.json の exempt。切り替えは試験ごとの記録の settings.exemptOnly に残る)。模試は132問のまま
- 年度別の画面のボタンは「午前(共通科目)」「午後(専門科目)」(exam.json の sessionNames)
- 商品: nigatecho_multi_seishin_full / entitlement seishin_full / ¥900 / 無料は第28回。社会福祉士の完全版とは別の商品(購入画面に書いた。exam.json の paywallNote)。まだ App Store Connect・RevenueCat に作っていない
- 版は iOS・Android とも 1.2.0(Android versionCode 4)

## 確かめ方
- `npm run test:all`(単体テスト。src/domain/multi.test.ts が試験ごとの設定・問題・出典・商品の重なり・記録の保存先を見る)
- `python scripts/e2e.py`(管理栄養士の流れ。前と同じ)
- `python scripts/e2e_multi.py`(試験の切り替え。main を組んだ dist を `npx vite preview --port 5193` で出しておくと、前の版で作った記録を新しい版で読む確認もする)
- scripts/make_screenshots.py・shot_paywall.py は前の1試験の形のまま(public/data/questions.json を読む)。試験を選べる版の写真は make_store_multi.py

## 見た目の作り直し(2026-10-10・Android 1.3.0 / versionCode 5)
持ち主が ChatGPT に作らせた UI の見本(Downloads/nigatecho_ref_1〜5_941x1672.png)と新しいアイコン(store/icon_source_2026-10-10.png)に合わせた。機能・商品・問題データは変えていない。
- 下のタブ: ホーム・問題を探す・苦手ノート・成績・設定。苦手ノート(科目ごと・連続正解 0/2・1/2)と成績(総合・科目別・推移・計画)は画面を新しく足したが、中の数はどれも前からある記録(records・daily・mocks)から出す
- 問題は「選んでから答え合わせ」→ 解説の画面(正解/不正解・この問題のステータス・正答の理由・選択肢ごとの解説)。解説の文は src/domain/explain.ts で「正答 N:」と「N ×」の行で見出しに分けるだけ(文は変えない。全3,272問で元の文と一致するのを explain.test.ts が見る)
- 絵は見本から切り出した(scripts/make_redesign_assets.py → src/assets/ill)。アイコンは scripts/make_icon_redesign.py(元の物は store/_icon_backup/、確かめの絵は store/_icon_check.png)
- 確かめ: npm run test:all・python scripts/e2e_redesign.py(5試験×375/430、開発サーバー npx vite --port 5291)・python scripts/make_compare_redesign.py(docs/compare_redesign_*.png)
- ストアの画像: python scripts/make_store_redesign.py → store/multi/iphone・ipad・play(前の物は store/_old_2026-10-10/)。写真に「無料」「¥」「円」が映ったら止まる。試験の切り替え画面は開発サーバーの ?shot=1 で値段と無料の行を消して撮る
- 前の見た目用の scripts/e2e.py・e2e_multi.py・make_store_multi.py・make_screenshots.py は、画面の部品の名前が変わったので、そのままでは通らない(新しい見た目の確かめは e2e_redesign.py)
- iOS はまだ出していない(1.2.1 が審査待ち)。App Review の録画用の自動操作 src/dev/reviewTour.ts は「選んでから答え合わせ」に合わせ直し、scripts/check_review_tour.py で最後(購入画面)まで進むのを確かめた
- AAB は 27.9MB(図 約18MB・dex 約5MB)。10MB 未満にするには問題の図の画質を落とすしかないので、していない
