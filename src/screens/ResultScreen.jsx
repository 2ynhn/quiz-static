export default function ResultScreen({ result, onHome }) {
  const { mode, category, totalQuestions, teams } = result;
  const sorted = [...teams].sort((a, b) => b.correct - a.correct);
  const rate = (t) => (t.attempted === 0 ? 0 : Math.round((t.correct / t.attempted) * 100));

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="title">결과</h1>
      </header>

      <p className="result-summary">
        {category} · 총 <strong>{totalQuestions}</strong>문제
      </p>

      <section className="section">
        {sorted.map((t, i) => (
          <div key={t.name} className="result-row">
            <span className="result-row__rank">
              {mode === 'team' ? (i === 0 && t.correct > 0 ? '🏆' : `${i + 1}위`) : '🙂'}
            </span>
            <span className="result-row__name">{t.name}</span>
            <span className="result-row__score">
              {t.correct}/{t.attempted} 정답 · 정답률 {rate(t)}%
            </span>
          </div>
        ))}
      </section>

      <button type="button" className="btn btn--primary btn--big" onClick={onHome}>
        처음으로
      </button>
    </div>
  );
}
