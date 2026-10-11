// まとめアプリ(試験を選べる管理栄養士のアプリ)を組み直してから単体テストを流す。npm run test:all
// 試験ごとの設定・問題データ・出典・商品の重なりは src/domain/multi.test.ts が全試験について確かめる。
// 続けて臨床検査技師の単体のアプリ(exams/multi.rinsho.json)でも組んで流す(multi.test.ts はまとめアプリ専用なので外す)。
// 最後はまとめアプリの組み方に戻す。臨床検査技師で組みたいときは、このあと node scripts/use-multi.mjs exams/multi.rinsho.json
import { execSync } from 'node:child_process';

let failed = false;
const run = (cmd) => {
  try { execSync(cmd, { stdio: 'inherit' }); } catch { failed = true; }
};
execSync('node scripts/use-multi.mjs', { stdio: 'inherit' });
run('npx vitest run');
execSync('node scripts/use-multi.mjs exams/multi.rinsho.json', { stdio: 'inherit' });
run('npx vitest run --exclude src/domain/multi.test.ts');
execSync('node scripts/use-multi.mjs', { stdio: 'inherit' });
if (failed) process.exit(1);
