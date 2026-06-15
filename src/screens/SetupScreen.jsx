import { useState } from 'react';
import {
  DEFAULT_CATEGORIES,
  DIFFICULTIES,
  STORAGE_KEYS,
  TIMER_PRESETS,
  TIMER_MIN,
  TIMER_MAX,
  PROVIDERS,
  PROVIDER_IDS,
} from '../constants.js';
import { storage } from '../storage.js';
import { getTheme } from '../theme/themes.js';
import CategoryChip from '../components/CategoryChip.jsx';

const TEAM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function clampTimer(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(TIMER_MIN, Math.min(TIMER_MAX, Math.round(n)));
}

export default function SetupScreen({
  provider,
  providerSettings,
  onChangeProvider,
  onChangeModel,
  userCategories,
  onChangeUserCategories,
  recommended,
  onStart,
  onOpenSettings,
}) {
  const [mode, setMode] = useState('solo'); // solo | team
  const [teamCount, setTeamCount] = useState(2);
  const [turnMode, setTurnMode] = useState('alternate'); // alternate | consecutive
  const [consecutiveCount, setConsecutiveCount] = useState(3);
  const [difficulty, setDifficulty] = useState('중');
  const [category, setCategory] = useState(null); // 기본 선택 없음 — 선택해야 시작 가능
  const [newCategory, setNewCategory] = useState('');
  // 제한시간: 0=없음, 1~30초. localStorage에 기억
  const [timerSec, setTimerSecState] = useState(() => clampTimer(storage.get(STORAGE_KEYS.timerSec, 0)));

  const hasApiKey = Boolean(providerSettings[provider]?.key);
  const meta = PROVIDERS[provider];

  const setTimerSec = (n) => {
    const v = clampTimer(n);
    storage.set(STORAGE_KEYS.timerSec, v);
    setTimerSecState(v);
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name || userCategories.includes(name) || DEFAULT_CATEGORIES.includes(name)) return;
    onChangeUserCategories([...userCategories, name]);
    setNewCategory('');
  };

  const removeCategory = (name) => {
    if (!window.confirm(`'${name}' 카테고리를 삭제할까요?`)) return;
    onChangeUserCategories(userCategories.filter((x) => x !== name));
    if (category === name) setCategory(null);
  };

  const start = () => {
    if (!category) return;
    onStart({
      mode,
      teamCount: mode === 'team' ? teamCount : 1,
      turnMode,
      consecutiveCount,
      difficulty,
      category,
      timerSec,
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
          🔑 {meta.label} API 키를 등록하면 AI 생성 문제를 사용할 수 있어요 →
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
        <h2 className="section__title">AI 모델</h2>
        <div className="chip-row chip-row--wrap">
          {PROVIDER_IDS.map((id) =>
            chip(
              PROVIDERS[id].label,
              provider === id,
              () => onChangeProvider(id),
              providerSettings[id]?.key ? '🔑' : undefined
            )
          )}
        </div>
        <select
          className="input"
          value={providerSettings[provider].model}
          onChange={(e) => onChangeModel(provider, e.target.value)}
        >
          {meta.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </section>

      <section className="section">
        <h2 className="section__title">제한시간</h2>
        <div className="chip-row chip-row--wrap">
          {TIMER_PRESETS.map((sec) =>
            chip(sec === 0 ? '없음' : `${sec}초`, timerSec === sec, () => setTimerSec(sec))
          )}
          <input
            type="number"
            className="input input--timer"
            min={TIMER_MIN}
            max={TIMER_MAX}
            placeholder="직접"
            value={!TIMER_PRESETS.includes(timerSec) && timerSec > 0 ? timerSec : ''}
            onChange={(e) => setTimerSec(Number(e.target.value))}
          />
        </div>
        <p className="hint-text">
          {timerSec > 0
            ? `문제당 ${timerSec}초. 시간이 다 되면 자동으로 정답 공개 후 오답 처리됩니다.`
            : '제한시간 없이 천천히 풀 수 있어요.'}
        </p>
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

        <p className="cat-group__header">내 카테고리</p>
        {userCategories.length > 0 && (
          <ul className="my-cat-list">
            {userCategories.map((c) => (
              <li key={c} className="my-cat-row">
                <CategoryChip
                  name={c}
                  theme={getTheme(c)}
                  selected={category === c}
                  onClick={() => setCategory(c)}
                />
                <button
                  type="button"
                  className="my-cat-row__del"
                  aria-label={`${c} 삭제`}
                  onClick={() => removeCategory(c)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="input-row">
          <input
            type="text"
            className="input"
            placeholder="예: 90년대 가요"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!newCategory.trim()}
            onClick={addCategory}
          >
            추가
          </button>
        </div>

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

      <button
        type="button"
        className="btn btn--primary btn--big"
        disabled={!category}
        onClick={start}
      >
        {category ? '퀴즈 시작' : '카테고리를 선택하세요'}
      </button>
    </div>
  );
}
