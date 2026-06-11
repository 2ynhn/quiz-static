export const DEFAULT_CATEGORIES = ['일반상식', '사자성어', '한국사', '세계사'];

export const DIFFICULTIES = ['상', '중', '하'];

export const BATCH_SIZE = 10;
export const PREFETCH_THRESHOLD = 3;

// provider 어댑터 메타데이터 — 어댑터 구현은 src/ai/ 아래에 1:1로 존재한다.
export const PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o', 'gpt-5-mini'],
    defaultModel: 'gpt-4o-mini',
    sourceLabel: 'GPT로부터 생성된 문제입니다',
    keyPlaceholder: 'sk-... 개인 OpenAI API 키 입력',
    keyGuide: '로그인 후 "Create new secret key"를 눌러 발급하세요. 결제 수단 등록이 필요합니다.',
    links: {
      apiKeys: 'https://platform.openai.com/api-keys',
      usage: 'https://platform.openai.com/usage',
    },
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    models: ['claude-haiku-4-5', 'claude-sonnet-4-6'],
    defaultModel: 'claude-haiku-4-5',
    sourceLabel: '클로드로부터 생성된 문제입니다',
    keyPlaceholder: 'sk-ant-... 개인 Anthropic API 키 입력',
    keyGuide: '로그인 후 API Keys 메뉴에서 발급하세요. 크레딧 충전이 필요합니다.',
    links: {
      apiKeys: 'https://platform.claude.com/settings/keys',
      usage: 'https://platform.claude.com/settings/usage',
    },
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);
export const DEFAULT_PROVIDER = 'openai';

export const STORAGE_KEYS = {
  provider: 'quiz.provider',
  providers: 'quiz.providers',
  legacyApiKey: 'quiz.apiKey', // v1 단일 키 — providers.openai.key로 마이그레이션
  userCategories: 'quiz.userCategories',
  recommended: 'quiz.recommended',
  stats: 'quiz.stats',
};
