// 공유 문제은행: 로컬 누적(초안) + 원격(GitHub) 읽기/병합.
// - 키 보유자가 검증한 문제(정답/오답 판정)만 초안에 쌓고, '잘못된 문제'는 쌓지 않는다.
// - 일반상식(general)과 단어완성(wordcomplete) 두 갈래로 나눈다.
import { storage } from '../storage.js';
import { STORAGE_KEYS, BANK_READ_URLS } from '../constants.js';
import { normalizeForLeak } from '../ai/shared.js';

function emptyDraft() {
  return { general: [], wordcomplete: [] };
}

export function loadDraft() {
  const d = storage.get(STORAGE_KEYS.bankDraft, null);
  if (!d || typeof d !== 'object') return emptyDraft();
  return {
    general: Array.isArray(d.general) ? d.general : [],
    wordcomplete: Array.isArray(d.wordcomplete) ? d.wordcomplete : [],
  };
}

function saveDraft(d) {
  storage.set(STORAGE_KEYS.bankDraft, d);
}

// 일반상식 문제 객체 추가 (정답 기준 중복 제거)
export function addDraftGeneral(q) {
  if (!q || !q.question || !q.answer) return;
  const d = loadDraft();
  const key = normalizeForLeak(q.answer);
  if (d.general.some((x) => normalizeForLeak(x.answer) === key)) return;
  d.general.push({
    question: String(q.question),
    answer: String(q.answer),
    hint: q.hint ? String(q.hint) : '',
    altAnswers: Array.isArray(q.altAnswers) ? q.altAnswers.map(String) : [],
    ...(Array.isArray(q.choices) && q.choices.length >= 2
      ? { choices: q.choices.map(String) }
      : {}),
  });
  saveDraft(d);
}

// 단어완성 정답(이름) 추가 — 주제별, 정답 기준 중복 제거. 마스킹은 소비 시 재생성.
export function addDraftWord(topic, answer) {
  if (!topic || !answer) return;
  const d = loadDraft();
  const key = normalizeForLeak(answer);
  if (d.wordcomplete.some((x) => x.topic === topic && normalizeForLeak(x.answer) === key)) return;
  d.wordcomplete.push({ topic: String(topic), answer: String(answer) });
  saveDraft(d);
}

export function draftCounts() {
  const d = loadDraft();
  return { general: d.general.length, wordcomplete: d.wordcomplete.length };
}

export function clearDraft() {
  saveDraft(emptyDraft());
}

// 원격 JSON 읽기 (raw 우선, 실패 시 CDN). 없으면 null.
async function fetchJson(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch {
      // 다음 URL
    }
  }
  return null;
}

// 키 없는 사용자용: 일반상식 공유 문제 배열
export async function fetchBankGeneral() {
  const data = await fetchJson(BANK_READ_URLS.general);
  return Array.isArray(data) ? data : [];
}

// 키 없는 사용자용: 단어완성 공유 데이터 { topic: [names] }
export async function fetchBankWordMap() {
  const data = await fetchJson(BANK_READ_URLS.wordcomplete);
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

// 업로드용 병합: 원격 + 초안 → 중복 제거된 새 데이터
export function mergeGeneral(remote, draftGeneral) {
  const base = Array.isArray(remote) ? remote : [];
  const seen = new Set(base.map((x) => normalizeForLeak(x.answer)));
  const out = [...base];
  for (const q of draftGeneral) {
    const k = normalizeForLeak(q.answer);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(q);
    }
  }
  return out;
}

export function mergeWordMap(remoteMap, draftWord) {
  const out = {};
  const src = remoteMap && typeof remoteMap === 'object' ? remoteMap : {};
  for (const [topic, names] of Object.entries(src)) {
    out[topic] = Array.isArray(names) ? [...names] : [];
  }
  for (const { topic, answer } of draftWord) {
    if (!out[topic]) out[topic] = [];
    const exists = out[topic].some((n) => normalizeForLeak(n) === normalizeForLeak(answer));
    if (!exists) out[topic].push(answer);
  }
  return out;
}
