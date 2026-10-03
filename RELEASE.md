# ニガテ帳(管理栄養士 過去問)公開までの状態と手順

## なぜこの商品か(2026-10-01 調査: Downloads\アプリ市場調査_2026-10-01\00_結論.md)
- App Store 教育の有料上位100のうち約60本が資格の問題集。個人・小規模が¥800前後で並ぶ。
- 管理栄養士国試: 受験15,927人・合格率47.6%(既卒9.4%)。試験 2027-02-28。勉強の山場は10〜2月。
- 問題と正答は厚労省ホームページが公共データ利用規約1.0で公開(出典表示で商用・加工可)。第36〜39回は厚労省から消えており、Wayback 保存版から取得。
- 競合: グッピー(無料・5年分・解説つき・評価617)。レビューに「科目別正答率やグラフが無い」「1000円程度なら課金する人もいる」。2026年の個人新作5本以上(評価は数件)。

## 中身
- 問題 1,000(第36〜40回)。図つき114問。採点除外 1問(36-007)。正答PDFとの食い違い 0。data\VALIDATION.md
- 解説: data\expl\NN.json → scripts\merge_expl.py で public\data\questions.json へ差し込む(1行目の正答番号を公式と照合)
- 無料=第40回、完全版(¥980 買い切り・entitlement "full")=第36〜39回+模試。広告なし。アカウントなし。

## 確認済み
- 単体テスト 14件(npx vitest run)
- ブラウザで押して回る確認 scripts\e2e.py: 初回→10問→結果→苦手が2回正解で0→疑似購入→年度別→模試→設定→予想点→図。console error 0

## 持ち主がやること(順番どおり)
1. 公開ページ: site\ の3ファイルを GitHub Pages(kame6493-del/nigatecho-site)に置く(Claude が push できる。確認後)
2. App Store Connect でアプリを作る(Bundle ID jp.nigatecho.kanrieiyoushi)。App内課金に非消耗型 nigatecho_kanri_full ¥980 を作る
3. RevenueCat にこのアプリを足し、entitlement "full"・Offering(パッケージ1つ)を作って、公開APIキーを src\platform\billing.ts の API_KEYS へ
4. iOS ビルド: カチマケと同じ GitHub Actions のクラウド Mac(シークレット4つ)を使う
5. Android は新しい個人アカウントだと 12人×14日のテストが要るので後回し(売上の8割は iOS)

## シリーズ展開
src\domain\exam.ts と data\questions.json を差し替えれば別の試験になる。候補(厚労省が問題を公開): 臨床検査技師・理学療法士・作業療法士・診療放射線技師・言語聴覚士・臨床工学技士・視能訓練士。

## 今の状態(2026-10-02)
- 解説: 1,000問すべて差し込み済み。正答番号の食い違い 0。中身の検査を全問で実施し、36〜40回で計32問を直した(事実の誤りは 37-198・38-005・39-148・39-127・39-174・39-166・38-125・38-139・40-169・40-171・40-172・40-177 など)。判断が残った7問は言い切らない書き方に直した(data\fix_open_reviews.py ほか)
- 39-122(急性膵炎): 出題当時は絶食が正解扱い、現行ガイドライン2021は重症例で早期経腸栄養。解説に両方を書いてある
- データの直し: data\fix_stems.py(build.py → add_archive.py の後に流す)
- 確認: 単体テスト 14件、scripts\e2e.py 全項目 OK・console error 0(解説入りの最終データで)
- 画面写真5枚: store\shot_1〜5.png(1290x2796)
- Android: releases\nigatecho-kanri-release.aab(versionCode 1 / 1.0.0、署名検証 OK、中身は最新データと一致)。鍵は %LOCALAPPDATA%\NigatechoBuild\signing(PC を替える前に控える)
- 未着手: 公開ページの push・非公開リポジトリへの push と iOS クラウドビルド(持ち主の返事待ち)、App Store Connect と RevenueCat の登録(持ち主の作業)

