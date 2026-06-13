// provider 어댑터 진입점 — 새 프로바이더는 어댑터 모듈 + 이 레지스트리 + constants.PROVIDERS에 추가한다.
// 품질 파이프라인: ① 후보를 여유 있게 생성 → ② 정답 노출 기계 필터 → ③ AI 교차 검수 → ④ 요청 수만큼 반환
import { openaiProvider } from './openai.js';
import { anthropicProvider } from './anthropic.js';
import { googleProvider } from './google.js';
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
  normalizeForLeak,
} from './shared.js';
import { makeDiversityAxes } from '../data/subtopics.js';

// A-3 프로바이더별 샘플링 파라미터 (소재 수렴 방지)
const SAMPLING = {
  openai: { temperature: 1.0, presencePenalty: 0.6, frequencyPenalty: 0.3 },
  anthropic: { temperature: 1.0 },
  google: { temperature: 1.0 },
};

const adapters = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
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

// 한 배치 생성 → 정답 노출 기계 필터 → AI 교차 검수. theme도 함께 반환.
async function produceBatch({ adapter, provider, apiKey, model, category, difficulty, count, excludeKeywords, wantTheme }) {
  const sampling = SAMPLING[provider] || {};
  const user = buildQuestionUserPrompt({
    category,
    difficulty,
    count,
    excludeKeywords,
    wantTheme,
    diversity: makeDiversityAxes(category),
  });

  // 생성: JSON 파싱 실패 시 temperature를 낮춰 1회 재시도
  let generated;
  try {
    generated = await withRateLimitRetry(() =>
      adapter.completeJSON({ apiKey, model, system: QUESTION_SYSTEM_PROMPT, user, sampling })
    );
  } catch (e) {
    if (e instanceof AiError && e.type === 'parse') {
      generated = await withRateLimitRetry(() =>
        adapter.completeJSON({
          apiKey,
          model,
          system: QUESTION_SYSTEM_PROMPT,
          user,
          sampling: { ...sampling, temperature: 0.8 },
        })
      );
    } else {
      throw e;
    }
  }

  const theme = generated?.theme || null;
  let questions = normalizeQuestions(generated);

  // 문제문/힌트에 정답이 그대로 노출된 문제 제거
  const filtered = questions.filter((q) => !leaksAnswer(q));
  if (filtered.length > 0) questions = filtered;

  // 같은 모델을 검수자로 재호출해 오답·난이도 이탈·창작 문제를 탈락 (실패 시 1차 결과 유지)
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

  return { questions, theme };
}

export async function generateQuestions({
  provider,
  apiKey,
  model,
  category,
  difficulty,
  count,
  excludeKeywords = [],
  excludeSet = null,
  wantTheme = false,
}) {
  const adapter = getAdapter(provider);
  // 클라이언트 중복 필터링용 정규화 집합: 누적 제외 + 이번 호출 내 중복
  const seen = excludeSet ? new Set(excludeSet) : new Set(excludeKeywords.map(normalizeForLeak));
  const collected = [];
  let theme = null;
  // 검수 탈락·중복 탈락을 감안해 후보를 여유 있게 생성. 부족하면 1회 추가 요청(총 2회).
  const excludeForPrompt = [...excludeKeywords];

  for (let attempt = 0; attempt < 2 && collected.length < count; attempt += 1) {
    const candidateCount = Math.min(count + 4, 16);
    let batch;
    try {
      batch = await produceBatch({
        adapter,
        provider,
        apiKey,
        model,
        category,
        difficulty,
        count: candidateCount,
        excludeKeywords: excludeForPrompt.slice(-80),
        wantTheme: wantTheme && attempt === 0,
      });
    } catch (e) {
      if (attempt === 0) throw e; // 첫 호출 실패는 호출부(폴백)로 전파
      break; // 추가 호출 실패는 모은 만큼 진행
    }
    if (batch.theme && !theme) theme = batch.theme;

    for (const q of batch.questions) {
      const norm = normalizeForLeak(q.answer);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        collected.push(q);
        excludeForPrompt.push(q.answer);
      }
    }
  }

  return { questions: collected.slice(0, count), theme };
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
