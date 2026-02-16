import { saveVectorAction } from "@/app/actions";
import { Shell } from "@/components/Shell";
import { ensureVector } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function VectorPage() {
  const vector = await ensureVector();

  return (
    <Shell active="vector">
      <section className="card month-card">
        <h1>Вектор</h1>
        <form action={saveVectorAction} className="form">
          <label>
            Дата старта
            <input type="date" name="start_date" defaultValue={vector.start_date} />
          </label>

          <label>
            Горизонт (мес.)
            <input type="number" min={1} max={24} name="horizon_months" defaultValue={vector.horizon_months} />
          </label>

          <label>
            Целевой доход
            <input type="number" min={0} name="income_target" defaultValue={vector.income_target} />
          </label>

          <label>
            Вес минимум
            <input type="number" step="0.1" min={0} name="weight_min" defaultValue={vector.weight_min} />
          </label>

          <label>
            Вес максимум
            <input type="number" step="0.1" min={0} name="weight_max" defaultValue={vector.weight_max} />
          </label>

          <label>
            Цель проекта
            <input type="text" maxLength={120} name="project_goal" defaultValue={vector.project_goal} />
          </label>

          <label>
            Макс. часов в неделю
            <input type="number" min={1} max={80} name="max_hours_week" defaultValue={vector.max_hours_week} />
          </label>

          <button type="submit">Сохранить вектор</button>
        </form>
      </section>
    </Shell>
  );
}
