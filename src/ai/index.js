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
  TRANSLATE_SYSTEM_PROMPT,
  WORDLIST_SYSTEM_PROMPT,
  buildQuestionUserPrompt,
  buildReviewUserPrompt,
  buildRecommendUserPrompt,
  buildTranslateUserPrompt,
  buildWordListUserPrompt,
} from './prompts.js';
import {
  normalizeQuestions,
  normalizeCategories,
  leaksAnswer,
  applyReview,
  normalizeForLeak,
  finalizeChoices,
  isYearAnswer,
  normalizeItems,
} from './shared.js';
import { makeDiversityAxes } from '../data/subtopics.js';
import { parseMaskTemplate, applyMask, applyBracketMask } from '../mask.js';
import { classifyCategory, usesTrivia } from '../categoryRules.js';
import { fetchTrivia } from '../data/trivia.js';
import { fetchIdioms } from '../data/wiki.js';

// 단어 완성: 주제의 '실존 이름' 목록을 받아 앞 N글자만 남기고 가린 문제를 만든다.
//  - 사자성어/고사성어 주제 → 위키백과 분류(키 불필요)
//  - 그 외 주제 → AI가 실존 유명 항목 목록 생성(가상 금지)
function isIdiomTopic(topic) {
  return /사자성어|고사성어/.test(String(topic || ''));
}

function shuffleArr2(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function generateWordCompletion({
  adapter,
  apiKey,
  model,
  topic,
  count,
  revealCount,
  seen,
  excludeKeywords = [],
}) {
  let names = [];
  if (isIdiomTopic(topic)) {
    try {
      names = shuffleArr2(await fetchIdioms());
    } catch {
      names = [];
    }
  }
  // 위키 결과가 없거나 다른 주제 → AI 실존 목록 생성(키 있을 때)
  if (names.length === 0 && apiKey) {
    try {
      const parsed = await withRateLimitRetry(() =>
        adapter.completeJSON({
          apiKey,
          model,
          system: WORDLIST_SYSTEM_PROMPT,
          user: buildWordListUserPrompt({ topic, count: Math.max(count + 6, 12), excludeKeywords }),
        })
      );
      names = normalizeItems(parsed);
    } catch {
      names = [];
    }
  }
  if (names.length === 0) return null;

  const out = [];
  for (const name of names) {
    const masked = applyBracketMask(name, revealCount);
    if (!masked) continue; // 가릴 글자가 없음(짧은 이름)
    const norm = normalizeForLeak(name);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push({ question: masked, answer: name, hint: '', altAnswers: [] });
  }
  return out.length > 0 ? out : null;
}

// 일반상식: 글로벌 Trivia API(영어)에서 검증된 문제를 받아 AI로 한국어 주관식 번역.
// 성공 시 번역된 문제 배열 반환, 실패 시 null(호출부가 일반 생성으로 폴백).
async function generateFromTrivia({ adapter, apiKey, model, difficulty, count, seen }) {
  let raw;
  try {
    raw = await fetchTrivia({ difficulty, amount: Math.max(count + 4, 6) });
  } catch {
    return null;
  }
  // 일반상식: 정답이 연도인 문제는 번역 전에 제외
  if (Array.isArray(raw)) raw = raw.filter((r) => !isYearAnswer(r.answer));
  if (!raw || raw.length === 0) return null;
  let parsed;
  try {
    parsed = await withRateLimitRetry(() =>
      adapter.completeJSON({
        apiKey,
        model,
        system: TRANSLATE_SYSTEM_PROMPT,
        user: buildTranslateUserPrompt(raw),
      })
    );
  } catch {
    return null;
  }
  let questions;
  try {
    questions = normalizeQuestions(parsed);
  } catch {
    return null;
  }
  // 누적 제외 + 배치 내 중복 필터 + 객관식 보기 확정(정답 포함·섞기)
  const out = [];
  for (const q of questions) {
    if (isYearAnswer(q.answer)) continue; // 번역 후에도 연도 정답이면 제외
    const norm = normalizeForLeak(q.answer);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(finalizeChoices(q));
    }
  }
  return out.length > 0 ? out.slice(0, count) : null;
}

