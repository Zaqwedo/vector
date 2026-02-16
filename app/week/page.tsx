import { saveWeekAction } from "@/app/actions";
import { AutoDateInput } from "@/components/AutoDateInput";
import { Shell } from "@/components/Shell";
import { getTodayIsoDate, getWeekRange, isValidIsoDate } from "@/lib/date";
import { getWeekByStart, getWeekDeviationFlags, getWeekStatus } from "@/lib/domain";

type SearchParams = Record<string, string | string[] | undefined>;
const getParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const dynamic = "force-dynamic";

export default async function WeekPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const today = getTodayIsoDate();
  const requestedDate = getParam(params.date);
  const selectedDate = isValidIsoDate(requestedDate) ? requestedDate : today;
  const range = getWeekRange(selectedDate);

  const [weekRow, deviation] = await Promise.all([getWeekByStart(range.start), getWeekDeviationFlags(range.start, range.end)]);

  const status = getWeekStatus(weekRow?.trajectory_quality ?? null, deviation.flags.length);

  return (
    <Shell active="week">
      <section className="card week-card">
        <div className="today-head">
          <h1>
            Неделя ·
            <AutoDateInput action="/week" value={selectedDate} className="date-link week-date-link" />
          </h1>
        </div>
        <p className="sub">
          {range.start} → {range.end}
        </p>

        <div className="stats">
          <div>
            <span>Глубокая работа</span>
            <strong>{(deviation.current.deep_minutes_total / 60).toFixed(2)}</strong>
          </div>
          <div>
            <span>Стратегические шаги</span>
            <strong>{deviation.current.key_moves_count}</strong>
          </div>
          <div>
            <span>Тренировки</span>
            <strong>{deviation.current.trainings_count}</strong>
          </div>
          <div>
            <span>Средние шаги</span>
            <strong>{deviation.current.avg_steps}</strong>
          </div>
          <div>
            <span>Шум %</span>
            <strong>{deviation.current.noise_percent}%</strong>
          </div>
          <div>
            <span>Скорость</span>
            <strong>{deviation.current.speed.toFixed(2)}</strong>
          </div>
        </div>

        <div className="status-wrap">
          <div className={`status status-${status}`}>{status === "red" ? "КРАСНЫЙ" : status === "yellow" ? "ЖЁЛТЫЙ" : "ЗЕЛЁНЫЙ"}</div>
          <ul className="flags">
            {deviation.flags.length ? deviation.flags.map((f) => <li key={f}>{f}</li>) : <li>Отклонений не обнаружено</li>}
          </ul>
        </div>

        <form action={saveWeekAction} className="form">
          <input type="hidden" name="week_start" value={range.start} />
          <input type="hidden" name="date" value={selectedDate} />

          <label>Качество траектории</label>
          <div className="score-row">
            {[1, 2, 3, 4, 5].map((n) => (
              <label className="score-pill" key={n}>
                <input type="radio" name="trajectory_quality" value={n} defaultChecked={weekRow?.trajectory_quality === n} />
                <span>{n}</span>
              </label>
            ))}
          </div>

          <label>
            Заметка недели
            <textarea name="note" maxLength={200} rows={3} defaultValue={weekRow?.note ?? ""} />
          </label>

          <button type="submit">Сохранить неделю</button>
        </form>
      </section>
    </Shell>
  );
}
