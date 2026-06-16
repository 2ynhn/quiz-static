// 글로벌 상식(Trivia) API에서 실제 검증된 일반상식 문제를 받아온다(영어). 키 불필요.
// 1순위 Open Trivia DB(opentdb.com), 실패 시 The Trivia API(the-trivia-api.com).
// 반환: [{ question, answer }] (영어) — 번역은 호출부에서 AI 어댑터로 수행.

const OPENTDB = 'https://opentdb.com/api.php';
const TRIVIA_API = 'https://the-trivia-api.com/v2/questions';

function mapDifficulty(d) {
  if (d === '하') return 'easy';
  if (d === '상') return 'hard';
  return 'medium';
}

// Open Trivia DB: General Knowledge(category=9). encode=url3986 → decodeURIComponent로 안전 복원.
async function fetchOpenTDB({ difficulty, amount }) {
  const url =
    `${OPENTDB}?amount=${amount}&category=9&type=multiple` +
    `&difficulty=${mapDifficulty(difficulty)}&encode=url3986`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`opentdb ${res.status}`);
  const data = await res.json();
  if (data.response_code !== 0 || !Array.isArray(data.results)) {
    throw new Error(`opentdb code ${data.response_code}`);
  }
  return data.results.map((r) => ({
    question: decodeURIComponent(r.question),
    answer: decodeURIComponent(r.correct_answer),
  }));
}

// The Trivia API v2: general_knowledge 카테고리, 평문 JSON.
async function fetchTriviaApi({ difficulty, amount }) {
  const url =
    `${TRIVIA_API}?limit=${amount}&categories=general_knowledge` +
    `&difficulties=${mapDifficulty(difficulty)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`trivia-api ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('trivia-api shape');
  return data
    .map((r) => ({
      question: typeof r.question === 'string' ? r.question : r.question?.text,
      answer: r.correctAnswer,
    }))
    .filter((r) => r.question && r.answer);
}

// 두 소스를 순차 시도. 모두 실패하면 빈 배열(호출부가 일반 생성으로 폴백).
export async function fetchTrivia({ difficulty, amount = 10 }) {
  try {
    const a = await fetchOpenTDB({ difficulty, amount });
    if (a.length) return a;
  } catch {
    // 다음 소스로
  }
  try {
    const b = await fetchTriviaApi({ difficulty, amount });
    if (b.length) return b;
  } catch {
    // 폴백
  }
  return [];
}
