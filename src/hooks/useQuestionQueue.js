import { useEffect, useRef, useState, useCallback } from 'react';
import { BATCH_SIZE, PREFETCH_THRESHOLD } from '../constants.js';
import { generateQuestions, AiError } from '../ai/index.js';
import { hasTheme, rememberTheme } from '../theme/themes.js';
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

// 문제 공급 큐: AI 배치 생성 → 큐 소비, 잔여 3개 이하 시 백그라운드 선행 로딩.
// AI 실패 시 내장 폴백 문제로 전환한다.
export function useQuestionQueue({ aiConfig, category, difficulty }) {
  const [current, setCurrent] = useState(null);
  const [source, setSource] = useState(aiConfig.apiKey ? 'ai' : 'fallback');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  const queueRef = useRef([]);
  const askedRef = useRef([]); // 출제된 정답 키워드 → 중복 방지 제외 목록
  const fillPromiseRef = useRef(null);
  const initRef = useRef(false);
  const fallbackPileRef = useRef([]);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const nextFallback = useCallback(() => {
    if (fallbackPileRef.current.length === 0) {
      const pool =
        FALLBACK_QUESTIONS[category] ||
        FALLBACK_QUESTIONS[FALLBACK_DEFAULT_CATEGORY];
      fallbackPileRef.current = shuffle(pool);
    }
    return fallbackPileRef.current.pop();
  }, [category]);

  const switchToFallback = useCallback(
    (err) => {
      setSource('fallback');
      if (err instanceof AiError) {
        setNotice({ type: err.type, message: err.message });
      } else {
        setNotice({ type: 'network', message: 'AI 문제 생성에 실패해 기본 문제로 전환합니다.' });
      }
    },
    []
  );

  // 동시 호출 시 진행 중인 요청 하나를 공유한다 (StrictMode 이중 실행·선행 로딩 경합 방지)
  const fillFromAi = useCallback(() => {
    if (!fillPromiseRef.current) {
      fillPromiseRef.current = (async () => {
        try {
          const { questions, theme } = await generateQuestions({
            provider: aiConfig.provider,
            apiKey: aiConfig.apiKey,
            model: aiConfig.model,
            category,
            difficulty,
            count: BATCH_SIZE,
            excludeKeywords: askedRef.current.slice(-30),
            wantTheme: !hasTheme(category),
          });
          if (theme) rememberTheme(category, theme);
          queueRef.current.push(...questions);
        } finally {
          fillPromiseRef.current = null;
        }
      })();
    }
    return fillPromiseRef.current;
  }, [aiConfig.provider, aiConfig.apiKey, aiConfig.model, category, difficulty]);

  const advance = useCallback(async () => {
    if (sourceRef.current === 'ai') {
      if (queueRef.current.length === 0) {
        setLoading(true);
        try {
          await fillFromAi();
        } catch (err) {
          switchToFallback(err);
          setCurrent(nextFallback());
          setLoading(false);
          return;
        }
      }
      const q = queueRef.current.shift();
      if (q) {
        askedRef.current.push(q.answer);
        setCurrent(q);
        setLoading(false);
        if (queueRef.current.length <= PREFETCH_THRESHOLD) {
          // 백그라운드 선행 로딩 — 실패해도 다음 advance에서 폴백 처리됨
          fillFromAi().catch(() => {});
        }
        return;
      }
      // 채우기는 성공했지만 비어 있는 비정상 상황 → 폴백
      switchToFallback(null);
    }
    setCurrent(nextFallback());
    setLoading(false);
  }, [fillFromAi, nextFallback, switchToFallback]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    advance();
    // 게임 시작 시 1회만 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { current, source, loading, notice, advance, dismissNotice: () => setNotice(null) };
}
