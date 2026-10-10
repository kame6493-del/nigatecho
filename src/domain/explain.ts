/**
 * 解説の文を「正答の理由」と「選択肢ごとの理由」に分ける(画面の見出しを分けるためだけ。文は変えない)。
 * 解説の書き方は全試験で同じ: 1行目「正答 2: 理由…」、続く行「1 × 理由…」「3 ○ …」。
 * 番号で始まらない行(「※現在は…」など)は、直前の段の続きにする。
 * 形が合わないときは parsed=false で、画面は解説をそのまま1つの段で出す。
 */
export interface ChoiceReason {
  /** 1始まりの選択肢の番号 */
  no: number;
  /** "×" か "○" */
  mark: string;
  text: string;
}

export interface ExplainParts {
  parsed: boolean;
  /** 「正答 2」の部分(無ければ空) */
  head: string;
  /** 正答の理由(1行目の「正答 N:」の後ろと、その続きの行) */
  reason: string;
  choices: ChoiceReason[];
}

const CHOICE = /^(\d{1,2})\s*([×○✕])\s*(.*)$/;

export function splitExplanation(text: string | undefined | null): ExplainParts {
  const raw = (text ?? '').trim();
  if (!raw) return { parsed: false, head: '', reason: '', choices: [] };
  const lines = raw.split('\n');
  const m = /^(正答[^:：]*)[:：]\s*(.*)$/.exec(lines[0]);
  if (!m) return { parsed: false, head: '', reason: raw, choices: [] };
  const head = m[1].trim();
  const reason: string[] = [m[2]];
  const choices: ChoiceReason[] = [];
  for (const line of lines.slice(1)) {
    const c = CHOICE.exec(line);
    if (c) choices.push({ no: Number(c[1]), mark: c[2] === '✕' ? '×' : c[2], text: c[3] });
    else if (choices.length) choices[choices.length - 1].text += `\n${line}`;
    else reason.push(line);
  }
  return { parsed: true, head, reason: reason.join('\n').trim(), choices };
}
