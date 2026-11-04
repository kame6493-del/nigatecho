import { THANKS_TEXT } from '../domain/thanks';

/** 結果の画面のいちばん下に出すお礼の一言(ただの文。押せない・何も開かない) */
export function ThanksNote() {
  return <p className="thanks-note">{THANKS_TEXT}</p>;
}
