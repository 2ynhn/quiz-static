import { useState } from 'react';
import { storage } from './storage.js';
import { STORAGE_KEYS, PROVIDERS, DEFAULT_PROVIDER } from './constants.js';
import { useRecommended } from './hooks/useRecommended.js';
import SetupScreen from './screens/SetupScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';

// quiz.providers 로드 + v1(quiz.apiKey 단일 키) 마이그레이션
function loadProviderSettings() {
  const settings = {};
  for (const [id, meta] of Object.entries(PROVIDERS)) {
    settings[id] = { key: '', model: meta.defaultModel };
  }
  const saved = storage.get(STORAGE_KEYS.providers);
  if (saved && typeof saved === 'object') {
    for (const id of Object.keys(settings)) {
      const entry = saved[id];
      if (entry && typeof entry === 'object') {
        if (typeof entry.key === 'string') settings[id].key = entry.key;
        if (PROVIDERS[id].models.includes(entry.model)) settings[id].model = entry.model;
      }
    }
  }
  const legacyKey = storage.get(STORAGE_KEYS.legacyApiKey);
  if (typeof legacyKey === 'string' && legacyKey && !settings.openai.key) {
    settings.openai.key = legacyKey;
    storage.set(STORAGE_KEYS.providers, settings);
  }
  storage.remove(STORAGE_KEYS.legacyApiKey);
  return settings;
}

export default function App() {
  const [screen, setScreen] = useState('setup'); // setup | playing | result | settings
  const [provider, setProviderState] = useState(() => {
    const saved = storage.get(STORAGE_KEYS.provider);
    return PROVIDERS[saved] ? saved : DEFAULT_PROVIDER;
  });
  const [providerSettings, setProviderSettingsState] = useState(loadProviderSettings);
  const [userCategories, setUserCategoriesState] = useState(() =>
    storage.get(STORAGE_KEYS.userCategories, [])
  );
  // 사용자 카테고리별 출제 형식 예시 { name: "예시1, 예시2" }
  const [categoryTypeHints, setCategoryTypeHintsState] = useState(() => {
    const saved = storage.get(STORAGE_KEYS.categoryTypeHints, {});
    return saved && typeof saved === 'object' ? saved : {};
  });
  const [gameConfig, setGameConfig] = useState(null);
  const [gameResult, setGameResult] = useState(null);

  const setProvider = (id) => {
    storage.set(STORAGE_KEYS.provider, id);
    setProviderState(id);
  };

  const setProviderSettings = (next) => {
    storage.set(STORAGE_KEYS.providers, next);
    setProviderSettingsState(next);
  };

  const updateProviderEntry = (id, patch) => {
    setProviderSettings({
      ...providerSettings,
      [id]: { ...providerSettings[id], ...patch },
    });
  };

  const setUserCategories = (categories) => {
    storage.set(STORAGE_KEYS.userCategories, categories);
    setUserCategoriesState(categories);
  };

  const setCategoryTypeHints = (hints) => {
    storage.set(STORAGE_KEYS.categoryTypeHints, hints);
    setCategoryTypeHintsState(hints);
  };

  // 현재 활성 프로바이더의 AI 호출 구성
  const aiConfig = {
    provider,
    apiKey: providerSettings[provider].key,
    model: providerSettings[provider].model,
  };

  const recommended = useRecommended(aiConfig, userCategories);

  if (screen === 'playing' && gameConfig) {
    return (
      <GameScreen
        config={gameConfig}
        aiConfig={aiConfig}
        onFinish={(result) => {
          setGameResult(result);
          setScreen('result');
        }}
      />
    );
  }

  if (screen === 'result' && gameResult) {
    return <ResultScreen result={gameResult} onHome={() => setScreen('setup')} />;
  }

  if (screen === 'settings') {
    return (
      <SettingsScreen
        provider={provider}
        onChangeProvider={setProvider}
        providerSettings={providerSettings}
        onSaveKey={(id, key) => updateProviderEntry(id, { key })}
        onDeleteKey={(id) => updateProviderEntry(id, { key: '' })}
        onBack={() => setScreen('setup')}
      />
    );
  }

  return (
    <SetupScreen
      provider={provider}
      providerSettings={providerSettings}
      onChangeProvider={setProvider}
      onChangeModel={(id, model) => updateProviderEntry(id, { model })}
      userCategories={userCategories}
      onChangeUserCategories={setUserCategories}
      categoryTypeHints={categoryTypeHints}
      onChangeCategoryTypeHints={setCategoryTypeHints}
      recommended={recommended}
      onStart={(config) => {
        setGameConfig(config);
        setScreen('playing');
      }}
      onOpenSettings={() => setScreen('settings')}
    />
  );
}
