import Link from "next/link";
import { saveDayAction } from "@/app/actions";
import { AutoDateInput } from "@/components/AutoDateInput";
import { Shell } from "@/components/Shell";
import { formatTimeHm, getTodayIsoDate, isValidIsoDate } from "@/lib/date";
import { ensureActiveProject, getDayByDate, getTodayStatus, normalizeTrainingModes } from "@/lib/domain";

type SearchParams = Record<string, string | string[] | undefined>;

const getParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const today = getTodayIsoDate();
  const requestedDate = getParam(params.date);
  const selectedDate = isValidIsoDate(requestedDate) ? requestedDate : today;

  const [entry, activeProject] = await Promise.all([getDayByDate(selectedDate), ensureActiveProject()]);

  const status = getTodayStatus(entry);
  const deepMinutes = entry?.deep_minutes ?? 0;
  const noiseMinutes = entry?.noise_minutes ?? 0;
  const steps = entry?.steps ?? 0;
  const keyMove = entry?.key_move ?? "";
  const modes = normalizeTrainingModes(entry?.training_modes ?? ["none"]);
  const updatedText = entry?.updated_at ? `Обновлено · ${formatTimeHm(entry.updated_at)}` : "";
  const isPastDate = selectedDate < today;

  const checked = (mode: string) => (modes.includes(mode as never) ? "checked" : "");

  return (
    <Shell active="day">
      <section className="card today-card">
        <div className="today-head">
          <h1>
            День ·
            <AutoDateInput action="/today" value={selectedDate} className="date-link" />
          </h1>
          <span className={`status-dot status-dot-${status}`} aria-label="Статус дня" />
        </div>

        {updatedText ? <p className="save-note">{updatedText}</p> : null}

        {isPastDate ? (
          <div className="past-note">
            <span>Просмотр прошлой даты</span>
            <Link href="/today">Вернуться к сегодняшнему дню</Link>
          </div>
        ) : null}

        <form action={saveDayAction} className="form today-form">
          <input type="hidden" name="date" value={selectedDate} />

          <section className="today-section">
            <h2>Фокус</h2>
            <div className="today-inline">
              <label>
                Минуты глубокой работы
                <input type="number" min={0} max={720} name="deep_minutes" defaultValue={deepMinutes} />
              </label>
              <label>
                Минуты вне фокуса
                <input type="number" min={0} max={720} name="noise_minutes" defaultValue={noiseMinutes} />
              </label>
            </div>
          </section>

          <section className="today-section">
            <h2>Проект</h2>
            <label>
              Активный проект
              <input type="text" readOnly className="readonly-input" value={activeProject.name} />
            </label>
            <label>
              Ключевой шаг дня
              <input type="text" maxLength={120} name="key_move" defaultValue={keyMove} />
            </label>
          </section>

          <section className="today-section">
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
              <input type="number" min={0} max={50000} name="steps" defaultValue={steps} />
            </label>
          </section>

          <button type="submit">Зафиксировать день</button>
        </form>
      </section>
    </Shell>
  );
}
