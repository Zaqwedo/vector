import { saveMonthAction } from "@/app/actions";
import { Shell } from "@/components/Shell";
import { formatTimeHm, getMonthKey, getMonthLabel, getMonthRange } from "@/lib/date";
import { ensureVector, getIncomeStatus, getMonthReview, getMonthWeeks, getRangeDayStats } from "@/lib/domain";

type SearchParams = Record<string, string | string[] | undefined>;
const getParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const dynamic = "force-dynamic";

export default async function MonthPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const month = (getParam(params.month) || getMonthKey()).slice(0, 7);
  const saved = getParam(params.saved) === "1";

  const [vector, review] = await Promise.all([ensureVector(), getMonthReview(month)]);
  const monthRange = getMonthRange(month);
  const monthStats = await getRangeDayStats(monthRange.start, monthRange.end);
  const weeks = getMonthWeeks(month);

  const income = getIncomeStatus(vector.income_target, review?.income_actual ?? null);
  const avgDeepPerWeek = weeks.length ? Math.round(monthStats.deep_minutes_total / weeks.length) : 0;
  const showLocked = Boolean(review?.is_locked && review.locked_at);

  return (
    <Shell active="month">
      <section className="card month-card">
        <div className="month-head">
          <h1>Месяц · {getMonthLabel(month)}</h1>
          <span className={`month-status month-status-${income.kind}`}>{income.label}</span>
        </div>

        {showLocked && (saved || review?.is_locked) ? <p className="save-note">Зафиксировано · {formatTimeHm(review?.locked_at ?? null)}</p> : null}

        <form action={saveMonthAction} className="form month-form">
          <input type="hidden" name="month" value={month} />

          <section className="month-panel">
            <h2>Общий итог</h2>
            <div className="month-summary-grid">
              <div>
                <h3>Деньги</h3>
                <label>
                  Цель
                  <input type="number" value={vector.income_target} readOnly className="readonly-input" />
                </label>
                <label>
                  Факт
                  <div className="month-input-row">
                    <input type="number" min={0} name="income_actual" defaultValue={review?.income_actual ?? ""} readOnly={review?.is_locked} />
                    <label className="check-pill">
                      <input type="checkbox" name="actual_income_done" value="1" defaultChecked={Boolean(review?.actual_income_done)} disabled={review?.is_locked} />
                      <span>Ввёл</span>
                    </label>
                  </div>
                </label>
                <p className="month-meta">Дельта: {income.delta === null ? "—" : income.delta > 0 ? `+${income.delta}` : income.delta}</p>
              </div>

              <div>
                <h3>Фокус</h3>
                <p className="month-meta">
                  Глубокая работа (мин): <strong>{monthStats.deep_minutes_total}</strong>
                </p>
                <p className="month-meta">
                  Среднее в неделю (мин): <strong>{avgDeepPerWeek}</strong>
                </p>
                <p className="month-meta">
                  Шум %: <strong>{monthStats.noise_percent}%</strong>
                </p>
              </div>

              <div>
                <h3>Тело</h3>
                <p className="month-meta">
                  Тренировок всего: <strong>{monthStats.trainings_count}</strong>
                </p>
                <p className="month-meta">
                  Средние шаги: <strong>{monthStats.avg_steps}</strong>
                </p>
              </div>

              <div>
                <h3>Качество</h3>
                <label>Оценка траектории</label>
                <div className="score-row">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label className="score-pill" key={n}>
                      <input
                        type="radio"
                        name="trajectory_quality"
                        value={n}
                        defaultChecked={review?.trajectory_quality === n}
                        disabled={review?.is_locked}
                      />
                      <span>{n}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <label>
              Что скорректировать в следующем месяце?
              <input type="text" name="note" maxLength={140} defaultValue={review?.note ?? ""} readOnly={review?.is_locked} />
            </label>
          </section>

          <section className="month-panel">
            <h2>По неделям</h2>
            <div className="week-stack">
              {await Promise.all(
                weeks.map(async (w, index) => {
                  const rangeStart = w.week_start < monthRange.start ? monthRange.start : w.week_start;
                  const rangeEnd = w.week_end > monthRange.end ? monthRange.end : w.week_end;
                  const stats = await getRangeDayStats(rangeStart, rangeEnd);
                  return (
                    <article className="week-block" key={`${w.week_start}-${w.week_end}`}>
                      <h3>
                        Неделя {index + 1} · {rangeStart} — {rangeEnd}
                      </h3>
                      <div className="week-grid">
                        <div>
                          <span>Минуты глубокой работы</span>
                          <strong>{stats.deep_minutes_total}</strong>
                        </div>
                        <div>
                          <span>Ключевые шаги</span>
                          <strong>{stats.key_moves_count}</strong>
                        </div>
                        <div>
                          <span>Тренировки</span>
                          <strong>{stats.trainings_count}</strong>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          {review?.is_locked ? (
            <button type="submit" disabled>
              Месяц зафиксирован
            </button>
          ) : (
            <div className="month-actions">
              <button type="submit" name="action" value="save">
                Сохранить месяц
              </button>
              <button type="submit" name="action" value="lock">
                Зафиксировать месяц
              </button>
            </div>
          )}
        </form>
      </section>
    </Shell>
  );
}
