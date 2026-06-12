// 카테고리 테마 시스템 — 이모지 + 액센트 색 + SVG 패턴 (외부 이미지·이미지 생성 없음)
import { storage } from '../storage.js';
import { STORAGE_KEYS } from '../constants.js';

export const PATTERN_IDS = ['grid', 'wave', 'dot', 'square', 'diagonal'];

// 기본 카테고리(4) — 프론트 고정 매핑
export const BASE_THEMES = {
  한국사: { emoji: '🏯', color: '#C8892F', pattern: 'grid' },
  세계사: { emoji: '🌍', color: '#1D9E75', pattern: 'dot' },
  일반상식: { emoji: '📚', color: '#B05BC8', pattern: 'wave' },
  사자성어: { emoji: '🐉', color: '#D85A30', pattern: 'square' },
};

const PALETTE = [
  '#C8892F', '#1D9E75', '#B05BC8', '#D85A30',
  '#378ADD', '#D4537E', '#BA7517', '#639922',
];

// HEX → HSL 변환 후 L(밝기)만 바꿔 배경(어둡게)/글자(밝게)를 파생한다.
export function shade(hex, lightness) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    const l = (max + min) / 2;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${lightness}%)`;
}

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

// 테마가 없을 때 카테고리명을 해시해 결정적으로 생성 (같은 이름 → 항상 같은 테마)
export function fallbackTheme(name) {
  const h = hashName(String(name));
  return {
    emoji: '❓',
    color: PALETTE[h % PALETTE.length],
    pattern: PATTERN_IDS[h % PATTERN_IDS.length],
  };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

// AI가 제안한 테마 검증 — color/pattern이 깨지면 null(→폴백), 이모지만 깨지면 ❓로 대체
export function sanitizeTheme(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const color = typeof raw.color === 'string' && HEX_RE.test(raw.color.trim())
    ? raw.color.trim()
    : null;
  const pattern = PATTERN_IDS.includes(raw.pattern) ? raw.pattern : null;
  if (!color || !pattern) return null;
  let emoji = typeof raw.emoji === 'string' ? raw.emoji.trim() : '';
  // 결합 이모지를 감안해 코드포인트 8개까지 허용, 픽토그래프가 없으면 대체
  if (!emoji || [...emoji].length > 8 || !EMOJI_RE.test(emoji)) emoji = '❓';
  return { emoji, color, pattern };
}

function loadCache() {
  const cache = storage.get(STORAGE_KEYS.categoryThemes, {});
  return cache && typeof cache === 'object' ? cache : {};
}

// 기본 매핑 → localStorage 캐시 → 결정적 폴백 순
export function getTheme(name) {
  if (BASE_THEMES[name]) return BASE_THEMES[name];
  const cached = sanitizeTheme(loadCache()[name]);
  return cached || fallbackTheme(name);
}

export function hasTheme(name) {
  return Boolean(BASE_THEMES[name] || sanitizeTheme(loadCache()[name]));
}

// AI 제안 테마를 카테고리명 기준으로 1회만 캐싱
export function rememberTheme(name, rawTheme) {
  if (!name || BASE_THEMES[name]) return;
  const theme = sanitizeTheme(rawTheme);
  if (!theme) return;
  const cache = loadCache();
  if (cache[name]) return;
  storage.set(STORAGE_KEYS.categoryThemes, { ...cache, [name]: theme });
}
