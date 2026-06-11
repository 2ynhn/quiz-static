import { AiError } from './errors.js';
import { parseJson } from './shared.js';

// Gemini는 키를 쿼리스트링으로 받는다. 모델명은 경로에 들어간다.
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGenerate(apiKey, model, body) {
  let res;
  try {
    res = await fetch(`${BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const status = errBody?.error?.status || '';
    // 잘못된 키: 400 INVALID_ARGUMENT(API key not valid) 또는 403
    if (res.status === 403 || /API key not valid|API_KEY_INVALID/i.test(message)) {
      throw new AiError('invalid_key', '키가 올바르지 않습니다.');
    }
    if (res.status === 429 || status === 'RESOURCE_EXHAUSTED') {
      throw new AiError('rate_limit', '요청 한도를 초과했습니다. 잠시 후 다시 시도합니다.');
    }
    if (res.status === 401) {
      throw new AiError('invalid_key', '키가 올바르지 않습니다.');
    }
    throw new AiError('network', message || `오류가 발생했습니다 (${res.status})`);
  }

  const data = await res.json();
  // 안전성 필터 등으로 후보가 비어 있을 수 있다.
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

export const googleProvider = {
  // system+user 한 쌍을 보내고 JSON 객체로 파싱해 반환
  async completeJSON({ apiKey, model, system, user }) {
    const text = await callGenerate(apiKey, model, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });
    return parseJson(text);
  },

  async validateKey(apiKey, model) {
    await callGenerate(apiKey, model, {
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 1 },
    });
  },
};
