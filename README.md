# 상식 퀴즈 풀기 (quiz-static)

서버 없이 **HTML 파일 1개**로 동작하는 한국어 상식 퀴즈 게임. 개인 OpenAI API 키(BYOK)를 등록하면 AI가 문제를 생성하고, 키가 없어도 내장 기본 문제로 플레이할 수 있습니다.

기술 기획서: [PLAN.md](./PLAN.md)

## 사용 방법

| 방식 | URL |
|---|---|
| 브라우저로 바로 실행 (GitHub Pages) | `https://<계정>.github.io/quiz-static/` |
| 파일 다운로드 → 로컬 실행 | `https://github.com/<계정>/quiz-static/releases/latest/download/quiz.html` |

로컬 실행 시 안드로이드는 **Chrome**, iOS는 **Safari**로 열어주세요. iOS 파일 앱의 "미리보기"로 열면 설정(localStorage)이 저장되지 않을 수 있습니다.

## 기능

- 혼자 풀기 / 팀전 (팀 수 설정, 번갈아 풀기 또는 N문제 연속 풀기)
- 난이도 상 / 중 / 하, 주관식 전용
- 카테고리: 기본 4종(일반상식·사자성어·한국사·세계사) + 사용자 추가 + ✨오늘의 추천 2종(하루 1회 갱신)
- AI 문제 생성: OpenAI `gpt-4o-mini` 브라우저 직접 호출 (배치 생성 + 백그라운드 선행 로딩 + 중복 방지)
- 키 없음/호출 실패 시 내장 폴백 문제(카테고리별 30문제)로 자동 전환
- API 키는 브라우저 localStorage에만 저장 — 서버로 전송되지 않음

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/index.html 단일 파일 생성 (vite-plugin-singlefile)
```

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드해 **GitHub Pages 배포 + Release에 `quiz.html` 첨부**를 동시에 수행합니다.

> Pages 사용 시 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정해야 합니다.
