// 한국어 위키백과 분류(Category) 멤버를 받아 단어 목록을 만든다. 키 불필요, origin=* 로 CORS 허용.
// 나무위키는 공개 API·CORS가 없어 사용 불가하므로 위키백과만 사용한다.
import { storage } from '../storage.js';
import { STORAGE_KEYS } from '../constants.js';

const API = 'https://ko.wikipedia.org/w/api.php';
const CACHE_KEY = STORAGE_KEYS.wikiCache;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7일

function loadCache() {
  const c = storage.get(CACHE_KEY, {});
  return c && typeof c === 'object' ? c : {};
}

// 분류 멤버(본문 네임스페이스)를 페이지네이션으로 모아 제목 배열 반환
async function fetchCategoryTitles(category) {
  const titles = [];
  let cont;
  for (let i = 0; i < 4; i += 1) {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `분류:${category}`,
      cmnamespace: '0',
      cmlimit: '500',
      format: 'json',
      origin: '*',
    });
    if (cont) params.set('cmcontinue', cont);
    const res = await fetch(`${API}?${params.toString()}`);
    if (!res.ok) throw new Error(`wiki ${res.status}`);
    const data = await res.json();
    const members = data?.query?.categorymembers || [];
    for (const m of members) titles.push(m.title);
    cont = data?.continue?.cmcontinue;
    if (!cont) break;
  }
  return titles;
}

// 사자성어(4글자 한자성어) 목록 — 위키백과 '고사성어'/'사자성어' 분류에서 4글자 한글 제목만.
export async function fetchIdioms() {
  const cache = loadCache();
  const hit = cache.idioms;
  if (hit && Date.now() - hit.at < CACHE_TTL && Array.isArray(hit.list) && hit.list.length) {
    return hit.list;
  }
  let titles = [];
  for (const cat of ['고사성어', '사자성어']) {
    try {
      const t = await fetchCategoryTitles(cat);
      titles = titles.concat(t);
      if (titles.length >= 200) break;
    } catch {
      // 다음 분류 시도
    }
  }
  // 4글자 한글 제목만(괄호·동음이의 표기 제거 후), 중복 제거
  const seen = new Set();
  const list = [];
  for (const raw of titles) {
    const name = String(raw).replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (/^[가-힣]{4}$/.test(name) && !seen.has(name)) {
      seen.add(name);
      list.push(name);
    }
  }
  if (list.length === 0) return [];
  storage.set(CACHE_KEY, { ...cache, idioms: { at: Date.now(), list } });
  return list;
}
