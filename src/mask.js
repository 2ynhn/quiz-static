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

// 단어 완성용: 앞 N글자만 남기고 남은 글자 수만큼 '[ ]'로 가린다 (길이 노출).
// 예: 인터스텔라, 2 → "인터[ ][ ][ ]" / 결초보은, 2 → "결초[ ][ ]"
export function applyBracketMask(answer, revealCount) {
  const chars = [...String(answer)];
  if (chars.length <= revealCount) return null;
  const hidden = chars.length - revealCount;
  return chars.slice(0, revealCount).join('') + '[ ]'.repeat(hidden);
}

// 난이도 → 가릴(빈 칸) 글자 수 목표: 하 1~2칸, 중 3~4칸, 상 5칸 이상.
function hiddenTargetFor(difficulty) {
  if (difficulty === '하') return 2;
  if (difficulty === '상') return 6;
  return 4; // 중(기본)
}

// 난이도별 '앞에서 최소로 보여줄 글자 수' — 중·상은 한 글자만 보이면 너무 어려우므로 최소 2글자.
function minRevealFor(difficulty) {
  return difficulty === '하' ? 1 : 2;
}

// 단어 길이와 난이도로 '앞에서 보여줄 글자 수'를 계산한다.
// 난이도별 최소 노출 글자(중·상 2글자)를 보장하고, 남는 범위에서 목표 칸 수만큼 가린다.
//  - 하: 1~2칸, 중: 3~4칸, 상: 5칸 이상 (단어가 짧으면 가능한 만큼만)
export function revealCountForDifficulty(length, difficulty) {
  const target = hiddenTargetFor(difficulty);
  const minReveal = minRevealFor(difficulty);
  // 최소 노출 글자를 뺀 나머지를 가림 후보로 두고, 목표치와 비교(최소 1칸은 가림)
  const hidden = Math.min(target, Math.max(1, length - minReveal));
  return Math.max(1, length - hidden);
}

// 해당 난이도의 빈 칸 하한(하 1, 중 3, 상 5)을 채울 수 있는 길이인지 — 난이도별 단어 선별용
export function fitsDifficulty(length, difficulty) {
  const min = difficulty === '하' ? 1 : difficulty === '상' ? 5 : 3;
  return length - minRevealFor(difficulty) >= min; // 최소 노출 글자를 제외한 가용 칸 수
}
