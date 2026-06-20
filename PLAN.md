# '상식 퀴즈 풀기' 기술 명세 (v6 — 서버리스 단일 HTML · 멀티 프로바이더 · 문제은행)

**API 서버 없이** 개인 AI API 키(BYOK)와 브라우저 `localStorage`만으로 동작하는 서버리스 퀴즈 앱. 빌드 결과물은 **HTML 파일 1개**(JS/CSS 전부 인라인)이며, GitHub Actions로 자동 빌드해 **GitHub Pages에서 즉시 실행**한다.

- 배포 URL: `https://2ynhn.github.io/quiz-static/`
- 저장소: `2ynhn/quiz-static` (공개)
- ⚠️ 공개 저장소이므로 **API 키·GitHub 토큰이 소스/커밋/문서 어디에도 들어가지 않는다.** 모든 비밀값은 오직 사용자 브라우저 `localStorage`에만 존재한다.

---

## 1. 아키텍처

```
┌─ index.html (단일 파일, JS/CSS 전부 인라인) ───────────────────┐
│                                                                │
│  React 18 SPA: setup → playing → result  (+ settings)          │
│                                                                │
│  localStorage (src/storage.js 로 추상화)                       │
│   ├─ quiz.provider            현재 선택한 프로바이더            │
│   ├─ quiz.providers           프로바이더별 { key, model }       │
│   ├─ quiz.userCategories      사용자 테마 배열                  │
│   ├─ quiz.categoryTypeHints   테마별 출제 형식 예시(마스킹)     │
│   ├─ quiz.recommended         { date, categories[] }           │
│   ├─ quiz.categoryThemes      테마별 시각 테마 캐시             │
│   ├─ quiz.askedAnswers        중복 회피 누적 정답              │
│   ├─ quiz.timerSec            제한시간(0=없음)                  │
│   ├─ quiz.setup               홈 화면 마지막 선택 옵션          │
│   ├─ quiz.wikiCache           위키백과 분류 목록 캐시          │
│   ├─ quiz.bankDraft           공유 전 로컬 문제 누적(초안)      │
│   └─ quiz.githubToken         문제은행 업로드용 토큰(소유자)    │
│                                                                │
│  fetch ──► OpenAI / Anthropic / Google  (브라우저 직접, CORS)  │
│       ──► Open Trivia DB / The Trivia API  (일반상식 소스)     │
│       ──► 한국어 위키백과 API  (사자성어 목록)                 │
│       ──► raw.githubusercontent / jsDelivr  (문제은행 읽기)    │
│       ──► GitHub Contents API  (문제은행 쓰기 — 토큰 필요)     │
└────────────────────────────────────────────────────────────────┘
```

- **서버 0개, DB 0개.** 모든 외부 호출은 브라우저에서 직접 수행한다(전부 CORS 허용).
- 문제 공급은 세 갈래(`src/hooks/useQuestionQueue.js`):
  - **키 있음 → `ai`**: AI가 실시간 생성. 잔여 1개 이하일 때 백그라운드 선행 로딩.
  - **키 없음 → `bank`**: 공유 문제은행(JSON)을 직접 읽어 소비.
  - **둘 다 실패 → `fallback`**: 번들 내장 기본 문제.

### file:// 로컬 실행 요건
- 일반 Vite 빌드는 `file://`에서 모듈 로딩이 막히므로 **`vite-plugin-singlefile`로 단일 HTML 빌드 필수**(`vite.config.js`의 `base: './'`).
- Release 자산(`quiz.html`)을 내려받아 로컬에서 열 수도 있으나, **권장 사용처는 GitHub Pages**다.

---

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트 | React 18 + Vite 5 |
| 단일 파일 빌드 | `vite-plugin-singlefile` (JS·CSS를 index.html에 인라인) |
| 스타일 | 단일 CSS (`src/styles.css`) — 네이비·퍼플 그라데이션 + 골드 포인트 |
| 상태 | `useState` / 커스텀 훅 |
| AI | OpenAI Chat Completions / Anthropic Messages / Google Gemini — **브라우저 직접 호출** |
| 저장 | `localStorage` (`storage.get/set/remove` 추상화) |
| 배포 | GitHub Actions → GitHub Pages (+ Release 자산) |

의존성: `react`, `react-dom` / devDeps: `vite`, `@vitejs/plugin-react`, `vite-plugin-singlefile`.

---

## 3. AI 프로바이더 (멀티, 어댑터 구조)

`src/constants.js`의 `PROVIDERS` 메타데이터 + `src/ai/<provider>.js` 어댑터가 1:1로 대응한다. 각 어댑터는 `completeJSON({apiKey, model, system, user, sampling})`와 `validateKey()`를 노출하며, `src/ai/index.js`가 진입점이다.

| 프로바이더 | id | 모델(예) | 비고 |
|---|---|---|---|
| OpenAI | `openai` | gpt-4o-mini, gpt-4.1-mini, gpt-4o, gpt-5-mini | 결제 등록 키 필요 |
| Claude | `anthropic` | claude-haiku-4-5, claude-sonnet-4-6 | `anthropic-dangerous-direct-browser-access` 헤더 |
| Gemini | `google` | gemini-2.5-flash, gemini-2.0-flash, gemini-2.5-pro | 무료 티어 가능, 키는 쿼리 파라미터 |

