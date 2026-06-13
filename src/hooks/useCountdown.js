import { useEffect, useRef, useState } from 'react';

// 카운트다운 훅 — Date.now() 기준 경과시간으로 계산(setInterval 누적 오차 방지).
// active가 true이고 resetKey가 바뀌면 seconds부터 다시 시작. 0 도달 시 onExpire 1회 호출.
export function useCountdown({ seconds, active, resetKey, onExpire }) {
  const [remaining, setRemaining] = useState(seconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!active || !seconds || seconds <= 0) {
      setRemaining(seconds);
      return undefined;
    }
    const startedAt = Date.now();
    setRemaining(seconds);
    let timer;
    let fired = false;
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      if (left <= 0) {
        if (!fired) {
          fired = true;
          onExpireRef.current?.();
        }
        return;
      }
      timer = setTimeout(tick, 100);
    };
    timer = setTimeout(tick, 100);
    // 화면 전환·문제 변경 시 정리 (메모리 누수 방지)
    return () => clearTimeout(timer);
  }, [active, seconds, resetKey]);

  return remaining;
}
