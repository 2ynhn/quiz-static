// provider 어댑터 진입점 — 추후 Gemini, quiz-api(공용키 프록시) 어댑터를 여기에 추가한다.
import { openaiProvider } from './openai.js';
import { AiError } from './errors.js';

const provider = openaiProvider;

export { AiError };
export const aiModelName = provider.model;
export const aiProviderName = provider.name;

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

export function generateQuestions(opts) {
  return withRateLimitRetry(() => provider.generateQuestions(opts));
}

export function generateRecommended(opts) {
  return withRateLimitRetry(() => provider.generateRecommended(opts));
}

export function validateKey(apiKey) {
  return provider.validateKey(apiKey);
}
