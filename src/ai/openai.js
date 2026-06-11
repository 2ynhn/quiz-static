import { AiError } from './errors.js';
import { parseJson } from './shared.js';

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

export const openaiProvider = {
  // system+user 한 쌍을 보내고 JSON 객체로 파싱해 반환
  async completeJSON({ apiKey, model, system, user }) {
    const content = await callChat(apiKey, {
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return parseJson(content);
  },

  async validateKey(apiKey, model) {
    // 인증 여부만 확인하는 초소형 호출 (gpt-5 계열 호환을 위해 max_completion_tokens 사용)
    await callChat(apiKey, {
      model,
      max_completion_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
  },
};
