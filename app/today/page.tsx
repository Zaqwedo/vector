import Link from "next/link";
import { saveDayAction } from "@/app/actions";
import { AutoDateInput } from "@/components/AutoDateInput";
import { Shell } from "@/components/Shell";
import { formatTimeHm, getTodayIsoDate, isValidIsoDate } from "@/lib/date";
import { ensureActiveProject, getDayByDate, getProjects, getTodayStatus, normalizeTrainingModes } from "@/lib/domain";

type SearchParams = Record<string, string | string[] | undefined>;

const getParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const toNumberSafe = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};
const toTimeValue = (totalMinutes: number | string | null | undefined) => {
  const value = Math.max(0, Math.trunc(toNumberSafe(totalMinutes)));
  const h = String(Math.floor(value / 60)).padStart(2, "0");
  const m = String(value % 60).padStart(2, "0");
  return `${h}:${m}`;
};
const sleepHoursToTimeValue = (hoursValue: number | string | null | undefined) => {
  if (hoursValue === null || hoursValue === undefined || hoursValue === "") return "";
  const numeric = Number(hoursValue);
  if (!Number.isFinite(numeric)) return "";
  const total = Math.max(0, Math.round(numeric * 60));
  return toTimeValue(total);
};

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const today = getTodayIsoDate();
  const requestedDate = getParam(params.date);
  const selectedDate = requestedDate && isValidIsoDate(requestedDate) ? requestedDate : today;

  await ensureActiveProject();
  const [entry, projects] = await Promise.all([getDayByDate(selectedDate), getProjects()]);

  const status = getTodayStatus(entry);
  const deepMinutes = entry?.deep_minutes ?? 0;
  const noiseMinutes = entry?.noise_minutes ?? 0;
  const sleepHours = entry?.sleep_hours ?? null;
  const sleepQuality = entry?.sleep_quality ?? null;
  const sleepNote = entry?.sleep_note ?? "";
  const steps = entry?.steps ?? 0;
  const modes = normalizeTrainingModes(entry?.training_modes ?? ["none"]);
  const updatedText = entry?.updated_at ? `Обновлено · ${formatTimeHm(entry.updated_at)}` : "";
  const isPastDate = selectedDate < today;
  const deepTimeValue = toTimeValue(deepMinutes);
  const noiseTimeValue = toTimeValue(noiseMinutes);
  const sleepTimeValue = sleepHoursToTimeValue(sleepHours);
  const selectedProjectIds = new Set((entry?.project_entries ?? []).map((e) => e.project_id));
  const projectMoveMap = new Map((entry?.project_entries ?? []).map((e) => [e.project_id, e.key_move ?? ""]));
  const statusText = status === "green" ? "Зелёный: день в фокусе" : status === "red" ? "Красный: много шума" : "Жёлтый: нейтрально";

  const checked = (mode: string) => (modes.includes(mode as never) ? "checked" : "");

  return (
    <Shell active="day">
      <section className="card today-card">
        <section className="today-block">
          <div className="today-head">
            <h1>
              День ·
              <AutoDateInput action="/today" value={selectedDate} className="date-link" />
            </h1>
            <div className="status-inline">
              <span className={`status-dot status-dot-${status}`} aria-label="Статус дня" />
              <span className="status-caption">{statusText}</span>
            </div>
          </div>
          {updatedText ? <p className="save-note">{updatedText}</p> : null}
          {isPastDate ? (
            <div className="past-note">
              <span>Просмотр прошлой даты</span>
              <Link href="/today">Вернуться к сегодняшнему дню</Link>
            </div>
          ) : null}
        </section>

        <form action={saveDayAction} className="form today-form">
          <input type="hidden" name="date" value={selectedDate} />

          <section className="today-block today-section">
            <h2>Сон</h2>
            <div className="today-inline">
              <label>
                Часы сна
                <input type="time" name="sleep_time" step={60} defaultValue={sleepTimeValue} />
              </label>
              <label>
                Заметка
                <input type="text" maxLength={120} name="sleep_note" defaultValue={sleepNote} />
              </label>
            </div>
            <label>Качество сна</label>
            <div className="score-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <label className="score-pill" key={n}>
                  <input type="radio" name="sleep_quality" value={n} defaultChecked={sleepQuality === n} />
                  <span>{n}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="today-block today-section">
            <h2>Тело</h2>
            <div className="segmented-row" role="group" aria-label="Тип тренировки">
              <label className="segment">
                <input type="checkbox" name="training_modes" value="none" defaultChecked={checked("none") === "checked"} />
                <span>Нет</span>
              </label>
              <label className="segment">
                <input type="checkbox" name="training_modes" value="light" defaultChecked={checked("light") === "checked"} />
                <span>Лёгкая</span>
              </label>
              <label className="segment">
                <input
                  type="checkbox"
                  name="training_modes"
                  value="strength"
                  defaultChecked={checked("strength") === "checked"}
                />
                <span>Силовая</span>
              </label>
              <label className="segment">
                <input type="checkbox" name="training_modes" value="cardio" defaultChecked={checked("cardio") === "checked"} />
                <span>Кардио</span>
              </label>
            </div>

            <label>
              Шаги
              <input type="text" inputMode="numeric" maxLength={7} name="steps" defaultValue={steps} />
            </label>
          </section>

          <section className="today-block today-section">
            <h2>Проекты</h2>
            <div className="project-select-list">
              {projects.map((project) => (
                <div className="project-select-item" key={project.id}>
                  <label className="project-check">
                    <input type="checkbox" name="project_ids" value={project.id} defaultChecked={selectedProjectIds.has(project.id)} />
                    <span>{project.name}</span>
                  </label>
                  <textarea
                    className="project-step-input"
                    name={`key_move_${project.id}`}
                    maxLength={500}
                    rows={2}
                    placeholder="Ключевой шаг по проекту"
                    defaultValue={projectMoveMap.get(project.id) ?? ""}
                  />
                </div>
              ))}
            </div>
            <div className="today-inline">
              <label>
                Глубокая работа
                <input type="time" name="deep_time" step={60} defaultValue={deepTimeValue} />
              </label>
              <label>
                Вне фокуса
                <input type="time" name="noise_time" step={60} defaultValue={noiseTimeValue} />
              </label>
            </div>
          </section>

          <button type="submit">Зафиксировать день</button>
        </form>
      </section>
    </Shell>
  );
}
