// 풀이 타이머 바 — 남은 시간 비율로 width 감소. 잔여 30% 이하부터 경고색.
export default function CountdownBar({ remaining, total }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const warn = pct <= 0.3;
  const secs = Math.ceil(remaining);
  return (
    <div className="countdown" role="timer" aria-label={`남은 시간 ${secs}초`}>
      <div className="countdown__track">
        <div
          className={`countdown__fill${warn ? ' countdown__fill--warn' : ''}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className={`countdown__num${warn ? ' countdown__num--warn' : ''}`}>{secs}</span>
    </div>
  );
}
