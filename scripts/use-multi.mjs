// 試験を選べる1本のアプリ(公開中の管理栄養士のアプリ)として組む。node scripts/use-multi.mjs
// - exams/multi.json の exams に並べた試験の exam.json → src/exams.multi.json(画面の設定。商品は multi.json の products で上書き)
// - capacitor.config.json(アプリの ID・名前・iOS/Android の殻は appExam の物。公開中のアプリと同じ)
// - exams/<試験>/data → public/data/<試験>/(問題と図)
// この環境の Node は cpSync / rmSync の再帰で無言で落ちるので、1ファイルずつ copyFileSync で写す。
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const multi = JSON.parse(readFileSync('exams/multi.json', 'utf8'));
const read = (dir) => JSON.parse(readFileSync(join('exams', dir, 'exam.json'), 'utf8'));
const app = read(multi.appExam);
// まとめアプリの名前。ストアと capacitor は appName、ホーム画面(アイコンの下)は homeName。無ければ appExam の物
const appName = multi.appName ?? app.appName;
const homeName = multi.homeName ?? app.homeName;

const exams = multi.exams.map((dir) => {
  const e = read(dir);
  const qs = JSON.parse(readFileSync(join('exams', dir, 'data', 'questions.json'), 'utf8'));
  const rounds = [...new Set(qs.map((q) => q.exam))].sort((a, b) => a - b);
  // 単体のアプリ用の項目(アプリID・RevenueCat のキー)は、まとめアプリでは使わないので落とす
  const { appId: _a, appName: _n, revenuecat: _r, launcherName: _l, ...rest } = e;
  return { ...rest, ...(multi.products[dir] ?? {}), count: qs.length, rounds };
});
if (exams[0].dir !== multi.appExam) throw new Error('exams の先頭は appExam(はじめて開いたときの試験)にする');
const keys = new Set(exams.map((e) => e.key));
if (keys.size !== exams.length) throw new Error('試験の key が重なっている(記録の保存先が混ざる)');
const ents = exams.map((e) => e.entitlement);
if (new Set(ents).size !== ents.length) throw new Error('entitlement が重なっている(1つ買うとほかの試験も開いてしまう)');

writeFileSync('src/exams.multi.json', JSON.stringify({
  app: { appId: app.appId, appName, homeName, site: app.site, revenuecat: app.revenuecat },
  exams,
}, null, 2) + '\n');
// 単体テストやほかの道具が読む「いまの試験」は、はじめて開いたときの試験(管理栄養士)にしておく
writeFileSync('src/exam.current.json', JSON.stringify(read(multi.appExam), null, 2) + '\n');
writeFileSync('capacitor.config.json', JSON.stringify({
  appId: app.appId,
  appName,
  webDir: 'dist',
  backgroundColor: '#fbf8f1',
  android: { path: `exams/${multi.appExam}/android`, allowMixedContent: false },
  ios: { path: `exams/${multi.appExam}/ios`, contentInset: 'never' },
}, null, 2) + '\n');

// ホーム画面の名前を iOS / Android の殻に書く(npx cap sync はここを書き換えないので、組むたびに合わせておく)
function setHomeName(path, re, label) {
  if (!existsSync(path)) { console.warn(`(${label} が無いので飛ばしました: ${path})`); return; }
  const s = readFileSync(path, 'utf8');
  if (!re.test(s)) throw new Error(`${label} にホーム画面の名前の欄が見つからない: ${path}`);
  writeFileSync(path, s.replace(re, (_m, a, b) => `${a}${homeName}${b}`));
}
const shell = join('exams', multi.appExam);
setHomeName(join(shell, 'ios/App/App/Info.plist'), /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, 'Info.plist');
const strings = join(shell, 'android/app/src/main/res/values/strings.xml');
setHomeName(strings, /(<string name="app_name">)[^<]*(<\/string>)/, 'strings.xml');
setHomeName(strings, /(<string name="title_activity_main">)[^<]*(<\/string>)/, 'strings.xml');

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
for (const e of exams) copy(join('exams', e.dir, 'data'), join('public', 'data', e.dir));
console.log(`まとめアプリ「${appName}」(${app.appId}・ホーム画面「${homeName}」)に切り替えました: ${exams.map((e) => `${e.name} ${e.count}問`).join(' / ')}`);
