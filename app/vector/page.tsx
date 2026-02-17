import { addProjectAction, saveVectorAction, updateProjectAction } from "@/app/actions";
import { WeightRange } from "@/components/WeightRange";
import { Shell } from "@/components/Shell";
import { ensureVector, getProjects } from "@/lib/domain";

export const dynamic = "force-dynamic";

const splitSleepHours = (hoursValue: number | string | null | undefined) => {
  if (hoursValue === null || hoursValue === undefined || hoursValue === "") return { hours: "", minutes: "" };
  const numeric = Number(hoursValue);
  if (!Number.isFinite(numeric)) return { hours: "", minutes: "" };
  const total = Math.max(0, Math.round(numeric * 60));
  return { hours: String(Math.floor(total / 60)), minutes: String(total % 60) };
};
const toDateInputValue = (value: string | Date) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};
const formatIntWithSpaces = (value: number) => new Intl.NumberFormat("ru-RU").format(Math.trunc(value));

type SearchParams = Record<string, string | string[] | undefined>;
const getParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function VectorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const savedProject = Number(getParam(params.saved_project) || 0);
  const projectAdded = getParam(params.project_added) === "1";
  const [vector, projects] = await Promise.all([ensureVector(), getProjects()]);
  const sleepTarget = splitSleepHours(vector.sleep_target_hours);

  return (
    <Shell active="vector">
      <section className="card month-card">
        <h1>Вектор</h1>
        <form action={saveVectorAction} className="form vector-top-form">
          <section className="today-block vector-block">
            <h2>База</h2>
            <label>
              Дата старта
              <input type="date" name="start_date" defaultValue={toDateInputValue(vector.start_date)} />
            </label>

            <label>
              Горизонт (мес.)
              <input type="number" min={1} max={24} name="horizon_months" defaultValue={vector.horizon_months} />
            </label>

            <label>
              Целевой доход
              <input type="text" inputMode="numeric" name="income_target" defaultValue={formatIntWithSpaces(vector.income_target)} />
            </label>
            <input type="hidden" name="project_goal" value={vector.project_goal} />
            <input type="hidden" name="max_hours_week" value={vector.max_hours_week} />
          </section>

          <section className="today-block vector-block">
            <h2>Сон и вес</h2>
            <label>
              Цель сна (часы)
              <div className="duration-pair duration-pair-compact">
                <input type="number" min={0} max={24} name="sleep_target_hours_part" defaultValue={sleepTarget.hours} placeholder="ч" />
                <input
                  type="number"
                  min={0}
                  max={59}
                  name="sleep_target_minutes_part"
                  defaultValue={sleepTarget.minutes}
                  placeholder="м"
                />
              </div>
            </label>

            <WeightRange minInitial={vector.weight_min} maxInitial={vector.weight_max} />
          </section>
          <button type="submit" className="btn-compact">
            Зафиксировать
          </button>
        </form>

        <section className="today-block vector-block">
          <h2>Проекты</h2>

          <div className="project-stack">
            {projects.map((project) => (
              <details className="project-card" key={project.id} open={savedProject === project.id}>
                <summary>
                  <div className="project-card-head">
                    <strong>{project.name}</strong>
                    <span>{project.max_hours_week} ч/нед</span>
                  </div>
                  <span className="project-edit-btn">Редактировать</span>
                </summary>

                <form action={updateProjectAction} className="form project-edit-form">
                  <input type="hidden" name="project_id" value={project.id} />
                  <label>
                    Название
                    <input type="text" name="project_name" maxLength={120} defaultValue={project.name} />
                  </label>
                  <label>
                    Часов в неделю
                    <input type="number" min={0} max={120} name="project_hours" defaultValue={project.max_hours_week} />
                  </label>
                  <label>
                    Цель
                    <textarea name="project_goal" maxLength={400} rows={2} defaultValue={project.project_goal ?? ""} />
                  </label>
                  <button type="submit" className="btn-compact">
                    Сохранить изменения
                  </button>
                  {savedProject === project.id ? <p className="save-note">Сохранено</p> : null}
                </form>
              </details>
            ))}
          </div>

          <form action={addProjectAction} className="form vector-project-create">
            <div className="vector-project-add-form">
              <label>
                Название нового проекта
                <input type="text" name="new_project_name" maxLength={120} />
              </label>
              <label>
                Часов
                <input type="number" min={0} max={120} name="new_project_hours" />
              </label>
              <label>
                Цель
                <textarea name="new_project_goal" maxLength={400} rows={2} />
              </label>
            </div>
            <button type="submit" className="btn-compact">
              Добавить новый проект
            </button>
            {projectAdded ? <p className="save-note">Сохранено</p> : null}
          </form>
        </section>
      </section>
    </Shell>
  );
}
