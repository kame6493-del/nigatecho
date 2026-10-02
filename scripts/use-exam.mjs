// どの試験のアプリとして組むかを切り替える。node scripts/use-exam.mjs kanri
// - exams/<dir>/exam.json → src/exam.current.json(画面の設定)
// - capacitor.config.json(アプリの ID・名前・iOS/Android の殻の場所)
// - exams/<dir>/data → public/data(問題と図)
// この環境の Node は cpSync / rmSync の再帰で無言で落ちるので、1ファイルずつ copyFileSync で写す。
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir || !existsSync(join('exams', dir, 'exam.json'))) {
  console.error('使い方: node scripts/use-exam.mjs <exams の下のフォルダ名>');
  process.exit(1);
}
const exam = JSON.parse(readFileSync(join('exams', dir, 'exam.json'), 'utf8'));

writeFileSync('src/exam.current.json', JSON.stringify(exam, null, 2) + '\n');
writeFileSync('capacitor.config.json', JSON.stringify({
  appId: exam.appId,
  appName: exam.appName,
  webDir: 'dist',
  backgroundColor: '#fbf8f1',
  android: { path: `exams/${dir}/android`, allowMixedContent: false },
  ios: { path: `exams/${dir}/ios`, contentInset: 'never' },
}, null, 2) + '\n');

function remove(p) {
  for (const name of readdirSync(p)) {
    const q = join(p, name);
    if (statSync(q).isDirectory()) remove(q); else unlinkSync(q);
  }
  rmdirSync(p);
}
function copy(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name), d = join(dst, name);
    if (statSync(s).isDirectory()) copy(s, d); else copyFileSync(s, d);
  }
}
if (existsSync('public/data')) remove('public/data');
copy(join('exams', dir, 'data'), 'public/data');
console.log(`${exam.name} に切り替えました(${exam.appId})`);
