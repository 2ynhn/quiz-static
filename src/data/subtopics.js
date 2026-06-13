// A-2 세부주제 로테이션 — 카테고리별 하위 주제. 매 배치마다 1~2개를 랜덤 지정해 소재 수렴을 깬다.
// 자유 입력(여기 없는) 카테고리는 세부주제 없이 다양성 시드만 사용한다.
export const SUBTOPICS = {
  한국사: ['삼국시대', '통일신라·발해', '고려', '조선전기', '조선후기', '근대', '현대', '인물', '문화재', '사건·전쟁'],
  세계사: ['고대문명', '그리스·로마', '중세', '르네상스', '근대', '세계대전', '현대', '인물', '사건', '문화·예술'],
  일반상식: ['생활', '지리', '스포츠', '언어', '법·제도', '경제', '미디어', '음식', '동식물', '우주'],
  사자성어: ['교훈·처세', '인간관계', '노력·인내', '자연·계절', '전쟁·갈등', '감정', '어리석음·경계', '유래있는 고사'],
  과학: ['물리', '화학', '생물', '지구과학', '천문', '기술·공학', '의학', '발명·발견'],
  수학: ['수와 연산', '도형·기하', '대수', '확률·통계', '수학사', '퍼즐·논리'],
  음악: ['클래식', '대중음악', '악기', '음악이론', '음악사', 'K-pop', '세계음악'],
  금융: ['저축·예금', '투자·주식', '세금', '연금·노후', '경제용어', '화폐·환율', '신용·대출'],
};

// A-2 관점 로테이션 — 매 배치마다 1개 랜덤 지정
export const PERSPECTIVES = ['인물 중심', '사건·연도 중심', '용어·개념 중심', '장소·유물 중심'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 매 배치 호출용 다양성 축 생성: 시드 + 세부주제 1~2개 + 관점 1개
export function makeDiversityAxes(category) {
  const seed = 1 + Math.floor(Math.random() * 9999);
  const pool = SUBTOPICS[category];
  let subtopics = [];
  if (pool && pool.length > 0) {
    const first = pick(pool);
    subtopics = [first];
    if (Math.random() < 0.5) {
      const second = pick(pool.filter((s) => s !== first));
      if (second) subtopics.push(second);
    }
  }
  return { seed, subtopics, perspective: pick(PERSPECTIVES) };
}
