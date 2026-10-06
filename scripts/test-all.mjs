// まとめアプリ(試験を選べる管理栄養士のアプリ)を組み直してから単体テストを流す。npm run test:all
// 試験ごとの設定・問題データ・出典・商品の重なりは src/domain/multi.test.ts が全試験について確かめる。
import { execSync } from 'node:child_process';

execSync('node scripts/use-multi.mjs', { stdio: 'inherit' });
try {
  execSync('npx vitest run', { stdio: 'inherit' });
} catch {
  process.exit(1);
}
