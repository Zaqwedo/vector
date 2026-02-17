"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTodayIsoDate, isValidIsoDate } from "@/lib/date";
import {
  addNoteItem,
  addOrActivateProject,
  normalizeSleepHours,
  normalizeTrainingModes,
  setNoteDone,
  updateProject,
  upsertDay,
  upsertMonthReview,
  upsertWeek,
  updateVector
} from "@/lib/domain";

const pick = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const toInt = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const parseDurationMinutes = (hoursRaw: string, minutesRaw: string, maxMinutes = 24 * 60) => {
  const hours = clamp(toInt(hoursRaw), 0, 99);
  const minutes = clamp(toInt(minutesRaw), 0, 59);
  return clamp(hours * 60 + minutes, 0, maxMinutes);
};
const parseSleepHoursFromParts = (hoursRaw: string, minutesRaw: string): number | null => {
  if (!hoursRaw.trim() && !minutesRaw.trim()) return null;
  const totalMinutes = parseDurationMinutes(hoursRaw, minutesRaw, 24 * 60);
  return normalizeSleepHours(totalMinutes / 60);
};
const parseSleepQuality = (value: string): number | null => {
  if (!value.trim()) return null;
  const n = clamp(toInt(value), 1, 5);
  return n;
};
const parseTimeToMinutes = (value: string): number | null => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = clamp(Number(match[1]), 0, 24);
  const m = clamp(Number(match[2]), 0, 59);
  return clamp(h * 60 + m, 0, 24 * 60);
};
const parseSteps = (value: string) => {
  const digitsOnly = value.replace(/[^\d]/g, "").slice(0, 7);
  const n = Number(digitsOnly || "0");
  return Number.isFinite(n) ? clamp(n, 0, 9_999_999) : 0;
};
const parseFloatSafe = (value: string, fallback = 0) => {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};
const clampWeight = (value: number) => clamp(value, 30, 150);
const parseMoney = (value: string) => {
  const cleaned = value.replace(/\s+/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};

export async function saveDayAction(formData: FormData) {
  const dateRaw = pick(formData.get("date"));
  const date = isValidIsoDate(dateRaw) ? dateRaw : getTodayIsoDate();
  const deepFromTime = parseTimeToMinutes(pick(formData.get("deep_time")));
  const noiseFromTime = parseTimeToMinutes(pick(formData.get("noise_time")));
  const sleepFromTime = parseTimeToMinutes(pick(formData.get("sleep_time")));
  const deep = deepFromTime ?? parseDurationMinutes(pick(formData.get("deep_hours")), pick(formData.get("deep_minutes_part")), 24 * 60);
  const noise = noiseFromTime ?? parseDurationMinutes(pick(formData.get("noise_hours")), pick(formData.get("noise_minutes_part")), 24 * 60);
  const sleepHours =
    (sleepFromTime !== null ? normalizeSleepHours(sleepFromTime / 60) : null) ??
    parseSleepHoursFromParts(pick(formData.get("sleep_hours_part")), pick(formData.get("sleep_minutes_part"))) ??
    normalizeSleepHours(pick(formData.get("sleep_hours")));
  const sleepQuality = parseSleepQuality(pick(formData.get("sleep_quality")));
  const sleepNote = pick(formData.get("sleep_note")).trim() || null;
  const steps = parseSteps(pick(formData.get("steps")));
  const selectedProjectIds = formData
    .getAll("project_ids")
    .map((v) => Number(typeof v === "string" ? v : "0"))
    .filter((v) => Number.isInteger(v) && v > 0);
  const projectEntries = selectedProjectIds.map((projectId) => {
    const keyMoveValue = pick(formData.get(`key_move_${projectId}`)).trim() || null;
    return { project_id: projectId, key_move: keyMoveValue };
  });
  const keyMove = projectEntries.find((e) => e.key_move)?.key_move ?? null;
  const trainingModes = normalizeTrainingModes(formData.getAll("training_modes") as string[]);

  await upsertDay({
    date,
    deep_minutes: deep,
    noise_minutes: noise,
    sleep_hours: sleepHours,
    sleep_quality: sleepQuality,
    sleep_note: sleepNote,
    steps,
    key_move: keyMove,
    project_entries: projectEntries,
    training_modes: trainingModes
  });

  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/month");
  redirect(`/today?date=${date}`);
}

export async function saveWeekAction(formData: FormData) {
  const weekStart = pick(formData.get("week_start"));
  const selectedDateRaw = pick(formData.get("date"));
  const selectedDate = isValidIsoDate(selectedDateRaw) ? selectedDateRaw : getTodayIsoDate();
  const trajectory = pick(formData.get("trajectory_quality"));
  const note = pick(formData.get("note")).trim() || null;

  await upsertWeek({
    week_start: weekStart,
    trajectory_quality: trajectory ? Number(trajectory) : null,
    note
  });

  revalidatePath("/week");
  revalidatePath("/month");
  redirect(`/week?date=${selectedDate}`);
}

export async function saveMonthAction(formData: FormData) {
  const month = pick(formData.get("month"));
  const action = pick(formData.get("action"));
  const incomeActual = pick(formData.get("income_actual"));
  const incomeDone = pick(formData.get("actual_income_done")) === "1";
  const trajectory = pick(formData.get("trajectory_quality"));
  const note = pick(formData.get("note")).trim() || null;

  const weekIncome: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("week_income_")) continue;
    const raw = typeof value === "string" ? value : "";
    if (!raw) continue;
    const weekStart = key.replace("week_income_", "");
    weekIncome[weekStart] = Number(raw);
  }

  await upsertMonthReview({
    month,
    income_actual: incomeActual ? Number(incomeActual) : null,
    actual_income_done: incomeDone,
    trajectory_quality: trajectory ? Number(trajectory) : null,
    note,
    week_income: weekIncome,
    lock: action === "lock"
  });

  revalidatePath("/month");
  redirect(`/month?month=${month}&saved=1`);
}

