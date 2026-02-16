export type TrainingType = "none" | "light" | "strength" | "cardio";

export type IncomeStatusKind = "ahead" | "track" | "behind";

export type VectorRow = {
  id: number;
  start_date: string;
  horizon_months: number;
  income_target: number;
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
  steps: number;
  key_move: string | null;
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
