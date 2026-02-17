export default function Loading() {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <div className="loading-core">
        <div className="loading-mark" aria-hidden="true">
          <span className="loading-compass-ring" />
          <span className="loading-compass-tick loading-compass-tick-n" />
          <span className="loading-compass-tick loading-compass-tick-e" />
          <span className="loading-compass-tick loading-compass-tick-s" />
          <span className="loading-compass-tick loading-compass-tick-w" />
          <span className="loading-compass-letter">N</span>
          <span className="loading-compass-needle">
            <span className="loading-compass-needle-top" />
            <span className="loading-compass-needle-bottom" />
          </span>
          <span className="loading-compass-center" />
        </div>
        <p className="loading-title">Придерживайся своего вектора</p>
        <p className="loading-subtitle">Загрузка данных</p>
        <div className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="loading-meta">Vector OS</p>
      </div>
    </main>
  );
}
