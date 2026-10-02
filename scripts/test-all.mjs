// すべての試験に切り替えながら単体テストを流す。npm run test:all
// (科目の数や配点は試験ごとに違う。2つの試験でしか流さなかったら、理学療法士でだけ落ちた)
import { execSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';

const exams = readdirSync('exams').filter((d) => existsSync(`exams/${d}/exam.json`));
let failed = 0;
for (const ex of exams) {
  execSync(`node scripts/use-exam.mjs ${ex}`, { stdio: 'inherit' });
  try {
    execSync('npx vitest run', { stdio: 'inherit' });
  } catch {
    failed++;
    console.error(`${ex} でテストが落ちた`);
  }
}
execSync('node scripts/use-exam.mjs kanri', { stdio: 'inherit' });
process.exit(failed ? 1 : 0);
