import { AiError } from './errors.js';
import {
  QUESTION_SYSTEM_PROMPT,
  RECOMMEND_SYSTEM_PROMPT,
  buildQuestionUserPrompt,
  buildRecommendUserPrompt,
} from './prompts.js';
import { parseJson, normalizeQuestions, normalizeCategories } from './shared.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

async function callMessages(apiKey, body) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // 브라우저 직접 호출(CORS) 허용 — 키는 사용자 본인 기기의 localStorage에만 존재
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiError('network', '네트워크 오류가 발생했습니다.');
  }

  if (!res.ok) {
    let errBody = null;
    try {
      errBody = await res.json();
    } catch {
      // 본문 없는 에러 응답
    }
    const message = errBody?.error?.message || '';
    if (res.status === 401) {
      throw new AiError('invalid_key', '키가 올바르지 않습니다.');
    }
    if (res.status === 400 && /credit/i.test(message)) {
      throw new AiError(
        'insufficient_quota',
        '키의 크레딧이 소진되었습니다. Claude 콘솔에서 잔액을 확인하세요.'
      );
    }
    if (res.status === 429 || res.status === 529) {
      throw new AiError('rate_limit', '요청이 너무 많습니다. 잠시 후 다시 시도합니다.');
    }
    throw new AiError('network', message || `오류가 발생했습니다 (${res.status})`);
  }

  const data = await res.json();
  // content 블록 중 text를 연결해 하나의 문자열로
  return (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export const anthropicProvider = {
  async generateQuestions({ apiKey, model, category, difficulty, count, excludeKeywords = [] }) {
    const text = await callMessages(apiKey, {
      model,
      max_tokens: 4096,
      system: QUESTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildQuestionUserPrompt({ category, difficulty, count, excludeKeywords }),
        },
      ],
    });
    return normalizeQuestions(parseJson(text));
  },

  async generateRecommended({ apiKey, model, exclude = [] }) {
    const text = await callMessages(apiKey, {
      model,
      max_tokens: 1024,
      system: RECOMMEND_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildRecommendUserPrompt(exclude) }],
    });
    return normalizeCategories(parseJson(text));
  },

  async validateKey(apiKey, model) {
    await callMessages(apiKey, {
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
  },
};
