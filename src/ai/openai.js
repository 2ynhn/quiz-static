import { AI_MODEL } from '../constants.js';
import { AiError } from './errors.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

async function callChat(apiKey, body) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: AI_MODEL, ...body }),
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
    const code = errBody?.error?.code || errBody?.error?.type || '';
    if (res.status === 401) {
      throw new AiError('invalid_key', '키가 올바르지 않습니다.');
    }
    if (res.status === 429 && code === 'insufficient_quota') {
      throw new AiError(
        'insufficient_quota',
        '키의 크레딧/결제 한도가 소진되었습니다. OpenAI 대시보드를 확인하세요.'
      );
    }
    if (res.status === 429) {
      throw new AiError('rate_limit', '요청이 너무 많습니다. 잠시 후 다시 시도합니다.');
    }
    throw new AiError('network', errBody?.error?.message || `오류가 발생했습니다 (${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function parseJson(text) {
  // JSON 모드를 쓰지만 방어적으로 백틱 펜스를 제거하고 파싱한다.
  const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AiError('parse', 'AI 응답을 해석하지 못했습니다.');
  }
}

export const openaiProvider = {
  name: 'OpenAI',
  model: AI_MODEL,

  async generateQuestions({ apiKey, category, difficulty, count, excludeKeywords = [] }) {
    const system =
      '당신은 한국어 주관식 상식 퀴즈 출제자입니다. 객관식 금지, 답은 짧은 단어/구. ' +
      '반드시 {"questions":[{"question":"...","answer":"...","hint":"...","altAnswers":["..."]}]} ' +
      '형태의 JSON만 출력하세요.';
    const exclude =
      excludeKeywords.length > 0
        ? ` 다음 키워드의 문제는 제외: ${excludeKeywords.join(', ')}`
        : '';
    const user =
      `카테고리: ${category}, 난이도: ${difficulty}, ${count}문제. ` +
      `각 문제에 question/answer/hint/altAnswers 포함.${exclude}`;

    const content = await callChat(apiKey, {
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const parsed = parseJson(content);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
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
  },

  async generateRecommended({ apiKey, exclude = [] }) {
    const system =
      '당신은 퀴즈 카테고리 추천가입니다. 반드시 {"categories":["...","..."]} 형태의 JSON만 출력하세요.';
    const user =
      `다음 카테고리와 겹치지 않는 흥미로운 한국어 퀴즈 카테고리 2개를 추천: ${exclude.join(', ')}. ` +
      '각 카테고리는 2~8자의 짧은 명사구로.';

    const content = await callChat(apiKey, {
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const parsed = parseJson(content);
    const categories = Array.isArray(parsed.categories) ? parsed.categories.map(String) : [];
    if (categories.length < 2) {
      throw new AiError('parse', '추천 카테고리 생성에 실패했습니다.');
    }
    return categories.slice(0, 2);
  },

  async validateKey(apiKey) {
    await callChat(apiKey, {
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
  },
};
