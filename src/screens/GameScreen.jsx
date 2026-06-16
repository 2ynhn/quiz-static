import { useEffect, useRef, useState } from 'react';
import { useQuestionQueue } from '../hooks/useQuestionQueue.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { PROVIDERS } from '../constants.js';
import { getTheme } from '../theme/themes.js';
import PatternBg from '../components/PatternBg.jsx';
import CategoryChip from '../components/CategoryChip.jsx';
import CountdownBar from '../components/CountdownBar.jsx';

const TEAM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function GameScreen({ config, aiConfig, onFinish }) {
  const { mode, teamCount, turnMode, consecutiveCount, difficulty, category } = config;
  const timerSec = config.timerSec || 0;
  const typeHint = config.typeHint || '';

  const [teams, setTeams] = useState(() =>
    Array.from({ length: mode === 'team' ? teamCount : 1 }, (_, i) => ({
      name: mode === 'team' ? `${TEAM_LETTERS[i]}팀` : '나',
      correct: 0,
      attempted: 0,
    }))
  );
  const [turnIdx, setTurnIdx] = useState(0);
  const [streak, setStreak] = useState(0); // 연속 출제 모드에서 현재 팀이 푼 문제 수
  const [revealed, setRevealed] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const autoAdvanceRef = useRef(null);

  const { current, source, loading, notice, advance, dismissNotice } = useQuestionQueue({
    aiConfig,
    category,
    difficulty,
    typeHint,
  });

  const theme = getTheme(category);

  const clearAutoAdvance = () => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  };

  // 언마운트 시 자동 진행 타이머 정리
  useEffect(() => clearAutoAdvance, []);

  const finish = (finalTeams) => {
    clearAutoAdvance();
    const list = finalTeams || teams;
    onFinish({
      mode,
      category,
      totalQuestions: list.reduce((sum, t) => sum + t.attempted, 0),
      teams: list,
    });
  };

  const judge = (isCorrect) => {
    clearAutoAdvance();
    const nextTeams = teams.map((t, i) =>
      i === turnIdx
        ? { ...t, correct: t.correct + (isCorrect ? 1 : 0), attempted: t.attempted + 1 }
        : t
    );
    setTeams(nextTeams);

    if (mode === 'team') {
      if (turnMode === 'alternate') {
        setTurnIdx((turnIdx + 1) % teams.length);
      } else {
        const nextStreak = streak + 1;
        if (nextStreak >= consecutiveCount) {
          setStreak(0);
          setTurnIdx((turnIdx + 1) % teams.length);
        } else {
          setStreak(nextStreak);
        }
      }
    }

    setRevealed(false);
    setHintShown(false);
    setTimedOut(false);
    advance();
  };

  // 타이머: 문제 표시 중(로딩·정답확인 전)에만 가동. 0 도달 시 정답 공개 + 자동 오답 + 자동 진행
  const timerActive = timerSec > 0 && !!current && !loading && !revealed;
  const remaining = useCountdown({
    seconds: timerSec,
    active: timerActive,
    resetKey: current?.question,
    onExpire: () => {
      setRevealed(true);
      setTimedOut(true);
      autoAdvanceRef.current = setTimeout(() => judge(false), 1600);
    },
  });

  return (
    <div className="screen screen--game">
      <header className="game-header">
        {mode === 'team' ? (
          <div className="scoreboard">
            {teams.map((t, i) => (
              <div
                key={t.name}
                className={`scoreboard__team${i === turnIdx ? ' scoreboard__team--active' : ''}`}
              >
                <span className="scoreboard__name">{t.name}</span>
                <span className="scoreboard__score">{t.correct}점</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="scoreboard">
            <div className="scoreboard__team scoreboard__team--active">
              <span className="scoreboard__name">점수</span>
              <span className="scoreboard__score">
                {teams[0].correct}/{teams[0].attempted}
              </span>
            </div>
          </div>
        )}
        <button type="button" className="btn btn--ghost btn--small" onClick={() => finish()}>
          퀴즈 중지
        </button>
      </header>

      <div className="game-cat-row">
        <CategoryChip name={category} theme={theme} label={`${category} · ${difficulty}`} small />
      </div>

      {mode === 'team' && (
        <p className="turn-label">
          지금은 <strong>{teams[turnIdx].name}</strong> 차례입니다
          {turnMode === 'consecutive' && ` (${streak + 1}/${consecutiveCount})`}
        </p>
      )}

      {notice && (
        <div className="notice">
          <span>{notice.message} 기본 문제로 계속 플레이합니다.</span>
          <button type="button" className="notice__close" onClick={dismissNotice}>
            ✕
          </button>
        </div>
      )}

      <main className="question-area">
        {/* 밝은 문제 카드 위에는 패턴을 매우 옅게(0.06)만 깐다 — 가독성 우선 */}
        <PatternBg pattern={theme.pattern} color={theme.color} opacity={0.06} toneLightness={40} />
        <p className="question-source">
          {theme.emoji}{' '}
          {source === 'ai' ? PROVIDERS[aiConfig.provider].sourceLabel : '기본 문제입니다'}
        </p>
        {loading || !current ? (
          <p className="question-text question-text--loading">문제를 만들고 있어요…</p>
        ) : (
          <>
            <p className="question-text">{current.question}</p>
            {hintShown && current.hint && (
              <p className="hint-box">💡 {current.hint}</p>
            )}
            {timedOut && <p className="timeout-flash">⏱ 시간 초과!</p>}
            {revealed && (
              <div className="answer-box">
                <p className="answer-box__label">정답</p>
                <p className="answer-box__answer">{current.answer}</p>
                {current.altAnswers?.length > 0 && (
                  <p className="answer-box__alt">다른 표기: {current.altAnswers.join(', ')}</p>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {timerActive && <CountdownBar remaining={remaining} total={timerSec} />}

      <footer className="game-footer">
        {timedOut ? (
          <div className="btn-row">
            <button type="button" className="btn" disabled>
              시간 초과 — 다음 문제로 넘어갑니다…
            </button>
          </div>
        ) : !revealed ? (
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={loading || !current?.hint}
              onClick={() => setHintShown(true)}
            >
              힌트 보기
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={loading || !current}
              onClick={() => setRevealed(true)}
            >
              정답 확인
            </button>
          </div>
        ) : (
          <div className="btn-row">
            <button type="button" className="btn btn--correct" onClick={() => judge(true)}>
              ⭕ 정답
            </button>
            <button type="button" className="btn btn--wrong" onClick={() => judge(false)}>
              ❌ 오답
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
