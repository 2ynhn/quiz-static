// 앞 N글자만 보여주고 나머지를 가리는 '프리픽스 마스킹' 처리.
// 가림은 AI가 아니라 코드가 결정적으로 수행한다(AI는 정답 전체만 생성 → 노출 방지).

// 가림 표시는 빈 괄호 한 쌍으로 통일 (예: "인터스텔라" → "인터()")
const MASK_TOKEN = '()';

// 형식 예시(typeHint)에서 마스킹 규칙을 추출한다.
// "인터()", "인터(???)", "천장( )" 처럼 [보이는 글자] + [괄호/밑줄 등 빈칸표시]만으로 된 예시 →
//   { revealCount: 보이는 글자 수 }
// "인터(스)(텔)(라)"(괄호 안에 실제 글자), "ㅇㅂㅇㄹ"(초성), 서술형 문장 → null (마스킹 아님)
export function parseMaskTemplate(typeHint) {
  if (!typeHint) return null;
  const first = String(typeHint).split(',')[0].trim();
  // 앞: 한글 음절/영숫자 1자 이상, 뒤: 괄호·물음표·밑줄·동그라미 등 '빈칸 표시' 문자만
  const mm = first.match(/^([가-힣A-Za-z0-9]+)([\s()[\]?？_＿○●〇□◌.．…-]+)$/);
  if (!mm) return null;
  const placeholder = mm[2];
  // 빈칸 표시로 볼 만한 문자가 실제로 있는지 확인
  if (!/[()[\]?？_＿○●〇□◌.．…]/.test(placeholder)) return null;
  const revealCount = [...mm[1]].length;
  if (revealCount < 1) return null;
  return { revealCount };
}

// 정답을 마스킹 규칙으로 가린 문제 텍스트를 만든다. 가릴 수 없으면 null(해당 문제는 버림).
export function applyMask(answer, revealCount) {
  const chars = [...String(answer)];
  if (chars.length <= revealCount) return null; // 가릴 글자가 없음
  return chars.slice(0, revealCount).join('') + MASK_TOKEN;
}

// 공백 제외 글자 수 (단어 완성은 공백을 글자 수에 포함하지 않는다)
export function visibleLength(s) {
  return [...String(s)].filter((c) => c !== ' ').length;
}

// 단어 완성용 마스킹(공백 인정, 난이도 무관, 모든 주제 공통). 출제 불가면 null.
//  - 공백은 글자 수에 포함하지 않고, 출제 시 그대로 보여준다. □(U+25A1)로 가린다.
//  - 노출 글자(보이는 글자)는 항상 2개 이상이어야 한다(미만이면 제외).
//  [띄어쓰기 없음] 마지막 2글자만 가림(노출 = 길이-2, 최소 2).
//      3글자 → 뒤 1칸(노출2) / 4글자 이상 → 뒤 2칸. 2글자 이하는 제외.
//  [띄어쓰기 있음] 마지막 단어 '전체'를 개수와 무관하게 가리고, 그 앞 단어들은 전부 노출.
//      앞 단어들의 노출 글자 합이 2 미만이면 제외. (예: "분노의 질주" → "분노의 □□")
export function applyBracketMask(answer) {
  const chars = [...String(answer).replace(/\s+/g, ' ').trim()];
  const total = chars.filter((c) => c !== ' ').length; // 공백 제외 글자 수

  // 마지막 공백 위치
  let lastSpace = -1;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (chars[i] === ' ') {
      lastSpace = i;
      break;
    }
  }

  let reveal;
  if (lastSpace >= 0) {
    // 띄어쓰기: 마지막 공백 앞(= 마지막 단어를 뺀 나머지) 전부 노출, 마지막 단어 전체 가림
    let before = 0;
    for (let i = 0; i < lastSpace; i += 1) {
      if (chars[i] !== ' ') before += 1;
    }
    if (before < 2) return null; // 노출 글자 2개 미만 → 제외
    reveal = before;
  } else {
    // 공백 없음: 마지막 2글자만 가림(노출 최소 2)
    reveal = Math.max(2, total - 2);
    if (reveal >= total) return null; // 가릴 글자 없음(2글자 이하)
  }

  let rank = 0;
  let out = '';
  for (const c of chars) {
    if (c === ' ') {
      out += ' ';
      continue;
    }
    out += rank < reveal ? c : '□';
    rank += 1;
  }
  return out;
}

// 단어 완성 최소 정답 길이(공백 제외) — 노출 2 + 가림 1 이상이 되려면 3글자 이상이어야 함
export const WORD_MIN_CHARS = 3;
