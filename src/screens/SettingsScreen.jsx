import { useState } from 'react';
import { aiModelName, aiProviderName, validateKey, AiError } from '../ai/index.js';
import { LINKS } from '../constants.js';

export default function SettingsScreen({
  apiKey,
  onSaveKey,
  onDeleteKey,
  userCategories,
  onChangeUserCategories,
  onBack,
}) {
  const [keyInput, setKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState(null); // { ok, message }
  const [validating, setValidating] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const maskedKey = apiKey ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}` : '';

  const saveKey = async () => {
    const key = keyInput.trim();
    if (!key) return;
    onSaveKey(key);
    setKeyInput('');
    setValidating(true);
    setKeyStatus(null);
    try {
      await validateKey(key);
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
        <h2 className="section__title">API 키</h2>
        <p className="hint-text">
          사용 모델: <code>{aiModelName}</code> ({aiProviderName})
        </p>

        {apiKey ? (
          <div className="key-row">
            <span className="key-row__masked">{maskedKey}</span>
            <button
              type="button"
              className="btn btn--small btn--wrong"
              onClick={() => {
                onDeleteKey();
                setKeyStatus(null);
              }}
            >
              키 삭제
            </button>
          </div>
        ) : (
          <p className="hint-text">등록된 키가 없습니다. 키 없이도 기본 문제로 플레이할 수 있어요.</p>
        )}

        <div className="input-row">
          <input
            type="password"
            className="input"
            placeholder="sk-... 개인 OpenAI API 키 입력"
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
          키는 이 기기의 브라우저에만 저장되며 외부 서버로 전송되지 않습니다 (OpenAI API 호출 제외).
        </p>
        <p className="hint-text">
          <a href={LINKS.apiKeys} target="_blank" rel="noreferrer">
            🔗 OpenAI 키 발급 (platform.openai.com)
          </a>
          {' — 로그인 후 "Create new secret key"를 눌러 발급하세요. 결제 수단 등록이 필요합니다.'}
        </p>
        <p className="hint-text">
          <a href={LINKS.usage} target="_blank" rel="noreferrer">
            🔗 사용량 대시보드 (Usage)
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
