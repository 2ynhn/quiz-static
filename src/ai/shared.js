import { AiError } from './errors.js';

// JSON 모드/프롬프트 강제를 쓰더라도 방어적으로 코드펜스를 제거하고 파싱한다.
export function parseJson(text) {
  const cleaned = String(text)
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AiError('parse', 'AI 응답을 해석하지 못했습니다.');
  }
}

export function normalizeQuestions(parsed) {
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const valid = questions.filter((q) => q && q.question && q.answer);
  if (valid.length === 0) {
    throw new AiError('parse', 'AI가 유효한 문제를 만들지 못했습니다.');
  }
  return valid.map((q) => ({
    question: String(q.question),
    answer: String(q.answer),
    hint: q.hint ? String(q.hint) : '',
    altAnswers: Array.isArray(q.altAnswers) ? q.altAnswers.map(String) : [],
  }));
}

// 추천 응답은 [{name, theme}] 형태로 정규화 — 문자열 배열(구 스키마)도 허용
export function normalizeCategories(parsed) {
  const list = Array.isArray(parsed?.categories) ? parsed.categories : [];
  const items = list
    .map((entry) => {
      if (typeof entry === 'string') return { name: entry, theme: null };
      if (entry && typeof entry === 'object' && entry.name) {
        return { name: String(entry.name), theme: entry.theme || null };
      }
      return null;
    })
    .filter(Boolean);
  if (items.length < 2) {
    throw new AiError('parse', '추천 카테고리 생성에 실패했습니다.');
  }
  return items.slice(0, 2);
}

// ── 기계적 품질 필터 ──────────────────────────────────────────

// 정답 비교용 정규화: 소문자화 + 공백·문장부호 제거 ("훈민정음" vs "훈민 정음" 동일 취급)
export function normalizeForLeak(s) {
  return String(s)
    .toLowerCase()
    .replace(/[\s·\-‧.,'"“”‘’()[\]?!~]/g, '');
}

// 문제문/힌트에 정답(또는 altAnswers)이 그대로 노출된 문제를 걸러낸다.
export function leaksAnswer(q) {
  const answers = [q.answer, ...(q.altAnswers || [])]
    .map(normalizeForLeak)
    .filter((a) => a.length >= 2); // 1글자 답은 오탐이 많아 검수 단계에 맡긴다
  if (answers.length === 0) return false;
  const questionText = normalizeForLeak(q.question);
  const hintText = normalizeForLeak(q.hint || '');
  return answers.some((a) => questionText.includes(a) || hintText.includes(a));
}

// 검수 응답({"results":[{index,pass}]})을 적용해 통과한 문제만 남긴다.
// 응답 형식이 어긋나면 검수를 건너뛴다(원본 유지) — 검수 실패가 게임을 막으면 안 된다.
export function applyReview(questions, parsed) {
  const results = Array.isArray(parsed?.results) ? parsed.results : null;
  if (!results) return questions;
  const passed = new Set(
    results.filter((r) => r && r.pass === true).map((r) => Number(r.index))
  );
  return questions.filter((_, i) => passed.has(i));
}