- JSON 강제 + 코드펜스 제거 후 파싱(`src/ai/shared.js`). 파싱 실패 시 temperature를 낮춰 1회 재시도.
- `429`(rate limit)은 2초 후 1회 자동 재시도. 그 외 오류는 한국어 메시지로 표면화하고 폴백/문제은행으로 전환.
- 소재 수렴 방지를 위해 프로바이더별 샘플링 파라미터(temperature/penalty)를 적용.

---

## 4. 테마(카테고리) 시스템

기본 테마는 **2종**이며 `카테고리`가 아니라 **`테마`**라고 부른다.

| 구분 | 내용 | 저장 위치 |
|---|---|---|
| 기본 | **일반상식**, **단어 완성** | 프론트 상수(`DEFAULT_CATEGORIES`, `WORD_COMPLETE_THEME`) |
| 사용자(n) | 설정/홈에서 추가·삭제, 출제 형식 예시(typeHint) 지정 가능 | `quiz.userCategories`, `quiz.categoryTypeHints` |
| 추천(n) | "오늘의 추천 테마" — 하루 1회 갱신 | `quiz.recommended` (`useRecommended`) |

- 처음엔 선택된 테마가 없으며, **테마를 선택해야 시작 버튼이 활성화**된다.
- 각 테마는 이모지·색·인라인 SVG 패턴으로 된 **시각 테마**를 가진다(`src/theme/themes.js`, 외부 이미지 0개). 캐시에 없으면 생성 시 AI가 함께 제안.

### 4-1. 일반상식
- **한국 + 세계 블렌드**(`generateGeneralKnowledge`, `KOREA_RATIO=0.6`).
  - 한국 문제: AI가 한국 가중 규칙으로 주관식 생성.
  - 세계 문제: Open Trivia DB / The Trivia API(영어)에서 받아 사용자 키로 **한국어 객관식으로 번역**.
- **연도 정답(예: 1945년) 제외**(`isYearAnswer`).
- 객관식 문제는 문제 아래에 보기 목록을 표시하고, 정답 공개 시 정답 보기를 강조.

### 4-2. 단어 완성 (`단어 완성`)
- 선택 시 하위 **주제**를 입력(프리셋: 영화 제목 / 사자성어 / 브랜드·상품명 / 아이돌·그룹 이름, 자유 입력 가능).
- 항목 출처:
  - **사자성어/고사성어** → 한국어 **위키백과 분류 API**(키 불필요, 7일 캐시).
  - **그 외 주제** → AI가 **실존 유명 항목 목록** 생성(가상 금지).
- **결정적 마스킹(`src/mask.js`)** — AI는 정답 전체만 만들고, 가림은 코드가 수행해 정답 노출을 막는다.
  - 표시 문자는 **`□`(U+25A1)**. 예: `인터스텔라` → `인터□□□`.
  - **난이도별 빈 칸 수**: 하 1~2칸, 중 3~4칸, 상 5칸 이상(단어 길이 한도 내). 중·상은 **최소 2글자 노출**.
  - **공백 규칙**: 공백은 글자 수에 포함하지 않고 그대로 표시한다. 가림(□)은 **공백을 가로지르지 않는다**(가려지는 구간은 마지막 공백 이후 연속 구간). 예: `분노의 □□` (O) / `분노□ □□` (X).
  - **영화 제목**은 공백 제외 **3글자 이상**만 출제하며, 띄어쓰기를 그대로 유지한다.

### 4-3. 사용자 테마의 "출제 형식 예시(typeHint)"
- 예시에 빈칸 표시(`인터()`)만 있으면 → **프리픽스 마스킹**으로 해석해 코드가 정답 앞 N글자만 남기고 가린다(`parseMaskTemplate`/`applyMask`).
- `src/categoryRules.js`가 테마명의 '숨은 의도'를 코드로 먼저 분류해 도메인 규칙/마스킹을 주입한다.

---

## 5. 문제 품질 파이프라인 (`src/ai/`)

1. **생성**: `QUESTION_SYSTEM_PROMPT`(사실성·도메인 환각 방지·난이도=예상 정답률) + 다양성 축(시드/세부주제/관점 로테이션, `src/data/subtopics.js`).
2. **기계 필터**: 문제문/힌트에 정답이 노출된 문제 제거(`leaksAnswer`).
3. **AI 교차 검수**: 같은 모델을 검수자로 재호출해 오답·난이도 이탈·창작 문제 탈락(`REVIEW_SYSTEM_PROMPT`).
4. **중복 회피**: 출제된 정답을 누적(`quiz.askedAnswers`)해 다음 생성의 제외 집합으로 사용.
   - 보관 한도 **500**(`ASKED_MAX_PER_KEY`), 프롬프트 전달 한도 **150**(`ASKED_PROMPT_LIMIT`).
   - **단어 완성은 난이도와 무관하게 주제 단위로 회피**(난이도 키를 `*`로 통합). 일반 테마는 난이도별 누적.
   - AI 생성 시 **문제은행(bank) JSON의 기존 정답도 제외**(세션 최초 1회 fetch 후 캐시).
