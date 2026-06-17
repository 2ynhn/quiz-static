// 기본 테마(고정). '단어 완성'은 선택 시 하위 '주제'를 입력받는 특수 테마.
export const DEFAULT_CATEGORIES = ['일반상식'];
export const WORD_COMPLETE_THEME = '단어 완성';
// 단어 완성 주제 프리셋 (자유 입력도 가능)
export const WORD_COMPLETE_PRESETS = ['영화 제목', '사자성어', '브랜드·상품명', '아이돌·그룹 이름'];
// 단어 완성: 앞 N글자만 보여주고 나머지는 칸으로 가린다
export const WORD_COMPLETE_REVEAL = 2;

export const DIFFICULTIES = ['상', '중', '하'];

// 첫 문제를 빠르게 띄우기 위해 한 번에 1문제(검수 여유분 포함 소량)만 요청하고,
// 푸는 동안 다음 문제를 백그라운드로 선행 로딩한다.
export const BATCH_SIZE = 1;
export const PREFETCH_THRESHOLD = 1;

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
  google: {
    id: 'google',
    label: 'Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'],
    defaultModel: 'gemini-2.5-flash',
    sourceLabel: '제미나이로부터 생성된 문제입니다',
    keyPlaceholder: 'AIza... 개인 Gemini API 키 입력',
    keyGuide: 'Google AI Studio에서 "Get API key"로 발급하세요. 무료 티어를 사용할 수 있습니다.',
    links: {
      apiKeys: 'https://aistudio.google.com/app/apikey',
      usage: 'https://aistudio.google.com/',
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
  categoryTypeHints: 'quiz.categoryTypeHints', // 사용자 카테고리별 출제 형식 예시
  recommended: 'quiz.recommended',
  categoryThemes: 'quiz.categoryThemes',
  askedAnswers: 'quiz.askedAnswers', // 중복 회피: { "카테고리_난이도": [정답...] }
  timerSec: 'quiz.timerSec', // 0 = 타이머 없음, 1~30 = 제한 초
  setup: 'quiz.setup', // 홈 화면에서 마지막으로 선택한 옵션들
  wikiCache: 'quiz.wikiCache', // 위키백과 분류 목록 캐시
  bankDraft: 'quiz.bankDraft', // 공유 전 로컬 문제 누적(초안)
  githubToken: 'quiz.githubToken', // 문제은행 업로드용 GitHub 토큰(소유자 전용)
  stats: 'quiz.stats',
};

// 공유 문제은행 저장소/파일 (공개 정보)
export const GITHUB_REPO = '2ynhn/quiz-static';
export const GITHUB_BRANCH = 'main';
export const BANK_PATHS = {
  general: 'bank/general.json',
  wordcomplete: 'bank/wordcomplete.json',
};
// 읽기: raw(즉시 반영, CORS *) → 실패 시 jsDelivr CDN
export const BANK_READ_URLS = {
  general: [
    `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/bank/general.json`,
    `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@${GITHUB_BRANCH}/bank/general.json`,
  ],
  wordcomplete: [
    `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/bank/wordcomplete.json`,
    `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@${GITHUB_BRANCH}/bank/wordcomplete.json`,
  ],
};

// 중복 회피 누적 제외 목록 — 키당 최대 보관 개수 / 프롬프트 전달 개수
export const ASKED_MAX_PER_KEY = 100;
export const ASKED_PROMPT_LIMIT = 80;

// 타이머 제한시간 프리셋(초). 0 = 사용 안 함
export const TIMER_PRESETS = [0, 10, 15, 20, 30];
export const TIMER_MIN = 1;
export const TIMER_MAX = 30;
