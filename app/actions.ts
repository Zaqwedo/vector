"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTodayIsoDate, isValidIsoDate } from "@/lib/date";
import {
  normalizeTrainingModes,
  upsertDay,
  upsertMonthReview,
  upsertWeek,
  updateVector
} from "@/lib/domain";

const pick = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function saveDayAction(formData: FormData) {
  const dateRaw = pick(formData.get("date"));
  const date = isValidIsoDate(dateRaw) ? dateRaw : getTodayIsoDate();
  const deep = Number(pick(formData.get("deep_minutes")) || 0);
  const noise = Number(pick(formData.get("noise_minutes")) || 0);
  const steps = Number(pick(formData.get("steps")) || 0);
  const keyMove = pick(formData.get("key_move")).trim() || null;
  const trainingModes = normalizeTrainingModes(formData.getAll("training_modes") as string[]);

  await upsertDay({
    date,
    deep_minutes: deep,
    noise_minutes: noise,
    steps,
    key_move: keyMove,
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
  await updateVector({
    start_date: pick(formData.get("start_date")),
    horizon_months: Number(pick(formData.get("horizon_months")) || 12),
    income_target: Number(pick(formData.get("income_target")) || 0),
    weight_min: Number(pick(formData.get("weight_min")) || 0),
    weight_max: Number(pick(formData.get("weight_max")) || 0),
    project_goal: pick(formData.get("project_goal")).trim(),
    max_hours_week: Number(pick(formData.get("max_hours_week")) || 0)
  });

  revalidatePath("/vector");
  revalidatePath("/today");
  revalidatePath("/month");
  redirect("/vector");
}