export async function saveVectorAction(formData: FormData) {
  const startDateRaw = pick(formData.get("start_date"));
  const startDate = isValidIsoDate(startDateRaw) ? startDateRaw : getTodayIsoDate();
  const weightMinInput = pick(formData.get("weight_min"));
  const weightMaxInput = pick(formData.get("weight_max"));
  const weightMinSlider = pick(formData.get("weight_min_slider"));
  const weightMaxSlider = pick(formData.get("weight_max_slider"));
  const weightMinCandidate = clampWeight(parseFloatSafe(weightMinInput || weightMinSlider, 30));
  const weightMaxCandidate = clampWeight(parseFloatSafe(weightMaxInput || weightMaxSlider, 150));
  const weightMin = Math.min(weightMinCandidate, weightMaxCandidate);
  const weightMax = Math.max(weightMinCandidate, weightMaxCandidate);

  await updateVector({
    start_date: startDate,
    horizon_months: Number(pick(formData.get("horizon_months")) || 12),
    income_target: parseMoney(pick(formData.get("income_target"))),
    sleep_target_hours:
      parseSleepHoursFromParts(pick(formData.get("sleep_target_hours_part")), pick(formData.get("sleep_target_minutes_part"))) ??
      normalizeSleepHours(pick(formData.get("sleep_target_hours"))),
    weight_min: weightMin,
    weight_max: weightMax,
    project_goal: pick(formData.get("project_goal")).trim(),
    max_hours_week: Number(pick(formData.get("max_hours_week")) || 0)
  });

  revalidatePath("/vector");
  revalidatePath("/today");
  revalidatePath("/month");
  redirect("/vector");
}

export async function addProjectAction(formData: FormData) {
  const name = pick(formData.get("new_project_name"));
  const hours = Number(pick(formData.get("new_project_hours")) || 0);
  const goal = pick(formData.get("new_project_goal")).trim() || null;
  await addOrActivateProject({ name, max_hours_week: hours, project_goal: goal });

  revalidatePath("/vector");
  revalidatePath("/today");
  redirect("/vector?project_added=1");
}

export async function updateProjectAction(formData: FormData) {
  const projectId = Number(pick(formData.get("project_id")) || 0);
  const name = pick(formData.get("project_name"));
  const hours = Number(pick(formData.get("project_hours")) || 0);
  const goal = pick(formData.get("project_goal")).trim() || null;

  await updateProject({
    id: projectId,
    name,
    max_hours_week: hours,
    project_goal: goal
  });

  revalidatePath("/vector");
  revalidatePath("/today");
  redirect(`/vector?saved_project=${projectId}`);
}

export async function addNoteAction(formData: FormData) {
  const noteDate = pick(formData.get("note_date"));
  const date = isValidIsoDate(noteDate) ? noteDate : getTodayIsoDate();
  const text = pick(formData.get("text"));
  await addNoteItem({ note_date: date, text });

  revalidatePath("/notes");
  redirect(`/notes?date=${date}`);
}

export async function toggleNoteAction(formData: FormData) {
  const noteDate = pick(formData.get("note_date"));
  const date = isValidIsoDate(noteDate) ? noteDate : getTodayIsoDate();
  const id = Number(pick(formData.get("id")) || 0);
  const done = pick(formData.get("done")) === "1";
  if (Number.isFinite(id) && id > 0) {
    await setNoteDone({ id, done, note_date: date });
  }

  revalidatePath("/notes");
  redirect(`/notes?date=${date}`);
}
