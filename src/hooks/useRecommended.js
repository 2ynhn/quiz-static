import { useEffect, useState } from 'react';
import { storage } from '../storage.js';
import { STORAGE_KEYS, DEFAULT_CATEGORIES } from '../constants.js';
import { RECOMMENDED_POOL } from '../data/recommendedPool.js';
import { generateRecommended } from '../ai/index.js';

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// AI 호출 없이 날짜 기반으로 내장 풀에서 2개 선택 (폴백)
function pickFromPool(date, exclude) {
  const pool = RECOMMENDED_POOL.filter((c) => !exclude.includes(c));
  if (pool.length < 2) return pool;
  const h = hashStr(date);
  const first = h % pool.length;
  const second = (first + 1 + (h % (pool.length - 1))) % pool.length;
  return [pool[first], pool[second]];
}

export function useRecommended(aiConfig, userCategories) {
  const [recommended, setRecommended] = useState(() => {
    const saved = storage.get(STORAGE_KEYS.recommended);
    if (saved?.date === todayStr() && Array.isArray(saved.categories)) {
      return saved.categories;
    }
    return pickFromPool(todayStr(), [...DEFAULT_CATEGORIES, ...userCategories]);
  });

  useEffect(() => {
    const today = todayStr();
    const saved = storage.get(STORAGE_KEYS.recommended);
    if (saved?.date === today) return;
    if (!aiConfig.apiKey) return; // 키 없음 → 풀 기반 폴백 그대로 사용
    let cancelled = false;
    generateRecommended({
      provider: aiConfig.provider,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      exclude: [...DEFAULT_CATEGORIES, ...userCategories],
    })
      .then((categories) => {
        if (cancelled) return;
        storage.set(STORAGE_KEYS.recommended, { date: today, categories });
        setRecommended(categories);
      })
      .catch(() => {
        // 실패 시 풀 기반 폴백 유지, AI 추가 호출 없음
      });
    return () => {
      cancelled = true;
    };
    // 사용자 카테고리 변경만으로 재호출하지 않는다 (하루 1회 원칙)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiConfig.provider, aiConfig.apiKey]);

  // 사용자/기본 카테고리와 겹치면 숨김
  return recommended.filter(
    (c) => !userCategories.includes(c) && !DEFAULT_CATEGORIES.includes(c)
  );
}
