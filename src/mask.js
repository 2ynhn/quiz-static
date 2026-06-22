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

// 단어 완성용 마스킹(공백 인정): 앞 N글자만 남기고 나머지를 '□'(U+25A1)로 가린다.
//  - 공백은 글자 수에 포함하지 않고, 출제 시 그대로 보여준다. (예: "분노의 질주" → "분노의 □□")
//  - 가리는 칸(□)은 공백을 가로지르지 않는다. 가려지는 구간은 '마지막 공백 이후'(마지막 단어 쪽)의
//    연속 구간이어야 하므로, 노출 글자 수가 마지막 공백 앞 글자 수보다 작으면 그만큼 끌어올린다.
//    ('분노의 □□' OK / '분노□ □□' 금지)
//  - revealCount는 '공백 제외' 기준 앞에서 보여줄 글자 수. 가릴 글자가 없으면 null.
export function applyBracketMask(answer, revealCount) {
  const chars = [...String(answer).replace(/\s+/g, ' ').trim()];
  const total = chars.filter((c) => c !== ' ').length; // 공백 제외 글자 수
  if (total <= revealCount) return null; // 가릴 글자가 없음

  // 마지막 공백 앞의 '공백 제외' 글자 수 = 가릴 수 없는(반드시 보여야 하는) 최소 노출 글자 수
  let lastSpace = -1;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (chars[i] === ' ') {
      lastSpace = i;
      break;
    }
  }
  let minReveal = 0;
  if (lastSpace >= 0) {
    for (let i = 0; i < lastSpace; i += 1) {
      if (chars[i] !== ' ') minReveal += 1;
    }
  }
  // 최소 1칸은 가려야 하므로 노출은 total-1 이하
  const reveal = Math.min(Math.max(revealCount, minReveal), total - 1);

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

// 단어 완성 노출 규칙(난이도 무관, 모든 주제 공통):
//  - 보이는 글자(노출) 최소 2글자, 가리는 글자(□)는 최대 2글자.
//  - 3글자 답: 뒤 1글자 가림 / 4글자 이상: 뒤 2글자 가림.
//  - 2글자 이하 답: 노출 2 + 가림 1을 만들 수 없어 출제 제외(아래 reveal 계산이 total과 같아져 마스킹 null).
// 공백 제외 글자 수(visibleLength)를 받아 '앞에서 보여줄 글자 수'를 돌려준다.
export function revealCountForWord(visibleLength) {
  return Math.max(2, visibleLength - 2); // 가림 = min(2, len-2)
}

// 단어 완성 최소 정답 길이(공백 제외) — 노출 2 + 가림 1 이상이 되려면 3글자 이상이어야 함
export const WORD_MIN_CHARS = 3;
