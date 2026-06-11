import { useState } from 'react';
import { validateKey, AiError } from '../ai/index.js';
import { PROVIDERS, PROVIDER_IDS } from '../constants.js';

export default function SettingsScreen({
  provider,
  onChangeProvider,
  providerSettings,
  onSaveKey,
  onDeleteKey,
  onChangeModel,
  userCategories,
  onChangeUserCategories,
  onBack,
}) {
  const [keyInput, setKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState(null); // { ok, message }
  const [validating, setValidating] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const meta = PROVIDERS[provider];
  const entry = providerSettings[provider];
  const maskedKey = entry.key ? `${entry.key.slice(0, 7)}…${entry.key.slice(-4)}` : '';

  const selectProvider = (id) => {
    onChangeProvider(id);
    setKeyInput('');
    setKeyStatus(null);
  };

  const saveKey = async () => {
    const key = keyInput.trim();
    if (!key) return;
    onSaveKey(provider, key);
    setKeyInput('');
    setValidating(true);
    setKeyStatus(null);
    try {
      await validateKey(provider, key, entry.model);
      setKeyStatus({ ok: true, message: '유효한 키입니다 ✓' });
    } catch (e) {
      const message =
        e instanceof AiError ? e.message : '키 검증 중 오류가 발생했습니다.';
      setKeyStatus({ ok: false, message: `검증 실패: ${message}` });
    } finally {
      setValidating(false);
    }
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name || userCategories.includes(name)) return;
    onChangeUserCategories([...userCategories, name]);
    setNewCategory('');
  };

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="title">설정</h1>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          ← 돌아가기
        </button>
      </header>

      <section className="section">
        <h2 className="section__title">AI 프로바이더</h2>
        <div className="chip-row">
          {PROVIDER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip${provider === id ? ' chip--selected' : ''}`}
              onClick={() => selectProvider(id)}
            >
              {PROVIDERS[id].label}
              {providerSettings[id].key ? ' 🔑' : ''}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="model-select">
          모델
        </label>
        <select
          id="model-select"
          className="input"
          value={entry.model}
          onChange={(e) => onChangeModel(provider, e.target.value)}
        >
          {meta.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {entry.key ? (
          <div className="key-row">
            <span className="key-row__masked">{maskedKey}</span>
            <button
              type="button"
              className="btn btn--small btn--wrong"
              onClick={() => {
                onDeleteKey(provider);
                setKeyStatus(null);
              }}
            >
              키 삭제
            </button>
          </div>
        ) : (
          <p className="hint-text">
            {meta.label} 키가 없습니다. 키 없이도 기본 문제로 플레이할 수 있어요.
          </p>
        )}

        <div className="input-row">
          <input
            type="password"
            className="input"
            placeholder={meta.keyPlaceholder}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={validating || !keyInput.trim()}
            onClick={saveKey}
          >
            {validating ? '검증 중…' : '저장'}
          </button>
        </div>

        {keyStatus && (
          <p className={`key-status ${keyStatus.ok ? 'key-status--ok' : 'key-status--err'}`}>
            {keyStatus.message}
          </p>
        )}

        <p className="hint-text">
          키는 이 기기의 브라우저에만 저장되며, 선택한 AI 프로바이더 API 호출 외에는 어디에도
          전송되지 않습니다.
        </p>
        <p className="hint-text">
          <a href={meta.links.apiKeys} target="_blank" rel="noreferrer">
            🔗 {meta.label} 키 발급 페이지
          </a>
          {` — ${meta.keyGuide}`}
        </p>
        <p className="hint-text">
          <a href={meta.links.usage} target="_blank" rel="noreferrer">
            🔗 사용량 대시보드
          </a>
        </p>
      </section>

      <section className="section">
        <h2 className="section__title">사용자 카테고리</h2>
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
        {userCategories.length === 0 ? (
          <p className="hint-text">추가한 카테고리가 없습니다.</p>
        ) : (
          <ul className="category-list">
            {userCategories.map((c) => (
              <li key={c} className="category-list__item">
                <span>{c}</span>
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  onClick={() => onChangeUserCategories(userCategories.filter((x) => x !== c))}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="hint-text hint-text--footer">
        📱 파일로 내려받아 쓸 때는 안드로이드는 Chrome, iOS는 Safari로 열어주세요. iOS 파일 앱의
        "미리보기"로 열면 설정이 저장되지 않을 수 있어요.
      </p>
    </div>
  );
}
