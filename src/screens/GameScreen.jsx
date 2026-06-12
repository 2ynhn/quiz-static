import { useState } from 'react';
import { useQuestionQueue } from '../hooks/useQuestionQueue.js';
import { PROVIDERS } from '../constants.js';
import { getTheme } from '../theme/themes.js';
import PatternBg from '../components/PatternBg.jsx';
import CategoryChip from '../components/CategoryChip.jsx';

const TEAM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function GameScreen({ config, aiConfig, onFinish }) {
  const { mode, teamCount, turnMode, consecutiveCount, difficulty, category } = config;

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

  const { current, source, loading, notice, advance, dismissNotice } = useQuestionQueue({
    aiConfig,
    category,
    difficulty,
  });

  const theme = getTheme(category);

  const finish = (finalTeams) => {
    const list = finalTeams || teams;
    onFinish({
      mode,
      category,
      totalQuestions: list.reduce((sum, t) => sum + t.attempted, 0),
      teams: list,
    });
  };

  const judge = (isCorrect) => {
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
    advance();
  };

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

      <footer className="game-footer">
        {!revealed ? (
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
