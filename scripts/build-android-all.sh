#!/usr/bin/env bash
# 3本の署名済み AAB を順に作る。bash scripts/build-android-all.sh [kanri rinsho pt]
# 試験を切り替えるたびに public/data と capacitor.config.json が入れ替わるので、1本ずつ build → sync → gradle の順で回す
set -euo pipefail
cd "$(dirname "$0")/.."
EXAMS=("${@:-kanri rinsho pt}")
[ $# -eq 0 ] && EXAMS=(kanri rinsho pt)
for ex in "${EXAMS[@]}"; do
  echo "== $ex"
  node scripts/use-exam.mjs "$ex"
  npm run build --silent
  npx cap sync android
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1 -Exam "$ex"
  ls -l "releases/nigatecho-$ex-release.aab"
done
# 最後は管理栄養士に戻しておく(開発の既定)
node scripts/use-exam.mjs kanri
echo done
