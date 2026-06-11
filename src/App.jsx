import { useState } from 'react';
import { storage } from './storage.js';
import { STORAGE_KEYS } from './constants.js';
import { useRecommended } from './hooks/useRecommended.js';
import SetupScreen from './screens/SetupScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';

export default function App() {
  const [screen, setScreen] = useState('setup'); // setup | playing | result | settings
  const [apiKey, setApiKeyState] = useState(() => storage.get(STORAGE_KEYS.apiKey, ''));
  const [userCategories, setUserCategoriesState] = useState(() =>
    storage.get(STORAGE_KEYS.userCategories, [])
  );
  const [gameConfig, setGameConfig] = useState(null);
  const [gameResult, setGameResult] = useState(null);

  const recommended = useRecommended(apiKey, userCategories);

  const setApiKey = (key) => {
    if (key) {
      storage.set(STORAGE_KEYS.apiKey, key);
    } else {
      storage.remove(STORAGE_KEYS.apiKey);
    }
    setApiKeyState(key || '');
  };

  const setUserCategories = (categories) => {
    storage.set(STORAGE_KEYS.userCategories, categories);
    setUserCategoriesState(categories);
  };

  if (screen === 'playing' && gameConfig) {
    return (
      <GameScreen
        config={gameConfig}
        apiKey={apiKey}
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
        apiKey={apiKey}
        onSaveKey={setApiKey}
        onDeleteKey={() => setApiKey('')}
        userCategories={userCategories}
        onChangeUserCategories={setUserCategories}
        onBack={() => setScreen('setup')}
      />
    );
  }

  return (
    <SetupScreen
      apiKey={apiKey}
      userCategories={userCategories}
      recommended={recommended}
      onStart={(config) => {
        setGameConfig(config);
        setScreen('playing');
      }}
      onOpenSettings={() => setScreen('settings')}
    />
  );
}