## 公開まわり(2026-10-02)
- 公開ページ: https://kame6493-del.github.io/nigatecho-site/ (入口・support・privacy・terms。リポジトリ kame6493-del/nigatecho-site、公開)
- アプリのコード: kame6493-del/nigatecho(非公開)に push 済み
- iOS ビルドの設定 .github/workflows/ios-testflight.yml は、gh の認証に workflow 権限が無くて push を断られた。ファイルは ../_pending/ に退避してある
  → 持ち主が `gh auth refresh -h github.com -s workflow` を通したら、_pending から戻して commit・push し、compile_only で1回流す
- シークレット: ASC_KEY_ID(NNBSHB2KC9)と ASC_KEY_P8_BASE64 は入れた。ASC_ISSUER_ID と APPLE_TEAM_ID は持ち主に聞く(手元に記録が無い。diamond-nine のシークレットは読み出せない)
- 2本目: 臨床検査技師(第68〜72回)のデータ化を実施中 → Downloads/臨床検査技師国試アプリ_2026-10-02/data/
- アプリは「2つ選べ」に対応済み(Question.pick、scripts/e2e_pick2.py 12項目 OK)


## シリーズ化(2026-10-02)
1つの作りで複数の試験を出す。試験ごとの物は exams/<試験>/。

| | 管理栄養士 (kanri) | 臨床検査技師 (rinsho) |
|---|---|---|
| アプリID | jp.nigatecho.kanrieiyoushi | jp.nigatecho.rinshokensa |
| 商品 | nigatecho_kanri_full ¥980 | nigatecho_rinsho_full ¥980 |
| 収録 | 第36〜40回 1,000問 | 第68〜72回 1,000問(2つ選ぶ156問) |
| 無料 | 第40回 | 第72回 |
| 解説の検査 | 32問を直した | 19問を直した |
| 次の試験日 | 2027-02-28 | 2027-02-17 |
| サポート | nigatecho-site/ | nigatecho-site/rinsho/ |
| AAB | releases/nigatecho-kanri-release.aab | releases/nigatecho-rinsho-release.aab |
| 署名鍵 | %LOCALAPPDATA%/NigatechoBuild/signing | %LOCALAPPDATA%/NigatechoBuild/signing/rinsho |

組み方(試験ごと):
```
python scripts/merge_expl.py <試験> <元のdataフォルダ>   # 解説を差し込み、正答番号を照合、大きい図は WebP に
node scripts/use-exam.mjs <試験>                          # src/exam.current.json・capacitor.config.json・public/data を切り替える
npx vitest run && npm run build && npx cap sync
python scripts/e2e.py && python scripts/e2e_pick2.py      # 開発サーバー(npx vite --port 5191)を立ててから
python scripts/make_screenshots.py                        # exams/<試験>/store/shot_1〜5.png
powershell -File scripts/build-android.ps1 -Exam <試験>
```
- 画面写真: ホーム・予想点・年度別は普通の見本データ、解いた直後と結果だけ warm=1 で撮る(warm=1 で全部撮ると正答率100%・満点に見えた)
- 元のデータ: 管理栄養士 Downloads/管理栄養士国試アプリ_2026-10-01/data、臨床検査技師 Downloads/臨床検査技師国試アプリ_2026-10-02/data
- iOS のワークフローは ../_pending/ios-testflight.yml(exam を選べる形)。gh に workflow 権限が付いたら .github/workflows/ へ戻して push

## iOS(2026-10-02)
- gh に workflow 権限を足し、.github/workflows/ios-testflight.yml を push した(exam を選んで実行)
- compile_only を2本とも実行: 管理栄養士 run 37014231286 / 臨床検査技師 run 37014237357、どちらも ** BUILD SUCCEEDED **・単体テスト17件 OK
- TestFlight へ送るには: App Store Connect にアプリ2本を作る + シークレット ASC_ISSUER_ID と APPLE_TEAM_ID を入れる → compile_only=false で実行

