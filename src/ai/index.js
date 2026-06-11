// provider 어댑터 진입점 — 새 프로바이더는 어댑터 모듈 + 이 레지스트리 + constants.PROVIDERS에 추가한다.
import { openaiProvider } from './openai.js';
import { anthropicProvider } from './anthropic.js';
import { AiError } from './errors.js';

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

export function generateQuestions({ provider, ...opts }) {
  return withRateLimitRetry(() => getAdapter(provider).generateQuestions(opts));
}

export function generateRecommended({ provider, ...opts }) {
  return withRateLimitRetry(() => getAdapter(provider).generateRecommended(opts));
}

export function validateKey(provider, apiKey, model) {
  return getAdapter(provider).validateKey(apiKey, model);
}
