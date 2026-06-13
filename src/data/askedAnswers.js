// A-1 누적 제외 목록 — 출제된 정답을 카테고리·난이도별로 localStorage에 누적.
// 다음 생성 요청에 "이미 출제된 정답" 목록으로 전달해 반복을 막는다.
import { storage } from '../storage.js';
import { STORAGE_KEYS, ASKED_MAX_PER_KEY, ASKED_PROMPT_LIMIT } from '../constants.js';
import { normalizeForLeak } from '../ai/shared.js';

const keyFor = (category, difficulty) => `${category}_${difficulty}`;

function loadAll() {
  const all = storage.get(STORAGE_KEYS.askedAnswers, {});
  return all && typeof all === 'object' ? all : {};
}

// 해당 카테고리·난이도의 전체 누적 정답 배열
export function getAsked(category, difficulty) {
  const list = loadAll()[keyFor(category, difficulty)];
  return Array.isArray(list) ? list : [];
}

// 프롬프트 전달용: 최근 N개만 (토큰 절약)
export function getAskedForPrompt(category, difficulty) {
  return getAsked(category, difficulty).slice(-ASKED_PROMPT_LIMIT);
}

// 정규화된 제외 집합 (클라이언트 중복 필터링용)
export function getAskedSet(category, difficulty) {
  return new Set(getAsked(category, difficulty).map(normalizeForLeak));
}

// 출제된 정답들을 push (중복 제거 + 키당 최대 개수 유지)
export function addAsked(category, difficulty, answers) {
  const list = Array.isArray(answers) ? answers : [answers];
  const clean = list.map(String).filter(Boolean);
  if (clean.length === 0) return;
  const all = loadAll();
  const key = keyFor(category, difficulty);
  const existing = Array.isArray(all[key]) ? all[key] : [];
  const seen = new Set(existing.map(normalizeForLeak));
  for (const ans of clean) {
    const norm = normalizeForLeak(ans);
    if (!seen.has(norm)) {
      existing.push(ans);
      seen.add(norm);
    }
  }
  // 초과 시 오래된 것부터 제거
  all[key] = existing.slice(-ASKED_MAX_PER_KEY);
  storage.set(STORAGE_KEYS.askedAnswers, all);
}

// 전체 출제 기록 초기화
export function clearAsked() {
  storage.set(STORAGE_KEYS.askedAnswers, {});
}

// 누적된 총 정답 개수 (설정 화면 표시용)
export function countAsked() {
  const all = loadAll();
  return Object.values(all).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );
}
