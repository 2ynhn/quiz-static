import { useState, useEffect } from 'react';
import {
  DEFAULT_CATEGORIES,
  WORD_COMPLETE_THEME,
  WORD_COMPLETE_PRESETS,
  WORD_COMPLETE_REVEAL,
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

// 홈 화면에서 마지막으로 선택한 옵션들을 복원(없으면 기본값)
const savedSetup = (() => {
  const s = storage.get(STORAGE_KEYS.setup, {});
  return s && typeof s === 'object' ? s : {};
})();

export default function SetupScreen({
  provider,
  providerSettings,
  onChangeProvider,
  onChangeModel,
  userCategories,
  onChangeUserCategories,
  categoryTypeHints = {},
  onChangeCategoryTypeHints,
  recommended,
  onStart,
  onOpenSettings,
}) {
  const [mode, setMode] = useState(savedSetup.mode === 'team' ? 'team' : 'solo');
  const [teamCount, setTeamCount] = useState(savedSetup.teamCount || 2);
  const [turnMode, setTurnMode] = useState(
    savedSetup.turnMode === 'consecutive' ? 'consecutive' : 'alternate'
  );
  const [consecutiveCount, setConsecutiveCount] = useState(savedSetup.consecutiveCount || 3);
  const [difficulty, setDifficulty] = useState(
    DIFFICULTIES.includes(savedSetup.difficulty) ? savedSetup.difficulty : '중'
  );
  // 마지막 선택 테마 복원(처음엔 null → 선택해야 시작 가능)
  const [category, setCategory] = useState(savedSetup.category || null);
  // 단어 완성 주제(선택 시 하위 입력)
  const [wordTopic, setWordTopic] = useState(savedSetup.wordTopic || '');
  const [newCategory, setNewCategory] = useState('');
  const [newTypeHint, setNewTypeHint] = useState('');
  // 제한시간: 0=없음, 1~30초. localStorage에 기억
  const [timerSec, setTimerSecState] = useState(() => clampTimer(storage.get(STORAGE_KEYS.timerSec, 0)));

  const hasApiKey = Boolean(providerSettings[provider]?.key);
  const meta = PROVIDERS[provider];

  // 선택 옵션 변경 시 localStorage에 저장 → 다음에 홈으로 오면 복원
  useEffect(() => {
    storage.set(STORAGE_KEYS.setup, {
      mode,
      teamCount,
      turnMode,
      consecutiveCount,
      difficulty,
      category,
      wordTopic,
    });
  }, [mode, teamCount, turnMode, consecutiveCount, difficulty, category, wordTopic]);

  // 복원된 테마가 더 이상 존재하지 않으면(삭제됨 등) 선택 해제
  useEffect(() => {
    if (
      category &&
      category !== WORD_COMPLETE_THEME &&
      !DEFAULT_CATEGORIES.includes(category) &&
      !userCategories.includes(category) &&
      !recommended.includes(category)
    ) {
      setCategory(null);
    }
  }, [category, userCategories, recommended]);

  const setTimerSec = (n) => {
    const v = clampTimer(n);
    storage.set(STORAGE_KEYS.timerSec, v);
    setTimerSecState(v);
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name || userCategories.includes(name) || DEFAULT_CATEGORIES.includes(name)) return;
    onChangeUserCategories([...userCategories, name]);
    const hint = newTypeHint.trim();
    if (hint) onChangeCategoryTypeHints({ ...categoryTypeHints, [name]: hint });
    setNewCategory('');
    setNewTypeHint('');
  };

  const removeCategory = (name) => {
    if (!window.confirm(`'${name}' 테마를 삭제할까요?`)) return;
    onChangeUserCategories(userCategories.filter((x) => x !== name));
    if (categoryTypeHints[name]) {
      const next = { ...categoryTypeHints };
      delete next[name];
      onChangeCategoryTypeHints(next);
    }
    if (category === name) setCategory(null);
  };

  const isWordComplete = category === WORD_COMPLETE_THEME;
  const wordReady = isWordComplete && wordTopic.trim().length > 0;
  const canStart = isWordComplete ? wordReady : Boolean(category);

  const start = () => {
    if (!canStart) return;
    const base = {
      mode,
      teamCount: mode === 'team' ? teamCount : 1,
      turnMode,
      consecutiveCount,
      difficulty,
      timerSec,
    };
    if (isWordComplete) {
      const topic = wordTopic.trim();
      onStart({
        ...base,
        category: topic,
        wordComplete: { topic, revealCount: WORD_COMPLETE_REVEAL },
      });
    } else {
      onStart({ ...base, category, typeHint: categoryTypeHints[category] || '' });
    }
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
    <div className="screen screen--setup">
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
        <h2 className="section__title">테마</h2>

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
          <CategoryChip
            name={WORD_COMPLETE_THEME}
            theme={getTheme(WORD_COMPLETE_THEME)}
            selected={isWordComplete}
            onClick={() => setCategory(WORD_COMPLETE_THEME)}
          />
        </div>

        {isWordComplete && (
          <div className="word-topic">
            <p className="cat-group__header">주제 선택</p>
            <div className="chip-row chip-row--wrap">
              {WORD_COMPLETE_PRESETS.map((p) =>
                chip(p, wordTopic.trim() === p, () => setWordTopic(p))
              )}
            </div>
            <input
              type="text"
              className="input"
              placeholder="주제 직접 입력 — 예: 영화 제목, 야구 선수, 라면 종류"
              value={wordTopic}
              onChange={(e) => setWordTopic(e.target.value)}
            />
            <p className="hint-text">
              선택한 주제의 실존 항목으로 일부 글자를 가린 문제가 나옵니다(예: 인터[][][] → 인터스텔라).
              난이도에 따라 빈 칸 수가 달라집니다 — 하: 1~2칸, 중: 3~4칸, 상: 5칸 이상.
              사자성어 주제는 위키백과에서 받아옵니다.
            </p>
          </div>
        )}

        <p className="cat-group__header">내 테마</p>
        {userCategories.length > 0 && (
          <ul className="my-cat-list">
            {userCategories.map((c) => (
              <li key={c} className="my-cat-item">
                <div className="my-cat-row">
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
                </div>
                {categoryTypeHints[c] && (
                  <p className="my-cat-hint">📐 형식 예시: {categoryTypeHints[c]}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="my-cat-add">
          <input
            type="text"
            className="input"
            placeholder="테마 이름 — 예: 영화 제목 맞추기"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <input
            type="text"
            className="input"
            placeholder="형식 예시(선택) — 예: 인터()  ← 앞 2글자만 보이고 나머지 가림"
            value={newTypeHint}
            onChange={(e) => setNewTypeHint(e.target.value)}
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
        <p className="hint-text">
          형식 예시를 적으면 그 형태로 출제됩니다. 가릴 부분은 <code>()</code>처럼 비워두세요 —
          예: <code>인터()</code>면 정답 앞 2글자만 보이고 나머지는 자동으로 가려집니다(앱이 처리).
          초성·설명형 등 다른 형식도 예시로 보여주면 됩니다.
        </p>

        {recommended.length > 0 && (
          <>
            <p className="cat-group__header cat-group__header--gold">
              ✨ 오늘의 추천 테마 <span className="cat-group__sub">하루 1회 변경</span>
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

      <div className="start-bar">
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={!canStart}
          onClick={start}
        >
          {canStart
            ? '퀴즈 시작'
            : isWordComplete
              ? '주제를 입력하세요'
              : '테마를 선택하세요'}
        </button>
      </div>
    </div>
  );
}
