import { q } from "@/lib/db";
import { addDays, getMonthRange, getWeekRange, parseISODate, toISODate } from "@/lib/date";
import type { DayProjectEntry, DayRow, IncomeStatusKind, MonthReviewRow, ProjectRow, TrainingType, Trend, VectorRow, WeekRow } from "@/lib/types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundToTwo = (value: number) => Math.round(value * 100) / 100;
const EPSILON = 0.1;

export const normalizeSleepHours = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(numeric)) return null;
  return roundToTwo(clamp(numeric, 0, 24));
};

export const getTrend = (current: number | null, previous: number | null, eps = EPSILON): Trend => {
  if (current === null || previous === null) return "na";
  const delta = current - previous;
  if (Math.abs(delta) <= eps) return "flat";
  return delta > 0 ? "up" : "down";
};

export const normalizeTrainingModes = (value: string[] | string | null | undefined): TrainingType[] => {
  const allowed = new Set<TrainingType>(["none", "light", "strength", "cardio"]);
  const list = (Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((v) => String(v).toLowerCase() as TrainingType)
    .filter((v) => allowed.has(v));
  if (list.includes("none")) return ["none"];
  const deduped = Array.from(new Set(list));
  return deduped.length ? deduped : ["none"];
};

export const getIncomeStatus = (target: number, actual: number | null) => {
  if (actual === null || Number.isNaN(actual)) {
    return { label: "по плану", kind: "track" as IncomeStatusKind, delta: null as number | null };
  }
  const delta = actual - target;
  const ratio = target > 0 ? actual / target : 1;
  if (ratio >= 1.05) return { label: "впереди", kind: "ahead" as IncomeStatusKind, delta };
  if (ratio >= 0.95) return { label: "по плану", kind: "track" as IncomeStatusKind, delta };
  return { label: "отставание", kind: "behind" as IncomeStatusKind, delta };
};

export const getTodayStatus = (entry: DayRow | null) => {
  if (!entry) return "yellow";
  const deepMinutes = entry.deep_minutes || 0;
  const outMinutes = entry.noise_minutes || 0;
  if (deepMinutes >= 90 && outMinutes <= 60) return "green";
  if (outMinutes > deepMinutes && outMinutes >= 90) return "red";
  return "yellow";
};

export const ensureVector = async (): Promise<VectorRow> => {
  const existing = await q<VectorRow>(
    `SELECT
      id,
      start_date::text,
      horizon_months,
      income_target,
      sleep_target_hours::double precision AS sleep_target_hours,
      weight_min::double precision AS weight_min,
      weight_max::double precision AS weight_max,
      project_goal,
      max_hours_week,
      created_at::text,
      updated_at::text
     FROM vector
     WHERE id = 1`
  );
  if (existing.rows[0]) return existing.rows[0];
  await q(
    `INSERT INTO vector
      (id, start_date, horizon_months, income_target, sleep_target_hours, weight_min, weight_max, project_goal, max_hours_week)
     VALUES (1, CURRENT_DATE, 12, 500, NULL, 73, 75, '1 completed commercial product', 35)`
  );
  const created = await q<VectorRow>(
    `SELECT
      id,
      start_date::text,
      horizon_months,
      income_target,
      sleep_target_hours::double precision AS sleep_target_hours,
      weight_min::double precision AS weight_min,
      weight_max::double precision AS weight_max,
      project_goal,
      max_hours_week,
      created_at::text,
      updated_at::text
     FROM vector
     WHERE id = 1`
  );
  return created.rows[0];
};

export const ensureActiveProject = async () => {
  const vector = await ensureVector();
  const active = await q<{ id: number; name: string }>("SELECT id, name FROM projects WHERE is_active = TRUE LIMIT 1");
  if (active.rows[0]) return active.rows[0];
  const inserted = await q<{ id: number; name: string }>(
    "INSERT INTO projects (name, max_hours_week, project_goal, is_active) VALUES ($1, $2, $3, TRUE) RETURNING id, name",
    [vector.project_goal, vector.max_hours_week, vector.project_goal]
  );
  return inserted.rows[0];
};

export const getProjects = async (): Promise<ProjectRow[]> => {
  const result = await q<ProjectRow>(
    `SELECT
      id,
      name,
      max_hours_week,
      project_goal,
      is_active,
      created_at::text,
      updated_at::text
     FROM projects
     ORDER BY updated_at DESC, id DESC`
  );
  return result.rows;
};

export const getDayByDate = async (isoDate: string): Promise<DayRow | null> => {
  const day = await q<
    Omit<DayRow, "training_modes" | "project_entries"> & {
      training_modes: string[];
      project_entries: DayProjectEntry[];
    }
  >(
    `SELECT d.id, d.date::text, d.deep_minutes, d.noise_minutes, d.sleep_hours::double precision AS sleep_hours, d.sleep_quality, d.sleep_note, d.steps, d.key_move, d.created_at::text, d.updated_at::text,
            COALESCE(array_agg(dt.type) FILTER (WHERE dt.type IS NOT NULL), '{}') AS training_modes,
            COALESCE(
              (
                jsonb_agg(
                  DISTINCT jsonb_build_object(
                    'project_id', dp.project_id,
                    'key_move', dp.key_move
                  )
                ) FILTER (WHERE dp.project_id IS NOT NULL)
              )::jsonb,
              '[]'::jsonb
            ) AS project_entries
     FROM days d
     LEFT JOIN day_training dt ON dt.day_id = d.id
     LEFT JOIN day_project dp ON dp.day_id = d.id
     WHERE d.date = $1::date
     GROUP BY d.id`,
    [isoDate]
  );
  const row = day.rows[0];
  if (!row) return null;
  return {
    ...row,
    training_modes: row.training_modes.length ? (row.training_modes as TrainingType[]) : ["none"]
  };
};

export const upsertDay = async (payload: {
  date: string;
  deep_minutes: number;
  noise_minutes: number;
  sleep_hours: number | null;
  sleep_quality: number | null;
  sleep_note: string | null;
  steps: number;
  key_move: string | null;
  project_entries: DayProjectEntry[];
  training_modes: TrainingType[];
}) => {
  const existing = await q<{ id: number }>("SELECT id FROM days WHERE date = $1::date", [payload.date]);
  let dayId: number;
  if (existing.rows[0]) {
    dayId = existing.rows[0].id;
    await q(
      `UPDATE days
       SET deep_minutes = $1, noise_minutes = $2, sleep_hours = $3, sleep_quality = $4, sleep_note = $5, steps = $6, key_move = $7, updated_at = NOW()
       WHERE id = $8`,
      [payload.deep_minutes, payload.noise_minutes, payload.sleep_hours, payload.sleep_quality, payload.sleep_note, payload.steps, payload.key_move, dayId]
    );
  } else {
    const inserted = await q<{ id: number }>(
      `INSERT INTO days (date, deep_minutes, noise_minutes, sleep_hours, sleep_quality, sleep_note, steps, key_move)
       VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [payload.date, payload.deep_minutes, payload.noise_minutes, payload.sleep_hours, payload.sleep_quality, payload.sleep_note, payload.steps, payload.key_move]
    );
    dayId = inserted.rows[0].id;
  }

  await q("DELETE FROM day_training WHERE day_id = $1", [dayId]);
  const modes = payload.training_modes.filter((m) => m !== "none");
  for (const mode of modes) {
    await q("INSERT INTO day_training (day_id, type) VALUES ($1, $2)", [dayId, mode]);
  }

  await q("DELETE FROM day_project WHERE day_id = $1", [dayId]);
  for (const entry of payload.project_entries) {
    await q("INSERT INTO day_project (day_id, project_id, key_move) VALUES ($1, $2, $3)", [dayId, entry.project_id, entry.key_move]);
  }
};

export const getWeekByStart = async (weekStart: string): Promise<WeekRow | null> => {
  const result = await q<WeekRow & { week_start: string; created_at: string; updated_at: string }>(
    `SELECT id, week_start::text, trajectory_quality, note, created_at::text, updated_at::text
     FROM weeks WHERE week_start = $1::date`,
    [weekStart]
  );
  return result.rows[0] || null;
};

export const upsertWeek = async (payload: { week_start: string; trajectory_quality: number | null; note: string | null }) => {
  const existing = await q<{ id: number }>("SELECT id FROM weeks WHERE week_start = $1::date", [payload.week_start]);
  if (existing.rows[0]) {
    await q(
      "UPDATE weeks SET trajectory_quality = $1, note = $2, updated_at = NOW() WHERE id = $3",
      [payload.trajectory_quality, payload.note, existing.rows[0].id]
    );
    return;
  }
  await q(
    "INSERT INTO weeks (week_start, trajectory_quality, note) VALUES ($1::date, $2, $3)",
    [payload.week_start, payload.trajectory_quality, payload.note]
  );
};

export const getRangeDayStats = async (startIso: string, endIso: string) => {
  const result = await q<{
    deep_minutes_total: string;
    noise_minutes_total: string;
    steps_total: string;
    key_moves_count: string;
    trainings_count: string;
    days_count: string;
    sleep_avg: string | null;
    sleep_min: string | null;
    sleep_max: string | null;
    sleep_tracked_days: string;
  }>(
    `SELECT
      COALESCE(SUM(d.deep_minutes), 0)::text AS deep_minutes_total,
      COALESCE(SUM(d.noise_minutes), 0)::text AS noise_minutes_total,
      COALESCE(SUM(d.steps), 0)::text AS steps_total,
      COALESCE(
        SUM(
          CASE
            WHEN EXISTS (SELECT 1 FROM day_project dp0 WHERE dp0.day_id = d.id)
              THEN (
                SELECT COUNT(*)
                FROM day_project dp1
                WHERE dp1.day_id = d.id
                  AND dp1.key_move IS NOT NULL
                  AND btrim(dp1.key_move) <> ''
              )
            ELSE CASE WHEN d.key_move IS NOT NULL AND btrim(d.key_move) <> '' THEN 1 ELSE 0 END
          END
        ),
        0
      )::text AS key_moves_count,
      COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM day_training dt WHERE dt.day_id = d.id) THEN 1 ELSE 0 END), 0)::text AS trainings_count,
      AVG(d.sleep_hours)::text AS sleep_avg,
      MIN(d.sleep_hours)::text AS sleep_min,
      MAX(d.sleep_hours)::text AS sleep_max,
      COUNT(d.sleep_hours)::text AS sleep_tracked_days,
      COUNT(*)::text AS days_count
     FROM days d
     WHERE d.date BETWEEN $1::date AND $2::date`,
    [startIso, endIso]
  );

  const row = result.rows[0];
  const deepMinutes = Number(row?.deep_minutes_total || 0);
  const noiseMinutes = Number(row?.noise_minutes_total || 0);
  const stepsTotal = Number(row?.steps_total || 0);
  const keyMoves = Number(row?.key_moves_count || 0);
  const trainings = Number(row?.trainings_count || 0);
  const daysCount = Number(row?.days_count || 0);
  const sleepTrackedDays = Number(row?.sleep_tracked_days || 0);
  const sleepAvg = row?.sleep_avg === null || row?.sleep_avg === undefined ? null : Number(row.sleep_avg);
  const sleepMin = row?.sleep_min === null || row?.sleep_min === undefined ? null : Number(row.sleep_min);
  const sleepMax = row?.sleep_max === null || row?.sleep_max === undefined ? null : Number(row.sleep_max);

  const tracked = deepMinutes + noiseMinutes;
  const noisePercent = tracked > 0 ? Math.round((noiseMinutes / tracked) * 100) : 0;
  const avgSteps = daysCount > 0 ? Math.round(stepsTotal / daysCount) : 0;
  const speed = deepMinutes / 60 + keyMoves * 2;
  const sleepConsistency = sleepMin !== null && sleepMax !== null ? Number((sleepMax - sleepMin).toFixed(2)) : null;

  return {
    deep_minutes_total: deepMinutes,
    noise_minutes_total: noiseMinutes,
    key_moves_count: keyMoves,
    trainings_count: trainings,
    avg_steps: avgSteps,
    days_count: daysCount,
    noise_percent: noisePercent,
    speed,
    sleep_avg: sleepAvg === null ? null : Number(sleepAvg.toFixed(2)),
    sleep_min: sleepMin,
    sleep_max: sleepMax,
    sleep_tracked_days: sleepTrackedDays,
    sleep_consistency: sleepConsistency
  };
};

export const getWeekDeviationFlags = async (weekStart: string, weekEnd: string) => {
  const [current, vector] = await Promise.all([getRangeDayStats(weekStart, weekEnd), ensureVector()]);
  const prevRange = getWeekRange(toISODate(addDays(parseISODate(weekStart), -1)));
  const prev = await getRangeDayStats(prevRange.start, prevRange.end);

  const flags: string[] = [];
  const softFlags: string[] = [];
  if (current.key_moves_count === 0 && prev.key_moves_count === 0) {
    flags.push("Нет стратегических шагов 2 недели подряд");
  }
  if (current.noise_percent > 30) {
    flags.push("Доля шума > 30% на этой неделе");
  }
  if (current.deep_minutes_total < 360 && prev.deep_minutes_total < 360) {
    flags.push("Глубокая работа < 6 часов 2 недели подряд");
  }

  const sleepTrend = getTrend(current.sleep_avg, prev.sleep_avg);
  const sleepVsTarget =
    current.sleep_avg !== null && vector.sleep_target_hours !== null
      ? Number((current.sleep_avg - Number(vector.sleep_target_hours)).toFixed(2))
      : null;

  if (current.sleep_tracked_days < 4) {
    softFlags.push("сон: мало данных");
  }
  if (sleepVsTarget !== null && sleepVsTarget < -EPSILON) {
    softFlags.push("сон: ниже цели");
  }

  return { flags, softFlags, current, sleepTrend, sleepVsTarget };
};

export const getWeekStatus = (trajectoryQuality: number | null, flagsCount: number) => {
  if (trajectoryQuality === 1 || flagsCount >= 2) return "red";
  if (trajectoryQuality === 2 || flagsCount === 1) return "yellow";
  return "green";
};

export const getMonthWeeks = (monthKey: string) => {
  const range = getMonthRange(monthKey);
  const monthStart = parseISODate(range.start);
  const monthEnd = parseISODate(range.end);
  let cursor = new Date(monthStart);
  cursor.setDate(1);
  let ws = new Date(cursor);
  const day = ws.getDay();
  ws = addDays(ws, day === 0 ? -6 : 1 - day);
  const weeks: { week_start: string; week_end: string }[] = [];
  while (ws <= monthEnd) {
    const weekStart = toISODate(ws);
    const weekEnd = toISODate(addDays(ws, 6));
    weeks.push({ week_start: weekStart, week_end: weekEnd });
    ws = addDays(ws, 7);
  }
  return weeks;
};

const getPreviousMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const prev = new Date(year, month - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
};

export const getSleepTrendVsPrevMonth = async (monthKey: string, currentSleepAvg: number | null): Promise<Trend> => {
  const prevRange = getMonthRange(getPreviousMonthKey(monthKey));
  const prevStats = await getRangeDayStats(prevRange.start, prevRange.end);
  return getTrend(currentSleepAvg, prevStats.sleep_avg);
};

export const getMonthReview = async (monthKey: string): Promise<MonthReviewRow | null> => {
  const review = await q<
    Omit<MonthReviewRow, "week_income"> & {
      created_at: string;
      updated_at: string;
      locked_at: string | null;
    }
  >(
    `SELECT id, month, income_actual, actual_income_done, trajectory_quality, note, is_locked, locked_at::text, created_at::text, updated_at::text
     FROM month_reviews WHERE month = $1`,
    [monthKey]
  );
  const row = review.rows[0];
  if (!row) return null;
  const weekIncomeRows = await q<{ week_start: string; income: number }>(
    "SELECT week_start::text, income FROM month_week_income WHERE month_review_id = $1",
    [row.id]
  );
  const week_income = Object.fromEntries(weekIncomeRows.rows.map((r) => [r.week_start, r.income]));
  return { ...row, week_income };
};

export const upsertMonthReview = async (payload: {
  month: string;
  income_actual: number | null;
  actual_income_done: boolean;
  trajectory_quality: number | null;
  note: string | null;
  week_income: Record<string, number>;
  lock: boolean;
}) => {
  const existing = await q<{ id: number; is_locked: boolean }>("SELECT id, is_locked FROM month_reviews WHERE month = $1", [payload.month]);
  if (existing.rows[0]?.is_locked) return;

  let monthReviewId: number;
  if (existing.rows[0]) {
    monthReviewId = existing.rows[0].id;
    await q(
      `UPDATE month_reviews
       SET income_actual = $1, actual_income_done = $2, trajectory_quality = $3, note = $4,
           is_locked = CASE WHEN $5 THEN TRUE ELSE is_locked END,
           locked_at = CASE WHEN $5 THEN NOW() ELSE locked_at END,
           updated_at = NOW()
       WHERE id = $6`,
      [payload.income_actual, payload.actual_income_done, payload.trajectory_quality, payload.note, payload.lock, monthReviewId]
    );
    await q("DELETE FROM month_week_income WHERE month_review_id = $1", [monthReviewId]);
  } else {
    const inserted = await q<{ id: number }>(
      `INSERT INTO month_reviews (month, income_actual, actual_income_done, trajectory_quality, note, is_locked, locked_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 THEN NOW() ELSE NULL END)
       RETURNING id`,
      [payload.month, payload.income_actual, payload.actual_income_done, payload.trajectory_quality, payload.note, payload.lock]
    );
    monthReviewId = inserted.rows[0].id;
  }

  for (const [weekStart, income] of Object.entries(payload.week_income)) {
    await q(
      "INSERT INTO month_week_income (month_review_id, week_start, income) VALUES ($1, $2::date, $3)",
      [monthReviewId, weekStart, income]
    );
  }
};

export const updateVector = async (payload: {
  start_date: string;
  horizon_months: number;
  income_target: number;
  sleep_target_hours: number | null;
  weight_min: number;
  weight_max: number;
  project_goal: string;
  max_hours_week: number;
}) => {
  await ensureVector();
  await q(
    `UPDATE vector
     SET start_date = COALESCE(NULLIF($1, '')::date, CURRENT_DATE),
         horizon_months = $2,
         income_target = $3,
         sleep_target_hours = $4,
         weight_min = $5,
         weight_max = $6,
         project_goal = $7,
         max_hours_week = $8,
         updated_at = NOW()
     WHERE id = 1`,
    [
      payload.start_date,
      payload.horizon_months,
      payload.income_target,
      payload.sleep_target_hours,
      payload.weight_min,
      payload.weight_max,
      payload.project_goal,
      payload.max_hours_week
    ]
  );

};

export const addOrActivateProject = async (payload: { name: string; max_hours_week: number; project_goal: string | null }) => {
  const name = payload.name.trim();
  const maxHours = Number.isFinite(payload.max_hours_week) ? Math.max(0, Math.trunc(payload.max_hours_week)) : 0;
  const goal = payload.project_goal?.trim() || null;
  if (!name) return;

  await q("UPDATE projects SET is_active = FALSE, updated_at = NOW() WHERE is_active = TRUE");

  const existing = await q<{ id: number }>("SELECT id FROM projects WHERE lower(name) = lower($1) LIMIT 1", [name]);
  if (existing.rows[0]) {
    await q("UPDATE projects SET is_active = TRUE, max_hours_week = $1, project_goal = $2, updated_at = NOW() WHERE id = $3", [maxHours, goal, existing.rows[0].id]);
    return;
  }

  await q("INSERT INTO projects (name, max_hours_week, project_goal, is_active) VALUES ($1, $2, $3, TRUE)", [name, maxHours, goal]);
};

export const updateProject = async (payload: { id: number; name: string; max_hours_week: number; project_goal: string | null }) => {
  const name = payload.name.trim();
  const maxHours = Number.isFinite(payload.max_hours_week) ? Math.max(0, Math.trunc(payload.max_hours_week)) : 0;
  const goal = payload.project_goal?.trim() || null;
  if (!name || !Number.isFinite(payload.id)) return;
  await q("UPDATE projects SET name = $1, max_hours_week = $2, project_goal = $3, updated_at = NOW() WHERE id = $4", [
    name,
    maxHours,
    goal,
    payload.id
  ]);
};

export const getNotesForDate = async (isoDate: string) => {
  const result = await q<{ id: number; text: string; done: boolean; note_date: string }>(
    `SELECT id, text, done, note_date::text
     FROM note_items
     WHERE note_date = $1::date
     ORDER BY id ASC`,
    [isoDate]
  );
  return result.rows;
};

export const getNotesArchive = async (todayIso: string, limit = 100) => {
  const result = await q<{ id: number; text: string; done: boolean; note_date: string }>(
    `SELECT id, text, done, note_date::text
     FROM note_items
     WHERE note_date < $1::date
     ORDER BY note_date DESC, id DESC
     LIMIT $2`,
    [todayIso, limit]
  );
  return result.rows;
};

export const addNoteItem = async (payload: { note_date: string; text: string }) => {
  const text = payload.text.trim();
  if (!text) return;
  await q("INSERT INTO note_items (note_date, text, done) VALUES ($1::date, $2, FALSE)", [payload.note_date, text]);
};

export const setNoteDone = async (payload: { id: number; done: boolean; note_date: string }) => {
  await q(
    `UPDATE note_items
     SET done = $1, updated_at = NOW()
     WHERE id = $2 AND note_date = $3::date`,
    [payload.done, payload.id, payload.note_date]
  );
};
