# '상식 퀴즈 풀기' 기술 기획서 (v5 — 서버리스 단일 HTML · OpenAI 버전)
**API 서버 없이** 개인 OpenAI API 키(BYOK)와 localStorage만으로 동작하는 최소 구성. 빌드 결과물은 **HTML 파일 1개**이며, GitHub Actions로 자동 빌드해 웹에서 다운로드(또는 GitHub Pages로 즉시 실행)할 수 있게 한다. Claude Code에 이 문서를 넘겨 개발을 시작하는 것을 전제로 작성됨.
---
## 1. 아키텍처
```
┌─ quiz.html (단일 파일, JS/CSS 전부 인라인) ─────────┐
│                                                      │
│  React 게임 로직 (설정 → 풀이 → 결과 + 설정 화면)   │
│                                                      │
│  localStorage                                        │
│   ├─ quiz.apiKey        개인 OpenAI API 키           │
│   ├─ quiz.userCategories 사용자 카테고리 배열        │
│   ├─ quiz.recommended   { date, categories[2] }      │
│   └─ quiz.stats         누적 통계(선택)              │
│                                                      │
│  fetch ──────────► OpenAI API 직접 호출              │
│                    (api.openai.com — CORS 지원)      │
└──────────────────────────────────────────────────────┘
```
- **서버 0개, DB 0개.** OpenAI API는 브라우저 직접 호출(CORS)이 가능하다.
- 최초 실행 시 키가 없으면 설정 화면으로 안내. 키 입력 전에는 폴백 기본 문제로만 플레이 가능.
- AI 호출은 `generateQuestions()`, `generateRecommended()` 두 함수로 추상화하고, 내부에 **provider 어댑터 구조**(현재 OpenAI 1종)를 둔다 → 추후 Gemini 추가나 quiz-api(공용키 프록시) 연결 시 어댑터만 추가.
### file:// 로컬 실행 요건
- 일반 Vite 빌드(js/css 분리)는 `file://`에서 모듈 로딩이 CORS에 막혀 실행 불가 → **`vite-plugin-singlefile`로 단일 HTML 빌드 필수.**
- iOS 파일 앱 "미리보기"로 열면 localStorage가 유지되지 않을 수 있음 → 안드로이드는 Chrome으로, iOS는 Safari로 열도록 안내 문구 포함.
- 서비스 워커는 `file://`에서 미동작 → PWA는 추후 호스팅 단계의 일.
---
## 2. 기술 스택
| 영역 | 선택 | 비고 |
|---|---|---|
| 프론트 | React + Vite | |
| 단일 파일 빌드 | **vite-plugin-singlefile** | JS·CSS를 index.html에 전부 인라인 |
| 스타일 | SCSS 또는 CSS-in-JS | 단일 파일 인라인에 지장 없는 방식 |
| 상태 관리 | useState / useReducer | 게임 1판은 단순 상태 머신 |
| AI | **OpenAI Chat Completions, 브라우저 직접 호출** | 모델은 저비용 mini 계열(예: `gpt-4o-mini`)을 상수로 정의, 설정 화면에 표시 |
| 저장 | localStorage | `storage.get()/set()` 추상화 (추후 Capacitor Preferences 교체 대비) |
| 배포 | GitHub Actions → Release/Pages | 4절 |
### 비용 메모 (Gemini와 다른 점)
- OpenAI에는 **상시 무료 티어가 없다.** 결제 등록된 키의 종량 과금이며, mini 계열 모델 기준 퀴즈 1배치(10~20문제) 생성 비용은 1원 미만~수 원 수준으로 사실상 무시 가능.
- 따라서 "무료 한도 초과 시 키 입력" 같은 흐름은 없고, 처음부터 본인 키로 시작하는 단일 흐름이다.
- 키 사용량은 OpenAI 대시보드(Usage)에서 확인 가능 — 설정 화면에 안내 링크 포함.
---
## 3. 카테고리 시스템 — 기본(4) + 사용자(n) + 추천(2)
| 구분 | 내용 | 저장 위치 | 갱신 |
|---|---|---|---|
| 기본 (4) | **일반상식, 사자성어, 한국사, 세계사** | 프론트 상수 (서버가 없으므로) | 코드 수정 시 |
| 사용자 (n) | 설정 화면에서 추가/삭제 | `quiz.userCategories` | 사용자 조작 |
| 추천 (2) | "오늘의 추천 카테고리" | `quiz.recommended` | **하루 1회** |
### 오늘의 추천 동작 (서버 없는 버전)
```
홈 화면 진입 시:
  quiz.recommended.date === 오늘 → 저장된 2개 즉시 표시 (네트워크 0회)
  날짜가 다름 + 키 있음 → 백그라운드로 OpenAI에 추천 2개 생성 요청
      프롬프트: "기본 4개·사용자 카테고리와 겹치지 않는 흥미로운 퀴즈 카테고리 2개, JSON만"
      성공 → { date: 오늘, categories } 저장 후 갱신
      실패/키 없음 → 내장 추천 풀(20개)에서 날짜 기반으로 2개 선택 (폴백, AI 호출 0회)
```
- 홈 화면 표시: 기본 4 + 사용자 n + ✨오늘의 추천 2(배지로 구분). 모두 동일한 선택 칩이며 선택된 이름이 그대로 생성 프롬프트에 들어간다.
- 추천이 사용자 카테고리와 겹치면 프론트에서 숨김 처리.
---
## 4. 빌드·배포 — GitHub Actions로 "웹에서 다운로드"까지
저장소 구조와 워크플로:
```
quiz-static/
 ├─ src/                    React 소스
 ├─ vite.config.js          vite-plugin-singlefile 설정
 └─ .github/workflows/build.yml
```
**build.yml 동작 (main push 시):**
1. `npm ci && npm run build` → `dist/index.html` 단일 파일 생성
2. 배포 2종 동시 수행:
   - **GitHub Pages 배포** → `https://<계정>.github.io/quiz-static/` 에서 **브라우저로 바로 실행** (다운로드 없이 사용 가능, file:// 제약도 없음)
   - **GitHub Release에 `quiz.html` 첨부** → Release 페이지의 고정 URL에서 **파일 다운로드** (로컬 실행용)
| 배포 방식 | 용도 | URL 형태 |
|---|---|---|
| GitHub Pages | 즉시 실행 (권장 기본) | `https://<계정>.github.io/quiz-static/` |
| Release 자산 | 파일 다운로드 → 로컬 실행 | `https://github.com/<계정>/quiz-static/releases/latest/download/quiz.html` |
- Pages 쪽은 https 호스팅이므로 나중에 PWA(홈 화면 설치)로 확장 가능 — file:// 방식의 단점이 자연 해소됨.
- 기존에 운영 중인 build.yml(dist 커밋) 패턴과 동일한 난이도이며, Pages 배포는 공식 액션(`actions/deploy-pages`) 조합으로 처리.
### Claude Code 작업 지시 예시
이 md를 저장소 루트에 두고 Claude Code에 다음 순서로 지시한다:
1. "이 기획서대로 Vite+React 프로젝트를 생성하고 vite-plugin-singlefile 단일 빌드를 설정해"
2. "솔로 모드 → 팀전 순서로 화면을 구현해" (5절 명세)
3. "GitHub Pages + Release 배포용 build.yml을 작성해"
4. `gh repo create quiz-static --public` 후 push → Actions가 빌드/배포 (Claude Code가 gh CLI로 저장소 생성·push까지 수행 가능)
⚠️ 공개 저장소에 올리므로 **API 키가 소스·커밋·기획서 어디에도 들어가지 않도록 주의** (키는 오직 사용자 브라우저의 localStorage에만 존재).
---
## 5. 화면 구성
SPA 내부 상태 전환 (`setup → playing → result` + `settings`).
### 5-1. 홈 / 게임 구성 화면
- 혼자 풀기 / 팀전 선택
- 팀전: 팀 수 입력 → 팀명 A~Z 자동 할당
- 팀전: 출제 방식 — 번갈아 풀기 / N문제 연속 풀기 (연속 개수 입력)
- 난이도: 상 / 중 / 하
- 카테고리: 기본(4) + 사용자(n) + 오늘의 추천(2) — 3절 참조 (주관식만, 객관식 없음)
- 키 미입력 상태면 상단에 "API 키를 등록하면 AI 생성 문제를 사용할 수 있어요" 배너 → 설정 화면 이동
### 5-2. 게임 화면
- 중앙 최대 면적: **문제 텍스트** + 상단 소형 표기 **"GPT로부터 생성된 문제입니다"** / 폴백 시 "기본 문제입니다"
- 상단: 현재 차례 팀명 + 팀별 점수 (팀전일 때)
- 버튼: `힌트 보기` / `정답 확인`(누르면 정답이 아래 노출) → `정답` / `오답` 판정으로 점수 카운트
- 한쪽: `퀴즈 중지`
- 혼자 풀기는 연속 출제, 팀전은 설정에 따라 턴 전환
### 5-3. 결과 화면
- 총 문항 수, 팀별(개인) 정답 수와 정답률
- `처음으로` 버튼
### 5-4. 설정 화면
**API 키**
- 사용 모델명 표시 (예: `gpt-4o-mini`)
- 개인 OpenAI API 키 입력란 — 마스킹, 저장 시 `quiz.apiKey` 기록
- 저장 직후 초소형 테스트 호출로 유효성 검증 → "유효한 키입니다 ✓" / 실패 사유 표시
- 키 삭제 버튼 (삭제 시 폴백 문제 모드로 전환)
- OpenAI 키 발급 페이지(platform.openai.com) 링크 + 짧은 발급 안내 + 사용량 대시보드 링크
**사용자 카테고리 관리**
- 추가 입력란 + 목록 + 개별 삭제 → `quiz.userCategories` 즉시 반영
---
## 6. AI 문제 생성 설계 (OpenAI 브라우저 직접 호출)
```
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer {quiz.apiKey}
{
  "model": "gpt-4o-mini",
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "한국어 주관식 상식 퀴즈 출제자. 객관식 금지,
       답은 짧은 단어/구. 반드시 {\"questions\":[...]} 형태의 JSON만 출력." },
    { "role": "user", "content": "카테고리: {category}, 난이도: {difficulty},
       {count}문제. 각 문제에 question/answer/hint/altAnswers 포함.
       다음 키워드의 문제는 제외: {이미 출제된 키워드}" }
  ]
}
```
- **JSON 모드(`response_format`)를 사용**해 파싱 안정성 확보. 그래도 try/catch + 백틱 제거 후 파싱.
- **배치 생성**: 10~20문제씩 생성해 큐로 소비, 남은 문제 3개 이하 시 백그라운드 선행 로딩.
- **중복 방지**: 출제된 문제 키워드를 다음 요청의 제외 목록으로 전달.
- **에러 처리** (OpenAI 에러 코드 기준):
  - `401` (invalid_api_key) → "키가 올바르지 않습니다" + 설정 화면 유도
  - `429` + `insufficient_quota` → "키의 크레딧/결제 한도가 소진되었습니다. OpenAI 대시보드를 확인하세요" + 폴백 문제로 계속 플레이 제안
  - `429` (rate_limit) → 짧은 대기 후 1회 자동 재시도, 실패 시 폴백
  - 네트워크/파싱 실패 → 폴백 문제 전환
- **폴백 JSON**: 기본 카테고리별 문제 30~50개를 번들에 내장. 키가 없어도 폴백만으로 게임이 성립하도록(첫 실행 데모 겸용).
- 정답 판정은 사람이 직접 버튼으로 하므로 AI 답안의 표기 흔들림이 치명적이지 않음.
---
## 7. 향후 확장 로드맵 (코드 변경 최소화 전제)
| 단계 | 내용 | 변경 범위 |
|---|---|---|
| 현재 | 단일 HTML + OpenAI BYOK + localStorage | — |
| 멀티 프로바이더 | 설정에서 OpenAI/Gemini 선택 + 키 입력 (Gemini 무료 티어 활용 가능) | provider 어댑터 1개 추가 |
| 호스팅 강화 | GitHub Pages를 기본 사용처로, PWA(manifest+SW) 추가 | 빌드 설정 + 매니페스트 |
| 공개 운영 | quiz-api(공용키 프록시, NAS Docker) 추가 → 키 없는 사용자도 플레이 | 어댑터 1개 추가 + 서버 1개 |
| 앱 출시 | Capacitor 패키징, localStorage → Preferences | `storage` 추상화 함수 교체 |
공개 운영 시 공용키는 종량 과금 노출을 피하기 위해 Gemini 무료 티어 키를 권장(v3 문서 참조). NAS Web Station / quiz-api / 방화벽 구성 등 상세는 v3 문서 7절을 그대로 사용한다.
