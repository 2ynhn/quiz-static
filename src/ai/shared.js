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

export function normalizeCategories(parsed) {
  const categories = Array.isArray(parsed?.categories) ? parsed.categories.map(String) : [];
  if (categories.length < 2) {
    throw new AiError('parse', '추천 카테고리 생성에 실패했습니다.');
  }
  return categories.slice(0, 2);
}
