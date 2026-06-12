import { useState } from 'react';
import { DEFAULT_CATEGORIES, DIFFICULTIES } from '../constants.js';
import { getTheme } from '../theme/themes.js';
import CategoryChip from '../components/CategoryChip.jsx';

const TEAM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function SetupScreen({
  hasApiKey,
  userCategories,
  recommended,
  onStart,
  onOpenSettings,
}) {
  const [mode, setMode] = useState('solo'); // solo | team
  const [teamCount, setTeamCount] = useState(2);
  const [turnMode, setTurnMode] = useState('alternate'); // alternate | consecutive
  const [consecutiveCount, setConsecutiveCount] = useState(3);
  const [difficulty, setDifficulty] = useState('중');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);

  const start = () => {
    onStart({
      mode,
      teamCount: mode === 'team' ? teamCount : 1,
      turnMode,
      consecutiveCount,
      difficulty,
      category,
    });
  };

  const chip = (label, selected, onClick, badge) => (
    <button
      key={label}
      type="button"
      className={`chip${selected ? ' chip--selected' : ''}`}
      onClick={onClick}
    >
      {badge && <span className="chip__badge">{badge}</span>}
      {label}
    </button>
  );

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="title">상식 퀴즈 풀기</h1>
        <button type="button" className="btn btn--ghost" onClick={onOpenSettings}>
          ⚙️ 설정
        </button>
      </header>

      {!hasApiKey && (
        <button type="button" className="banner" onClick={onOpenSettings}>
          🔑 API 키를 등록하면 AI 생성 문제를 사용할 수 있어요 →
        </button>
      )}

      <section className="section">
        <h2 className="section__title">플레이 방식</h2>
        <div className="chip-row">
          {chip('혼자 풀기', mode === 'solo', () => setMode('solo'))}
          {chip('팀전', mode === 'team', () => setMode('team'))}
        </div>
      </section>

      {mode === 'team' && (
        <>
          <section className="section">
            <h2 className="section__title">팀 수</h2>
            <div className="stepper">
              <button
                type="button"
                className="btn btn--small"
                onClick={() => setTeamCount(Math.max(2, teamCount - 1))}
              >
                −
              </button>
              <span className="stepper__value">{teamCount}팀</span>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => setTeamCount(Math.min(26, teamCount + 1))}
              >
                +
              </button>
            </div>
            <p className="hint-text">
              팀명: {Array.from({ length: teamCount }, (_, i) => TEAM_LETTERS[i]).join(', ')}
            </p>
          </section>

          <section className="section">
            <h2 className="section__title">출제 방식</h2>
            <div className="chip-row">
              {chip('번갈아 풀기', turnMode === 'alternate', () => setTurnMode('alternate'))}
              {chip(
                'N문제 연속 풀기',
                turnMode === 'consecutive',
                () => setTurnMode('consecutive')
              )}
            </div>
            {turnMode === 'consecutive' && (
              <div className="stepper">
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => setConsecutiveCount(Math.max(2, consecutiveCount - 1))}
                >
                  −
                </button>
                <span className="stepper__value">{consecutiveCount}문제씩</span>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => setConsecutiveCount(Math.min(10, consecutiveCount + 1))}
                >
                  +
                </button>
              </div>
            )}
          </section>
        </>
      )}

      <section className="section">
        <h2 className="section__title">난이도</h2>
        <div className="chip-row">
          {DIFFICULTIES.map((d) => chip(d, difficulty === d, () => setDifficulty(d)))}
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">카테고리</h2>

        <p className="cat-group__header">기본</p>
        <div className="chip-row chip-row--wrap">
          {DEFAULT_CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              name={c}
              theme={getTheme(c)}
              selected={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>

        {userCategories.length > 0 && (
          <>
            <p className="cat-group__header">내 카테고리</p>
            <div className="chip-row chip-row--wrap">
              {userCategories.map((c) => (
                <CategoryChip
                  key={c}
                  name={c}
                  theme={getTheme(c)}
                  selected={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>
          </>
        )}

        {recommended.length > 0 && (
          <>
            <p className="cat-group__header cat-group__header--gold">
              ✨ 오늘의 추천 <span className="cat-group__sub">하루 1회 변경</span>
            </p>
            <div className="chip-row chip-row--wrap">
              {recommended.map((c) => (
                <CategoryChip
                  key={c}
                  name={c}
                  theme={getTheme(c)}
                  selected={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <button type="button" className="btn btn--primary btn--big" onClick={start}>
        퀴즈 시작
      </button>
    </div>
  );
}
