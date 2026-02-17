export type TrainingType = "none" | "light" | "strength" | "cardio";
export type Trend = "up" | "flat" | "down" | "na";

export type IncomeStatusKind = "ahead" | "track" | "behind";

export type ProjectRow = {
  id: number;
  name: string;
  max_hours_week: number;
  project_goal: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DayProjectEntry = {
  project_id: number;
  key_move: string | null;
};

export type VectorRow = {
  id: number;
  start_date: string;
  horizon_months: number;
  income_target: number;
  sleep_target_hours: number | null;
  weight_min: number;
  weight_max: number;
  project_goal: string;
  max_hours_week: number;
  created_at: string;
  updated_at: string;
};

export type DayRow = {
  id: number;
  date: string;
  deep_minutes: number;
  noise_minutes: number;
  sleep_hours: number | null;
  sleep_quality: number | null;
  sleep_note: string | null;
  steps: number;
  key_move: string | null;
  project_entries: DayProjectEntry[];
  created_at: string;
  updated_at: string;
  training_modes: TrainingType[];
};

export type WeekRow = {
  id: number;
  week_start: string;
  trajectory_quality: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthReviewRow = {
  id: number;
  month: string;
  income_actual: number | null;
  actual_income_done: boolean;
  trajectory_quality: number | null;
  note: string | null;
  is_locked: boolean;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  week_income: Record<string, number>;
};
