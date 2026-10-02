# ニガテ帳(管理栄養士)の Android 公開用ビルド(署名済み AAB と APK)。
# - JDK と SDK は DIAMOND NINE 用に入っている物を読むだけで使う
# - 署名鍵はニガテ帳専用。%LOCALAPPDATA%\NigatechoBuild\signing に置き、パスワードは DPAPI(このWindowsユーザーだけが復号できる)で保存
# - 鍵を上書き・作り直ししない。無くしたら Play Console で「アップロード鍵のリセット」を申請することになる
# - プロジェクトのパスに日本語があると Gradle が止まるので、一時ドライブ(subst)で英字のパスに見せる
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$tools = Join-Path $env:LOCALAPPDATA 'Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\DiamondNineBuild'
if (!(Test-Path "$tools\java")) { $tools = Join-Path $env:LOCALAPPDATA 'DiamondNineBuild' }
$env:JAVA_HOME = (Get-ChildItem "$tools\java" -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = "$tools\android-sdk"
if (!(Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw 'JDK が見つかりません' }

$secretDir = Join-Path $env:LOCALAPPDATA 'NigatechoBuild\signing'
New-Item -ItemType Directory -Force $secretDir | Out-Null
$store = Join-Path $secretDir 'nigatecho-upload.jks'
$passFile = Join-Path $secretDir 'upload-password.dpapi'
if (!(Test-Path $store)) {
  if (Test-Path $passFile) { throw 'パスワードだけ残っていて鍵がありません。鍵を復元してください(作り直さない)' }
  $bytes = New-Object byte[] 36
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $password = [Convert]::ToBase64String($bytes)
  $password | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content $passFile
  $env:NG_UPLOAD_PASSWORD = $password
  # keytool は経過をエラー出力に書く。ここだけ止まらない設定にして、終了コードと鍵ファイルで判定する
  $ErrorActionPreference = 'Continue'
  & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -keystore $store -storetype JKS -alias nigatecho-upload -keyalg RSA -keysize 3072 -validity 10000 -storepass:env NG_UPLOAD_PASSWORD -keypass:env NG_UPLOAD_PASSWORD -dname 'CN=Nigatecho, O=Nigatecho, C=JP' -noprompt 2>&1 | Out-Null
  $code = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($code -ne 0 -or !(Test-Path $store)) { Remove-Item $passFile -ErrorAction SilentlyContinue; throw '署名鍵を作れませんでした' }
  Write-Output "署名鍵を作りました: $store (PC を替える前に、このフォルダごと安全な場所へ控えてください)"
} else {
  $secure = Get-Content $passFile | ConvertTo-SecureString
  $env:NG_UPLOAD_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
}
$env:NG_UPLOAD_STORE = $store

$drive = 'K:'
if (Test-Path "$drive\") { throw "$drive は使用中です" }
subst $drive (Split-Path $repo -Parent)
try {
  $proj = "$drive\$(Split-Path $repo -Leaf)\android"
  "sdk.dir=$($env:ANDROID_HOME -replace '\\','/')" | Out-File -Encoding ascii "$proj\local.properties"
  $p = Start-Process -FilePath "$proj\gradlew.bat" -ArgumentList ':app:assembleRelease', ':app:bundleRelease', '--no-daemon', '-q' -WorkingDirectory $proj -NoNewWindow -Wait -PassThru -RedirectStandardError "$env:TEMP\ng_release_err.txt"
  if ($p.ExitCode -ne 0) { Get-Content "$env:TEMP\ng_release_err.txt" -Tail 30; throw "Gradle が失敗しました (exit $($p.ExitCode))" }
  $out = Join-Path $repo 'releases'
  New-Item -ItemType Directory -Force $out | Out-Null
  Copy-Item "$proj\app\build\outputs\bundle\release\app-release.aab" "$out\nigatecho-kanri-release.aab" -Force
  Copy-Item "$proj\app\build\outputs\apk\release\app-release.apk" "$out\nigatecho-kanri-release.apk" -Force
  Write-Output "出力: $out"
} finally {
  subst $drive /D
  Remove-Item Env:NG_UPLOAD_PASSWORD, Env:NG_UPLOAD_STORE -ErrorAction SilentlyContinue
}
