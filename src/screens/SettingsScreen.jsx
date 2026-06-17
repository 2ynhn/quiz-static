import { useState } from 'react';
import { validateKey, AiError } from '../ai/index.js';
import { PROVIDERS, PROVIDER_IDS, STORAGE_KEYS, GITHUB_REPO } from '../constants.js';
import { storage } from '../storage.js';
import { countAsked, clearAsked } from '../data/askedAnswers.js';
import { draftCounts, clearDraft } from '../data/bank.js';
import { uploadBank } from '../data/github.js';

export default function SettingsScreen({
  provider,
  onChangeProvider,
  providerSettings,
  onSaveKey,
  onDeleteKey,
  onBack,
}) {
  const [keyInput, setKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState(null); // { ok, message }
  const [validating, setValidating] = useState(false);
  const [askedCount, setAskedCount] = useState(() => countAsked());
  // 문제은행 공유(소유자)
  const [ghToken, setGhToken] = useState(() => storage.get(STORAGE_KEYS.githubToken, '') || '');
  const [draft, setDraft] = useState(() => draftCounts());
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // { ok, message }

  const saveGhToken = (v) => {
    setGhToken(v);
    if (v) storage.set(STORAGE_KEYS.githubToken, v);
    else storage.remove(STORAGE_KEYS.githubToken);
  };

  const shareBank = async () => {
    const token = ghToken.trim();
    if (!token) return;
    setUploading(true);
    setUploadStatus(null);
    try {
      const r = await uploadBank(token);
      if (r.skipped) {
        setUploadStatus({ ok: true, message: '공유할 새 문제가 없습니다.' });
      } else {
        setUploadStatus({
          ok: true,
          message: `공유 완료 — 일반상식 ${r.general}개, 단어완성 ${r.wordcomplete}개 추가됨 ✓`,
        });
      }
      setDraft(draftCounts());
    } catch (e) {
      setUploadStatus({ ok: false, message: e instanceof Error ? e.message : '업로드 실패' });
    } finally {
      setUploading(false);
    }
  };

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
        <p className="hint-text">모델 선택은 홈 화면의 'AI 모델'에서 할 수 있어요.</p>

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
        <h2 className="section__title">출제 기록</h2>
        <p className="hint-text">
          중복을 피하기 위해 출제된 정답을 기억합니다. (현재 {askedCount}개) 문제가 너무 소진되면
          초기화하세요.
        </p>
        <button
          type="button"
          className="btn btn--small btn--wrong"
          disabled={askedCount === 0}
          onClick={() => {
            clearAsked();
            setAskedCount(0);
          }}
        >
          출제 기록 초기화
        </button>
      </section>

      <section className="section">
        <h2 className="section__title">문제은행 공유 (소유자)</h2>
        <p className="hint-text">
          내가 풀며 검증한 문제가 로컬에 쌓입니다(잘못된 문제 제외). 현재 미공유:
          일반상식 {draft.general}개 · 단어완성 {draft.wordcomplete}개. 공유하면 키 없는
          사용자도 이 문제들을 풀 수 있어요.
        </p>
        <input
          type="password"
          className="input"
          placeholder="GitHub 토큰 (fine-grained, 이 저장소 contents:write)"
          value={ghToken}
          onChange={(e) => saveGhToken(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          className="btn btn--primary"
          disabled={uploading || !ghToken.trim() || draft.general + draft.wordcomplete === 0}
          onClick={shareBank}
        >
          {uploading ? '공유 중…' : '문제은행에 공유'}
        </button>
        {uploadStatus && (
          <p className={`key-status ${uploadStatus.ok ? 'key-status--ok' : 'key-status--err'}`}>
            {uploadStatus.message}
          </p>
        )}
        <button
          type="button"
          className="btn btn--small btn--ghost"
          disabled={draft.general + draft.wordcomplete === 0}
          onClick={() => {
            clearDraft();
            setDraft(draftCounts());
          }}
        >
          미공유 초안 비우기
        </button>
        <p className="hint-text">
          토큰은 이 기기에만 저장됩니다. <code>{GITHUB_REPO}</code> 저장소에만 쓰기 권한이 있는
          fine-grained 토큰을 권장합니다.
        </p>
      </section>

      <p className="hint-text hint-text--footer">
        📱 파일로 내려받아 쓸 때는 안드로이드는 Chrome, iOS는 Safari로 열어주세요. iOS 파일 앱의
        "미리보기"로 열면 설정이 저장되지 않을 수 있어요.
      </p>
    </div>
  );
}
