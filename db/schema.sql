CREATE TABLE IF NOT EXISTS vector (
  id INTEGER PRIMARY KEY,
  start_date DATE NOT NULL,
  horizon_months INTEGER NOT NULL,
  income_target INTEGER NOT NULL,
  sleep_target_hours NUMERIC(4,2),
  weight_min NUMERIC(10,2) NOT NULL,
  weight_max NUMERIC(10,2) NOT NULL,
  project_goal TEXT NOT NULL,
  max_hours_week INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  max_hours_week INTEGER NOT NULL DEFAULT 0,
  project_goal TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_one_active_idx ON projects ((is_active)) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS days (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  deep_minutes INTEGER NOT NULL DEFAULT 0,
  noise_minutes INTEGER NOT NULL DEFAULT 0,
  sleep_hours NUMERIC(4,2),
  sleep_quality INTEGER,
  sleep_note TEXT,
  steps INTEGER NOT NULL DEFAULT 0,
  key_move TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS day_training (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('light', 'strength', 'cardio'))
);

CREATE INDEX IF NOT EXISTS day_training_day_id_idx ON day_training(day_id);

CREATE TABLE IF NOT EXISTS day_project (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key_move TEXT,
  UNIQUE(day_id, project_id)
);

CREATE INDEX IF NOT EXISTS day_project_day_id_idx ON day_project(day_id);
CREATE INDEX IF NOT EXISTS day_project_project_id_idx ON day_project(project_id);

CREATE TABLE IF NOT EXISTS weeks (
  id BIGSERIAL PRIMARY KEY,
  week_start DATE NOT NULL UNIQUE,
  trajectory_quality INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS month_reviews (
  id BIGSERIAL PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  income_actual INTEGER,
  actual_income_done BOOLEAN NOT NULL DEFAULT FALSE,
  trajectory_quality INTEGER,
  note TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS month_week_income (
  id BIGSERIAL PRIMARY KEY,
  month_review_id BIGINT NOT NULL REFERENCES month_reviews(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  income INTEGER NOT NULL,
  UNIQUE(month_review_id, week_start)
);

CREATE TABLE IF NOT EXISTS note_items (
  id BIGSERIAL PRIMARY KEY,
  note_date DATE NOT NULL,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS note_items_note_date_idx ON note_items(note_date);

INSERT INTO vector (
  id,
  start_date,
  horizon_months,
  income_target,
  weight_min,
  weight_max,
  project_goal,
  max_hours_week
)
SELECT
  1,
  CURRENT_DATE,
  12,
  500,
  73,
  75,
  '1 completed commercial product',
  35
WHERE NOT EXISTS (SELECT 1 FROM vector WHERE id = 1);

INSERT INTO projects (name, is_active)
SELECT v.project_goal, TRUE
FROM vector v
WHERE v.id = 1
  AND NOT EXISTS (SELECT 1 FROM projects WHERE is_active = TRUE);

ALTER TABLE vector ADD COLUMN IF NOT EXISTS sleep_target_hours NUMERIC(4,2);
ALTER TABLE days ADD COLUMN IF NOT EXISTS sleep_hours NUMERIC(4,2);
ALTER TABLE days ADD COLUMN IF NOT EXISTS sleep_quality INTEGER;
ALTER TABLE days ADD COLUMN IF NOT EXISTS sleep_note TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_hours_week INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_goal TEXT;
