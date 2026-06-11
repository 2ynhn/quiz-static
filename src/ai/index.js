// provider 어댑터 진입점 — 새 프로바이더는 어댑터 모듈 + 이 레지스트리 + constants.PROVIDERS에 추가한다.
// 품질 파이프라인: ① 후보를 여유 있게 생성 → ② 정답 노출 기계 필터 → ③ AI 교차 검수 → ④ 요청 수만큼 반환
import { openaiProvider } from './openai.js';
import { anthropicProvider } from './anthropic.js';
import { AiError } from './errors.js';
import {
  QUESTION_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  RECOMMEND_SYSTEM_PROMPT,
  buildQuestionUserPrompt,
  buildReviewUserPrompt,
  buildRecommendUserPrompt,
} from './prompts.js';
import {
  normalizeQuestions,
  normalizeCategories,
  leaksAnswer,
  applyReview,
} from './shared.js';

const adapters = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

function getAdapter(providerId) {
  const adapter = adapters[providerId];
  if (!adapter) {
    throw new AiError('network', `지원하지 않는 프로바이더입니다: ${providerId}`);
  }
  return adapter;
}

export { AiError };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRateLimitRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AiError && e.type === 'rate_limit') {
      await sleep(2000);
      return await fn(); // 1회만 자동 재시도, 실패 시 호출부에서 폴백 처리
    }
    throw e;
  }
}

export async function generateQuestions({
  provider,
  apiKey,
  model,
  category,
  difficulty,
  count,
  excludeKeywords = [],
}) {
  const adapter = getAdapter(provider);

  // ① 검수 탈락분을 감안해 후보를 여유 있게 생성
  const candidateCount = Math.min(count + 4, 16);
  const generated = await withRateLimitRetry(() =>
    adapter.completeJSON({
      apiKey,
      model,
      system: QUESTION_SYSTEM_PROMPT,
      user: buildQuestionUserPrompt({
        category,
        difficulty,
        count: candidateCount,
        excludeKeywords,
      }),
    })
  );
  let questions = normalizeQuestions(generated);

  // ② 문제문/힌트에 정답이 그대로 노출된 문제는 기계적으로 제거
  const filtered = questions.filter((q) => !leaksAnswer(q));
  if (filtered.length > 0) questions = filtered;

  // ③ 같은 모델을 검수자로 한 번 더 호출해 오답·난이도 이탈·창작 문제를 탈락시킨다.
  //    검수 호출 자체가 실패하면 1차 결과를 그대로 사용한다 (게임을 막지 않는다).
  try {
    const review = await withRateLimitRetry(() =>
      adapter.completeJSON({
        apiKey,
        model,
        system: REVIEW_SYSTEM_PROMPT,
        user: buildReviewUserPrompt({ questions, difficulty }),
      })
    );
    const passed = applyReview(questions, review);
    if (passed.length > 0) questions = passed;
  } catch {
    // 검수 생략
  }

  return questions.slice(0, count);
}

export async function generateRecommended({ provider, apiKey, model, exclude = [] }) {
  const adapter = getAdapter(provider);
  const parsed = await withRateLimitRetry(() =>
    adapter.completeJSON({
      apiKey,
      model,
      system: RECOMMEND_SYSTEM_PROMPT,
      user: buildRecommendUserPrompt(exclude),
    })
  );
  return normalizeCategories(parsed);
}

export function validateKey(provider, apiKey, model) {
  return getAdapter(provider).validateKey(apiKey, model);
}
