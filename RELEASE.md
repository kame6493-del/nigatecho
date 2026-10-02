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
