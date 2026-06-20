import { useEffect, useRef, useState, useCallback } from 'react';
import { BATCH_SIZE, PREFETCH_THRESHOLD } from '../constants.js';
import { generateQuestions, AiError } from '../ai/index.js';
import { hasTheme, rememberTheme } from '../theme/themes.js';
import { getAskedForPrompt, getAskedSet, addAsked } from '../data/askedAnswers.js';
import { fetchBankGeneral, fetchBankWordMap } from '../data/bank.js';
import { normalizeForLeak } from '../ai/shared.js';
import { usesTrivia } from '../categoryRules.js';
import { applyBracketMask, revealCountForDifficulty } from '../mask.js';
import {
  FALLBACK_QUESTIONS,
  FALLBACK_DEFAULT_CATEGORY,
} from '../data/fallbackQuestions.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 문제 공급 큐.
//  - 키 있음: AI 생성('ai'). 잔여 1개 이하 시 백그라운드 선행 로딩.
//  - 키 없음: 공유 문제은행('bank'). 없으면 내장 폴백('fallback').
export function useQuestionQueue({ aiConfig, category, difficulty, typeHint = '', wordComplete = null }) {
  const [current, setCurrent] = useState(null);
  const [source, setSource] = useState(aiConfig.apiKey ? 'ai' : 'bank');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  // 단어 완성은 난이도와 무관하게 같은 정답을 회피해야 한다(영화·사자성어·브랜드·아이돌 등 주제 단위 풀).
  // 일반 카테고리는 기존대로 난이도별로 누적/회피한다.
  const askedDifficulty = wordComplete ? '*' : difficulty;

  const queueRef = useRef([]);
  const fillPromiseRef = useRef(null);
  const initRef = useRef(false);
  const fallbackPileRef = useRef([]);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  // bank 정답 캐시: 세션 최초 1회 fetch 후 재사용 — AI 생성 시 bank에 이미 있는 정답을 제외하는 데 쓴다.
  const bankExcludeRef = useRef(null);

  const nextFallback = useCallback(() => {
    if (fallbackPileRef.current.length === 0) {
      const pool =
        FALLBACK_QUESTIONS[category] ||
        FALLBACK_QUESTIONS[FALLBACK_DEFAULT_CATEGORY];
      fallbackPileRef.current = shuffle(pool);
    }
    return fallbackPileRef.current.pop();
  }, [category]);

  const switchToFallback = useCallback((err) => {
    setSource('fallback');
    if (err instanceof AiError) {
      setNotice({ type: err.type, message: err.message });
    } else {
      setNotice({ type: 'info', message: '기본 문제로 진행합니다.' });
    }
  }, []);

  // AI 생성 시 bank JSON 정답을 제외하기 위한 집합 — 세션 최초 1회만 fetch해 캐시한다.
  const loadBankExclude = useCallback(async () => {
    if (bankExcludeRef.current !== null) return bankExcludeRef.current;
    const set = new Set();
    try {
      if (wordComplete) {
        const map = await fetchBankWordMap();
        const topic = wordComplete.topic || category;
        const names = Array.isArray(map[topic]) ? map[topic] : [];
        for (const n of names) {
          const norm = normalizeForLeak(n);
          if (norm) set.add(norm);
        }
      } else if (usesTrivia(category)) {
        const qs = await fetchBankGeneral();
        for (const q of qs) {
          const norm = normalizeForLeak(q.answer);
          if (norm) set.add(norm);
        }
      }
    } catch {
      // 네트워크 실패 시 빈 집합으로 진행(생성은 계속)
    }
    bankExcludeRef.current = set;
    return set;
  }, [category, wordComplete]);

  // 키 없는 사용자용: 공유 문제은행에서 현재 테마에 맞는 문제 목록을 만든다.
  const loadBankQuestions = useCallback(async () => {
    if (wordComplete) {
      const map = await fetchBankWordMap();
      const topic = wordComplete.topic || category;
      const names = Array.isArray(map[topic]) ? map[topic] : [];
      return names
        .map((n) => {
          // 빈 칸 수가 난이도에 따라 달라지도록 단어 길이별로 가림 수를 계산
          const len = [...String(n)].length;
          const masked = applyBracketMask(n, revealCountForDifficulty(len, difficulty));
          return masked ? { question: masked, answer: n, hint: '', altAnswers: [] } : null;
        })
        .filter(Boolean);
    }
    if (usesTrivia(category)) {
      return await fetchBankGeneral();
    }
    return [];
  }, [category, difficulty, wordComplete]);

  // 진행 중 요청 하나를 공유(StrictMode 이중 실행·선행 로딩 경합 방지)
  const fill = useCallback(() => {
    if (!fillPromiseRef.current) {
      fillPromiseRef.current = (async () => {
        try {
          if (sourceRef.current === 'bank') {
            const qs = await loadBankQuestions();
            const seen = getAskedSet(category, askedDifficulty);
            const fresh = [];
            for (const q of qs) {
              const k = normalizeForLeak(q.answer);
              if (k && !seen.has(k)) {
                seen.add(k);
                fresh.push(q);
              }
            }
            if (fresh.length === 0) throw new Error('empty bank');
            queueRef.current.push(...shuffle(fresh));
          } else {
            // bank에 이미 있는 정답 + 이번 세션에 출제된 정답을 합산해 제외 집합 구성
            const bankExclude = await loadBankExclude();
            const askedSet = getAskedSet(category, askedDifficulty);
            const excludeSet = bankExclude.size > 0
              ? new Set([...askedSet, ...bankExclude])
              : askedSet;
            const { questions, theme } = await generateQuestions({
              provider: aiConfig.provider,
              apiKey: aiConfig.apiKey,
              model: aiConfig.model,
              category,
              difficulty,
              count: BATCH_SIZE,
              excludeKeywords: getAskedForPrompt(category, askedDifficulty),
              excludeSet,
              wantTheme: !hasTheme(category),
              typeHint,
              wordComplete,
            });
            if (theme) rememberTheme(category, theme);
            queueRef.current.push(...questions);
          }
        } finally {
          fillPromiseRef.current = null;
        }
      })();
    }
    return fillPromiseRef.current;
  }, [
    aiConfig.provider,
    aiConfig.apiKey,
    aiConfig.model,
    category,
    difficulty,
    askedDifficulty,
    typeHint,
    wordComplete,
    loadBankQuestions,
    loadBankExclude,
  ]);

  const advance = useCallback(async () => {
    const src = sourceRef.current;
    if (src === 'ai' || src === 'bank') {
      if (queueRef.current.length === 0) {
        setLoading(true);
        try {
          await fill();
        } catch (err) {
          switchToFallback(err);
          setCurrent(nextFallback());
          setLoading(false);
          return;
        }
      }
      const q = queueRef.current.shift();
      if (q) {
        // 출제 시점에 정답을 누적 기록 → 시간초과·스킵 포함 모든 출제가 다음 배치에서 제외됨
        // 단어 완성은 난이도 무관 풀(askedDifficulty='*')에 기록되어 난이도를 바꿔도 회피된다
        addAsked(category, askedDifficulty, [q.answer]);
        setCurrent(q);
        setLoading(false);
        if (src === 'ai' && queueRef.current.length <= PREFETCH_THRESHOLD) {
          fill().catch(() => {}); // 백그라운드 선행 로딩(키 있을 때만)
        }
        return;
      }
      switchToFallback(null);
    }
    setCurrent(nextFallback());
    setLoading(false);
  }, [fill, nextFallback, switchToFallback, category, askedDifficulty]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    advance();
    // 게임 시작 시 1회만 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { current, source, loading, notice, advance, dismissNotice: () => setNotice(null) };
}
