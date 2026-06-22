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
    ...(Array.isArray(q.choices)
      ? { choices: q.choices.map((c) => String(c).trim()).filter(Boolean) }
      : {}),
  }));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 객관식 보기 확정: 정답 포함 + 중복 제거 + 섞기. 보기 2개 미만이면 choices 제거(주관식).
export function finalizeChoices(q) {
  const merged = [q.answer, ...(q.choices || [])];
  const seen = new Set();
  const out = [];
  for (const c of merged) {
    const v = String(c).trim();
    const k = v.toLowerCase();
    if (v && !seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  if (out.length < 2) {
    const { choices, ...rest } = q;
    return rest;
  }
  return { ...q, choices: shuffle(out) };
}

// 영화 제목 띄어쓰기·시리즈 번호 정규화 규칙
//  - 시리즈 숫자 제거: 끝에 붙은 숫자는 시리즈 번호로 보고 제거 (아이언맨2 → 아이언맨, 반지의 제왕2 → 반지의 제왕)
//    단, '노예 12년'·'7번방의 선물'처럼 숫자 뒤에 글자가 있으면 제목의 일부이므로 건드리지 않는다.
//  - 더(The)가 첫 단어이면 띄어쓰기: 더헐크 → 더 헐크, 더페이버릿 → 더 페이버릿
//  - 끝의 맨(man)·우먼(woman)은 붙여쓰기: 아이언 맨 → 아이언맨, 앤트 맨 → 앤트맨
export function normalizeTitle(name) {
  let s = String(name).replace(/\s+/g, ' ').trim();
  if (!s) return s;
  // 1) 끝에 붙은 시리즈 숫자 제거 (앞에 공백이 있든 없든)
  s = s.replace(/\s*\d+\s*$/, '').trim();
  // 2) 첫 단어가 '더'(The)이면 뒤에 공백 추가
  s = s.replace(/^더(?=\S)/, '더 ');
  // 3) 끝의 ' 맨' / ' 우먼'은 앞 단어에 붙임 (아이언 맨 → 아이언맨).
  //    단 '오브 맨'(of Men)처럼 연결어 뒤의 맨은 별개 단어이므로 건드리지 않는다.
  s = s.replace(/(?<!오브)\s+(맨|우먼)$/, '$1');
  return s.replace(/\s+/g, ' ').trim();
}

// 단어 완성: {"items":["..."]} → 문자열 배열로 정규화
export function normalizeItems(parsed) {
  const list = Array.isArray(parsed?.items) ? parsed.items : [];
  return list.map((x) => String(x).trim()).filter(Boolean);
}

// 추천 응답은 [{name, theme}] 형태로 정규화 — 문자열 배열(구 스키마)도 허용
export function normalizeCategories(parsed) {
  const list = Array.isArray(parsed?.categories) ? parsed.categories : [];
  const items = list
    .map((entry) => {
      if (typeof entry === 'string') return { name: entry, theme: null };
      if (entry && typeof entry === 'object' && entry.name) {
        return { name: String(entry.name), theme: entry.theme || null };
      }
      return null;
    })
    .filter(Boolean);
  if (items.length < 2) {
    throw new AiError('parse', '추천 카테고리 생성에 실패했습니다.');
  }
  return items.slice(0, 2);
}

// ── 기계적 품질 필터 ──────────────────────────────────────────

// 정답 비교용 정규화: 소문자화 + 공백·문장부호 제거 ("훈민정음" vs "훈민 정음" 동일 취급)
export function normalizeForLeak(s) {
  return String(s)
    .toLowerCase()
    .replace(/[\s·\-‧.,'"“”‘’()[\]?!~]/g, '');
}

// 문제문/힌트에 정답(또는 altAnswers)이 그대로 노출된 문제를 걸러낸다.
export function leaksAnswer(q) {
  const answers = [q.answer, ...(q.altAnswers || [])]
    .map(normalizeForLeak)
    .filter((a) => a.length >= 2); // 1글자 답은 오탐이 많아 검수 단계에 맡긴다
  if (answers.length === 0) return false;
  const questionText = normalizeForLeak(q.question);
  const hintText = normalizeForLeak(q.hint || '');
  return answers.some((a) => questionText.includes(a) || hintText.includes(a));
}

// 정답이 '연도'인지 판별 (일반상식에서 연도 정답 문제를 제외하는 데 사용)
// 예: "1945년", "2000년", "기원전 100년", "1392", "100 BC" → true / "100"(개수), "3.14" → false
export function isYearAnswer(answer) {
  const s = String(answer).trim();
  if (/^(기원전\s*)?\d{1,4}\s*(년|년도)$/.test(s)) return true; // 1945년, 기원전 100년
  if (/^\d{1,4}\s*(ad|bc|ce|bce)$/i.test(s)) return true; // 1945 AD, 100 BC
  if (/^(1\d{3}|20\d{2}|21\d{2})$/.test(s)) return true; // 1000~2199 (연도로 보이는 4자리)
  return false;
}

// 검수 응답({"results":[{index,pass}]})을 적용해 통과한 문제만 남긴다.
// 응답 형식이 어긋나면 검수를 건너뛴다(원본 유지) — 검수 실패가 게임을 막으면 안 된다.
export function applyReview(questions, parsed) {
  const results = Array.isArray(parsed?.results) ? parsed.results : null;
  if (!results) return questions;
  const passed = new Set(
    results.filter((r) => r && r.pass === true).map((r) => Number(r.index))
  );
  return questions.filter((_, i) => passed.has(i));
}