## App Store Connect(2026-10-02 夜)
- Issuer ID c2e4b817-492e-48b1-b0a8-4f999f53e7f7 / Team ID K639HGXHVV(シークレット4つそろった)
- バンドルID: jp.nigatecho.kanrieiyoushi (A5T3CY6Z8D)・jp.nigatecho.rinshokensa (G2R6H4ZQB4)。API で登録
- アプリ: 管理栄養士 6818535389 / 臨床検査技師 6818536142(画面で作成)
- App内課金(API): nigatecho_kanri_full 6818536985 / nigatecho_rinsho_full 6818537154。非消耗型・¥980(日本基準)・日本語の表示名と説明・審査メモと購入画面の写真まで入れた
- TestFlight: 管理栄養士 ビルド3・臨床検査技師 ビルド4 が VALID。社内テストのグループに持ち主を入れた
- API の道具: scratchpad の asc.py / asc_iap.py / asc_iap_review.py / asc_beta.py(鍵は Downloads/AuthKey_NNBSHB2KC9.p8)
- 残り(持ち主): 有料アプリケーション契約(銀行・税)、RevenueCat の登録 → 公開APIキーを src/platform/billing.ts へ

## 理学療法士(作業中 2026-10-03)
- データ: Downloads/理学療法士国試アプリ_2026-10-03/data(1,000問・実地200問は3点・2つ選ぶ136・除外11)
- 解説: 5人が expl/57〜61.json を書いている途中 → merge_expl.py pt <data> → 検査3人
- exams/pt/exam.json を作った(試験日は厚労省の発表待ちで空欄)。subPass(実地問題35
## 理学療法士(作業中 2026-10-03)
- データ: Downloads/理学療法士国試アプリ_2026-10-03/data(1,000問・実地200問は3点・2つ選ぶ136・除外11)
- 解説: 5人が expl/57〜61.json を書いている途中 → merge_expl.py pt <data> → 検査3人
- exams/pt/exam.json を作った(試験日は厚労省の発表待ちで空欄)。実地問題の基準(約35%)の計算 subEstimate は study.ts にあるが、画面にはまだつないでいない
- 残り: 殻(cap add)・アイコン・サポートページ pt/・写真・AAB・App Store Connect にアプリと商品

## RevenueCat(2026-10-03)
- プロジェクト Nigatecho(a274f6e7)。秘密キー(V2・プロジェクト設定の読み書き)は %LOCALAPPDATA%/NigatechoBuild/revenuecat_secret.txt
- API で登録: App Store のアプリ3つ・entitlement full・商品3つ(非消耗型)・売り場 default に $rc_lifetime パッケージ
- 公開キー(iOS)は exams/<試験>/exam.json の revenuecat.ios。src/platform/billing.ts がそこから読む。Android はまだ空
- 道具: tools/ に rc_setup.py(何度流しても二重に作らない)
- 残り: RevenueCat の各 iOS アプリに App Store Connect の「アプリ内購入キー」(p8)を入れる(購入の検証に要る)。App Store Connect にログインしてキーを作る必要がある
- 持ち主へ: RevenueCat のメールアドレスの確認(確認メールのリンク)

## 理学療法士(2026-10-03)
- 解説1,000問、検査で36問を直した。実地問題の基準の表示を画面につないだ。殻・アイコン・サポートページ pt/・ストア説明文あり
- 残り: App Store Connect にアプリと商品(ログイン待ち)、画面写真、AAB

## 課金とTestFlight(2026-10-03)
- 有料アプリケーション契約: 持ち主が済ませた
- App Store Connect のアプリ内購入キー 2M7WGPA845 を作り、RevenueCat の3アプリに登録(subscription_key_configured: True)。鍵の控えは %LOCALAPPDATA%/NigatechoBuild
- 理学療法士: アプリ 6818565109・商品 nigatecho_pt_full(6818565217)・TestFlight の社内グループ
- 商品3つとも審査用写真 COMPLETE・READY_TO_SUBMIT(写真は scripts/shot_paywall.py で 1290x2796)
- TestFlight: 管理栄養士 ビルド5 / 臨床検査技師 ビルド6 / 理学療法士 ビルド8(どれも RevenueCat の公開キー入り・VALID)
- テストは npm run test:all で全試験に切り替えて流す(理学療法士でだけ落ちたことがある)
- 残り: ストアの掲載情報(説明文・画面写真・年齢区分・プライバシー・審査用の連絡先)→ 審査に提出。Android(Play)は未着手

## 審査に提出(2026-10-03)
- 3本とも WAITING_FOR_REVIEW(束の中身はバージョン 1.0 と App内課金)
- 掲載情報は tools/asc_listing.py(API): カテゴリ 教育/医療・年齢区分(医療/治療の情報 あり・健康の話題 あり)・著作権の申告(第三者のコンテンツを使用)・名前/サブタイトル/説明文/キーワード/URL・画面写真5枚・ビルド・審査の連絡先とメモ・無料・日本だけで販売・承認後に自動で公開
- アプリのプライバシー(画面): ユーザID と 購入履歴、どちらも「アプリの機能」・個人に結びつけない・追跡しない
- 最初の非消耗型の課金は API では提出できない(FIRST_NON_CONSUMABLE_MUST_BE_SUBMITTED_ON_VERSION)。API で束を作ってバージョンを入れ、課金の画面の「審査用に追加」でその束を選び、API で submitted: true

## 告知(承認後に出す)
- 画像: promo/ニガテ帳_告知_X.png(ChatGPT の背景+実物の画面を scripts/fix_promo.py で貼った。ChatGPT が描いた画面は架空の UI だったので使わない)
- 投稿文: promo/X_post_draft.txt(X の重み 273/280)。アカウントは @apkderete(持ち主の決定)
- 承認されたら: nigatecho-site の入口に3本の App Store のリンクを載せる → 文面と宛先を持ち主に1回見せてから投稿

## Google Play(2026-10-03)
- Play Console(開発者アカウント hatotools)に3本を作成。既定の言語 日本語・アプリ・無料
  - 管理栄養士 4974784348811126470 / 臨床検査技師 4975352707790969913 / 理学療法士 4973194452541590038
- ストア掲載情報: 簡単な説明・説明文(STORE-LISTING-ja.md)・アイコン512・フィーチャーグラフィック・画面写真5枚(1080x1920)。画像は scripts/make_play_assets.py <試験> → exams/<試験>/store/play/
  - 画面写真の並び順が 1→5 になっていない(アップロード順のまま)。公開前に並べ替える
- アプリのコンテンツ 10件すべて申告済み(3本とも)
  - プライバシーポリシー: サイトの privacy.html(試験ごと)/ 広告なし / ログインの詳細: 制限なし(ログインなし。完全版は Play の買い切り課金)
  - レーティング: その他のアプリ・デジタル商品の購入あり・教育 / ターゲット 18歳以上 / 広告ID なし(AAB に AD_ID 権限なし)
  - データセーフティ: 購入履歴を収集(RevenueCat。共有なし・一時処理でない・必須・アプリの機能)、送信時暗号化、アカウント作成なし
  - 行政アプリ いいえ / 金融取引機能 なし / 健康: 医療文献と教育
- ストアの設定: カテゴリ 教育、連絡先 kame6493@gmail.com とサイト(試験ごと)
- クローズドテスト Alpha: 国=日本、テスター=メールリスト「カチマケ 開発者」(自分1人)、フィードバック先 kame6493@gmail.com。3本とも 2/4 完了
- AAB: releases/nigatecho-<試験>-release.aab(versionCode 1 / 1.0.0、署名 CN=Nigatecho)。scripts/build-android-all.sh で3本まとめて作れる
  - 理学療法士の署名鍵は 10-03 のこのビルドで新しく作った(%LOCALAPPDATA%\NigatechoBuild\signing\pt)。3本分の鍵フォルダを PC の外へ控えること
- 残り
  1. AAB 3本のアップロード: 15〜18MB あり、ブラウザ操作のツールでは 10MB までしか上げられない → 持ち主が「新しいリリースを作成」画面へドラッグ
  2. テスター用 Google グループ nigatecho-testers を作り、3本のトラックに追加(作成画面は Chrome が前面にないと選択肢が動かない)
  3. リリースを審査へ送信 → 12人×14日
  4. Android の課金: Play に商品(exam.json の productId: nigatecho_<試験>_full)を作成、RevenueCat に Android アプリとサービスアカウント JSON を登録、exam.json の revenuecat.android を入れて versionCode 2 で作り直す(今の AAB は Android の鍵が空なので購入できない)

## 審査中のまま掲載情報を直した(2026-10-03 昼)
- App Store Connect は審査待ち(WAITING_FOR_REVIEW)でも API で説明文・キーワード・サブタイトル・プロモーション用テキストを書き換えられた(すべて 200)
  - 臨床検査技師・理学療法士の説明文の収録回を正しい回数に(第68〜72回 / 第57〜61回)
  - キーワードとサブタイトルを promo/launch_plan.md 4-1 の案へ(サブタイトル「国試の苦手だけが残る 一問一答・模試」)
  - プロモーション用テキストを「承認〜10月」版へ
- これで 1.0.1 は不要になった。一度 1.0.1 のビルドを3本起動したが止め、版番号も 1.0.0 に戻した
- 道具: tools/asc_101.py(promo / fixdesc / keywords / prepare / submit)

## Google Play クローズドテストを審査へ(2026-10-03 午後)
- AAB 3本をアップロードしてリリース「1.0.0 クローズドテスト」を作成・保存し、公開の概要から審査に送信(3本とも)
  - 管理栄養士は持ち主がドラッグ。臨床検査技師・理学療法士は tools/pick_file.ps1(Windows のファイル選択画面へ WM_SETTEXT と BM_CLICK)で上げた
  - 警告は「難読化解除ファイルなし」の1件だけ
- テスター用 Google グループ nigatecho-testers@googlegroups.com を作成(検索・参加は誰でも、投稿とメンバー一覧は管理者のみ)。作成時の CAPTCHA は持ち主
- 3本のクローズドテストのテスターをこのグループに変更し、審査に送り直した(理学療法士は進行中の審査をやり直し)
- テスターの参加手順(3本共通のグループに1回入れば3本とも入れる)
  1. https://groups.google.com/g/nigatecho-testers に参加
  2. https://play.google.com/apps/testing/jp.nigatecho.kanrieiyoushi / .../jp.nigatecho.rinshokensa / .../jp.nigatecho.rigakuryouhoushi で「テスターになる」
- 残り: 審査が通ったら12人集め、14日続ける。Android の課金(Play の商品・RevenueCat の Android 鍵)

## X(@apkderete)の運用開始(2026-10-03)
- 12:54 Android 版テスター募集を投稿(本文 promo/tester_post.txt、リンク先はサイトの #tester)
- サイト3ページに「Android 版のテスター募集」の節を追加(グループ参加 → テスト参加ページ)
- 今日の1問: このセッションの定期実行で毎日 18:02 理学療法士 / 19:02 臨床検査技師 / 20:02 管理栄養士。promo/daily_questions.json から未投稿の1件を出し、答えと解説は返信。投稿済みは promo/daily_posted.json
  - 定期実行は7日で切れ、セッションを閉じても止まる。続けるときは作り直す。在庫は各試験10問