// 일반상식 블렌드: 한국 문제는 AI가 생성(한국 가중), 세계 문제는 Trivia에서 받아 섞는다.
// KOREA_RATIO로 한국 비중 조절(0~1). 한쪽이 실패하면 다른 쪽만으로 진행.
const KOREA_RATIO = 0.6;
const KOREA_GK_SUBRULE =
  '- 한국(대한민국) 관련 상식을 중심으로 출제하세요: 한국의 지리·역사·문화·전통·명절·일상·인물·음식·자연·시사 등. 한국인이 일상에서 접하는 보편 상식 위주로 하세요.\n' +
  '- 정답이 연도(예: 1945년, 2000년)인 문제는 출제하지 마세요.';

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function generateGeneralKnowledge({ adapter, provider, apiKey, model, difficulty, count, seen, excludeKeywords }) {
  const koreaN = Math.max(1, Math.round(count * KOREA_RATIO));
  const worldN = Math.max(0, count - koreaN);

  // 한국(AI 생성, 주관식)과 세계(Trivia, 객관식)를 동시에 요청
  const [koreaRes, worldRes] = await Promise.allSettled([
    produceBatch({
      adapter,
      provider,
      apiKey,
      model,
      category: '일반상식',
      difficulty,
      count: koreaN,
      excludeKeywords,
      wantTheme: false,
      typeHint: '',
      maskTemplate: null,
      subRule: KOREA_GK_SUBRULE,
    }),
    worldN > 0
      ? generateFromTrivia({ adapter, apiKey, model, difficulty, count: worldN, seen })
      : Promise.resolve(null),
  ]);

  const out = [];
  // 세계(Trivia) — generateFromTrivia가 이미 seen 반영·보기 확정
  if (worldRes.status === 'fulfilled' && Array.isArray(worldRes.value)) {
    out.push(...worldRes.value);
  }
  // 한국(AI) — seen 기준 중복 제거
  if (koreaRes.status === 'fulfilled' && koreaRes.value?.questions) {
    for (const q of koreaRes.value.questions) {
      if (isYearAnswer(q.answer)) continue; // 연도 정답 제외
      const norm = normalizeForLeak(q.answer);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        out.push(q);
      }
    }
  }
  return out.length > 0 ? shuffleArr(out) : null;
}

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
// typeHint(특수 출제 형식)가 있으면 정답이 의도적으로 노출되므로 노출 필터·검수를 건너뛴다.
async function produceBatch({ adapter, provider, apiKey, model, category, difficulty, count, excludeKeywords, wantTheme, typeHint, maskTemplate, subRule }) {
  const sampling = SAMPLING[provider] || {};
  const user = buildQuestionUserPrompt({
    category,
    difficulty,
    count,
    excludeKeywords,
    wantTheme,
    diversity: makeDiversityAxes(category),
    typeHint,
    maskTemplate,
    subRule,
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

  // 프리픽스 마스킹: 가림은 앱이 결정적으로 수행(AI는 정답 전체만 생성).
  // 정답 앞 N글자만 남기고 "()"로 가린 텍스트를 question에 덮어쓴다. 가릴 수 없으면 버림.
  if (maskTemplate) {
    questions = questions
      .map((q) => {
        const masked = applyMask(q.answer, maskTemplate.revealCount);
        return masked ? { ...q, question: masked } : null;
      })
      .filter(Boolean);
  }

  // 특수 출제 형식(typeHint) 또는 마스킹이면 정답 노출이 의도된 것이므로 노출 필터·검수를 건너뛴다.
  if (!typeHint && !maskTemplate) {
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
  typeHint = '',
  wordComplete = null, // { topic, revealCount } — 단어 완성 모드
}) {
  const adapter = getAdapter(provider);
  // 숨은 의도 분류: 사용자가 형식 예시(typeHint)를 직접 주면 그게 우선, 없으면 카테고리명으로 자동 분류.
  const cls = classifyCategory(category);
  const maskTemplate = parseMaskTemplate(typeHint) || (typeHint ? null : cls.mask);
  const subRule = typeHint ? '' : cls.subRule;
  // 클라이언트 중복 필터링용 정규화 집합: 누적 제외 + 이번 호출 내 중복
  const seen = excludeSet ? new Set(excludeSet) : new Set(excludeKeywords.map(normalizeForLeak));

  // 단어 완성: 실존 이름 목록을 받아 앞 N글자만 남기고 가림(위키백과/AI). 실패 시 null 반환.
  if (wordComplete) {
    const words = await generateWordCompletion({
      adapter,
      apiKey,
      model,
      topic: wordComplete.topic || category,
      count: Math.max(count, 10),
      revealCount: wordComplete.revealCount || 2,
      seen,
      excludeKeywords: excludeKeywords.slice(-80),
    });
    return { questions: words || [], theme: null };
  }

  // 일반상식: 한국(AI 생성) + 세계(Trivia 번역)를 한국 비중 높게 블렌드.
  // 실패하면 아래 일반 생성 경로로 자연스럽게 폴백한다.
  if (usesTrivia(category) && !typeHint) {
    const blended = await generateGeneralKnowledge({
      adapter,
      provider,
      apiKey,
      model,
      difficulty,
      count: Math.max(count, 10),
      seen,
      excludeKeywords: excludeKeywords.slice(-80),
    });
    if (blended) return { questions: blended, theme: null };
  }

  const collected = [];
  let theme = null;
  // 검수·중복 탈락을 감안해 소량 여유분만 생성하고, 살아남은 문제는 전부 반환해
  // 호출부(큐)가 버퍼링한다. 0개면 1회만 추가 요청(총 2회).
  const excludeForPrompt = [...excludeKeywords];

  for (let attempt = 0; attempt < 2 && collected.length < count; attempt += 1) {
    // count(보통 1) + 검수 여유분 2개 → 첫 응답을 작게 유지해 빠르게 띄운다
    const candidateCount = Math.min(Math.max(count + 2, 3), 12);
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
        typeHint,
        maskTemplate,
        subRule,
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

  // 살아남은 후보를 전부 반환 → 큐가 버퍼링하여 다음 문제는 API 호출 없이 즉시 소비
  return { questions: collected, theme };
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