- typeHint/마스킹 문제는 정답 노출이 의도된 것이므로 노출 필터·검수를 건너뛴다.

---

## 6. 공유 문제은행 (crowdsourced)

키 보유자(소유자)가 검증한 문제를 누적해 키 없는 사용자에게 제공하는 구조.

- **누적(초안)**: 게임 중 `정답`/`오답`으로 판정한 AI 생성 문제만 로컬 초안(`quiz.bankDraft`)에 쌓는다. `잘못된 문제` 판정은 집계·누적·공유 모두 **제외**.
  - `bank/general.json`(일반상식 문제 객체 배열) / `bank/wordcomplete.json`(`{ 주제: [정답 이름] }`)로 분리.
- **업로드(소유자)**: 설정 화면의 "문제은행 공유" 버튼 → GitHub **Contents API**로 원격 JSON에 병합 커밋(`src/data/github.js`). 정규화 기준 중복 제거.
  - 필요한 토큰: fine-grained PAT, `2ynhn/quiz-static` 단일 저장소, **Contents: Read and write**. `quiz.githubToken`(브라우저)에만 저장.
- **읽기(키 없는 사용자)**: `raw.githubusercontent.com` → 실패 시 `jsDelivr` 순으로 JSON을 읽어 문제로 변환(단어 완성은 읽는 시점에 난이도별 마스킹 재생성).

---

## 7. 화면 구성 (`src/screens/`)

SPA 내부 상태 전환: `setup → playing → result` (+ `settings`).

- **SetupScreen(홈)**: 플레이 방식(혼자/팀전), 팀 수·출제 방식(번갈아/N연속), 난이도(상·중·하), **AI 모델 선택**, 제한시간(프리셋+직접), **테마 선택**(기본+내 테마+추천), 단어 완성 주제 입력. 하단 **고정 `퀴즈 시작` 바**. 선택 옵션은 `quiz.setup`에 저장·복원.
- **GameScreen**: 문제 카드 + 출처 표기(`GPT/클로드/제미나이로부터 생성`, `공유된 문제입니다`, `기본 문제입니다`), 객관식 보기, 점수판/차례, `힌트 보기`·`정답 확인` → `⭕ 정답`/`❌ 오답`/`🚫 잘못된 문제`, 선택형 카운트다운 타이머, `퀴즈 중지`.
- **ResultScreen**: 총 문항·팀(개인)별 정답 수/정답률, `처음으로`.
- **SettingsScreen**: 프로바이더별 키 관리(저장 시 유효성 검증, 발급/사용량 링크), 출제 기록 초기화, **문제은행 공유(소유자)**(토큰 입력 + 초안 개수 + 업로드/비우기).

---

## 8. 빌드·배포 (`.github/workflows/build.yml`)

`main` push 시:
1. `npm ci && npm run build` → `dist/index.html` 단일 파일.
2. **GitHub Pages 배포**(`actions/configure-pages`(자동 활성화 시도, continue-on-error) → `upload-pages-artifact` → `deploy-pages`).
3. **Release 자산**: `dist/index.html`을 `quiz.html`로 복사해 `latest` 태그 릴리스에 첨부(`softprops/action-gh-release`).

> Pages가 동작하려면 저장소 Settings에서 Source=GitHub Actions, 기본 브랜치=main, github-pages 환경의 배포 브랜치=main 이어야 한다.

---

## 9. 디렉터리 개요

```
quiz-static/
├─ index.html, vite.config.js, package.json
├─ bank/                  공유 문제은행 (general.json, wordcomplete.json)
├─ .github/workflows/build.yml
└─ src/
   ├─ App.jsx, main.jsx, constants.js, storage.js, styles.css
   ├─ mask.js             결정적 마스킹(난이도/공백/□)
   ├─ categoryRules.js    테마 숨은 의도 분류
   ├─ ai/                 index, openai, anthropic, google, prompts, shared, errors
   ├─ data/               trivia, wiki, bank, github, askedAnswers, subtopics,
   │                      recommendedPool, fallbackQuestions
   ├─ hooks/              useQuestionQueue, useCountdown, useRecommended
   ├─ components/         CategoryChip, CountdownBar, PatternBg
   ├─ screens/            SetupScreen, GameScreen, ResultScreen, SettingsScreen
   └─ theme/themes.js
```

---

## 10. 보안·운영 원칙

- **BYOK**: 모든 API 키와 GitHub 토큰은 브라우저 `localStorage`에만 저장. 소스/커밋/문서/빌드 산출물에 절대 포함하지 않는다.
- GitHub 토큰은 **fine-grained, 단일 저장소(`2ynhn/quiz-static`), Contents: write**로만 발급.
- 정답 판정은 사람이 직접 버튼으로 하므로 AI 답안의 표기 흔들림이 치명적이지 않다.
