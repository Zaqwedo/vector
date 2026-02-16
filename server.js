import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const store = {
  vector: null,
  dayByDate: new Map(),
  weekByStart: new Map(),
  monthByKey: new Map(),
};

const nowIso = () => new Date().toISOString();

const toISODate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayIsoDate = () => toISODate(new Date());

const parseISODate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (d, n) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

const getWeekStart = (d) => {
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(d, delta);
};

const getWeekRange = (isoDate) => {
  const date = parseISODate(isoDate);
  const start = getWeekStart(date);
  const end = addDays(start, 6);
  return { start: toISODate(start), end: toISODate(end) };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const ensureVector = () => {
  if (store.vector) return store.vector;
  const today = getTodayIsoDate();
  store.vector = {
    id: 1,
    start_date: today,
    horizon_months: 12,
    income_target: 500,
    weight_min: 73,
    weight_max: 75,
    project_goal: "1 completed commercial product",
    max_hours_week: 35,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  return store.vector;
};

const upsertDay = (payload) => {
  const existing = store.dayByDate.get(payload.date);
  if (existing) {
    store.dayByDate.set(payload.date, {
      ...existing,
      deep_hours: payload.deep_hours,
      training: payload.training,
      training_type: payload.training_type || existing.training_type || "none",
      training_modes: payload.training_modes || existing.training_modes || ["none"],
      steps: payload.steps,
      strategic_move: payload.strategic_move,
      noise_hours: payload.noise_hours,
      notes: payload.notes,
      updated_at: nowIso(),
    });
    return;
  }

  store.dayByDate.set(payload.date, {
    id: store.dayByDate.size + 1,
    date: payload.date,
    deep_hours: payload.deep_hours,
    training: payload.training,
    training_type: payload.training_type || "none",
    training_modes: payload.training_modes || ["none"],
    steps: payload.steps,
    strategic_move: payload.strategic_move,
    noise_hours: payload.noise_hours,
    notes: payload.notes,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
};

const upsertWeek = (payload) => {
  const existing = store.weekByStart.get(payload.week_start);
  if (existing) {
    store.weekByStart.set(payload.week_start, {
      ...existing,
      trajectory_quality: payload.trajectory_quality,
      notes: payload.notes,
      updated_at: nowIso(),
    });
    return;
  }

  store.weekByStart.set(payload.week_start, {
    id: store.weekByStart.size + 1,
    week_start: payload.week_start,
    week_end: payload.week_end,
    trajectory_quality: payload.trajectory_quality,
    notes: payload.notes,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
};

const getWeekSummary = (weekStart, weekEnd) => {
  const days = Array.from(store.dayByDate.values())
    .filter((d) => d.date >= weekStart && d.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));

  const agg = {
    deep_hours_total: 0,
    training_count: 0,
    steps_total: 0,
    noise_hours_total: 0,
    strategic_moves_count: 0,
    days_logged: days.length,
  };

  for (const d of days) {
    agg.deep_hours_total += d.deep_hours;
    agg.training_count += d.training ? 1 : 0;
    agg.steps_total += d.steps;
    agg.noise_hours_total += d.noise_hours;
    if (d.strategic_move && d.strategic_move.trim().length > 0) {
      agg.strategic_moves_count += 1;
    }
  }

  const tracked_hours_total = agg.deep_hours_total + agg.noise_hours_total;
  const noise_ratio = tracked_hours_total > 0 ? agg.noise_hours_total / tracked_hours_total : 0;
  const weekly_velocity = agg.deep_hours_total + agg.strategic_moves_count * 2;
  const avg_steps = agg.days_logged > 0 ? Math.round(agg.steps_total / agg.days_logged) : 0;

  return {
    ...agg,
    tracked_hours_total,
    noise_ratio,
    weekly_velocity,
    avg_steps,
  };
};

const getDeviationFlags = (weekStart, weekEnd) => {
  const current = getWeekSummary(weekStart, weekEnd);
  const prevRange = getWeekRange(toISODate(addDays(parseISODate(weekStart), -1)));
  const prev = getWeekSummary(prevRange.start, prevRange.end);

  const flags = [];
  if (current.strategic_moves_count === 0 && prev.strategic_moves_count === 0) {
    flags.push("Нет стратегических шагов 2 недели подряд");
  }
  if (current.noise_ratio > 0.3) {
    flags.push("Доля шума > 30% на этой неделе");
  }
  if (current.deep_hours_total < 6 && prev.deep_hours_total < 6) {
    flags.push("Глубокая работа < 6 часов 2 недели подряд");
  }
  return { flags, current };
};

const getStatus = (trajectory_quality, flagsCount) => {
  if (trajectory_quality === 1 || flagsCount >= 2) return "red";
  if (trajectory_quality === 2 || flagsCount === 1) return "yellow";
  return "green";
};

const getTodayStatus = (entry) => {
  if (!entry) return "yellow";
  const deepMinutes = Math.round((entry.deep_hours || 0) * 60);
  const outMinutes = Math.round((entry.noise_hours || 0) * 60);
  if (deepMinutes >= 90 && outMinutes <= 60) return "green";
  if (outMinutes > deepMinutes && outMinutes >= 90) return "red";
  return "yellow";
};

const formatTimeHm = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const isValidIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

const getMonthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const getMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("ru-RU", { month: "short", year: "numeric" });
};

const getMonthRange = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: toISODate(start), end: toISODate(end) };
};

const getMonthBodyStats = (monthKey) => {
  const range = getMonthRange(monthKey);
  const days = Array.from(store.dayByDate.values()).filter((d) => d.date >= range.start && d.date <= range.end);
  const stepsTotal = days.reduce((sum, d) => sum + (d.steps || 0), 0);
  const trainingCount = days.reduce((sum, d) => sum + (d.training ? 1 : 0), 0);
  const avgSteps = days.length ? Math.round(stepsTotal / days.length) : 0;
  return { avg_steps: avgSteps, training_count: trainingCount };
};

const getMonthWeeks = (monthKey) => {
  const range = getMonthRange(monthKey);
  const monthStart = parseISODate(range.start);
  const monthEnd = parseISODate(range.end);
  let cursor = getWeekStart(monthStart);
  const weeks = [];
  while (cursor <= monthEnd) {
    const weekStart = toISODate(cursor);
    const weekEnd = toISODate(addDays(cursor, 6));
    weeks.push({ week_start: weekStart, week_end: weekEnd });
    cursor = addDays(cursor, 7);
  }
  return weeks;
};

const getRangeDayStats = (startIso, endIso) => {
  const days = Array.from(store.dayByDate.values()).filter((d) => d.date >= startIso && d.date <= endIso);
  let deepHours = 0;
  let noiseHours = 0;
  let keyMoves = 0;
  let trainings = 0;
  let stepsTotal = 0;

  for (const d of days) {
    deepHours += d.deep_hours || 0;
    noiseHours += d.noise_hours || 0;
    stepsTotal += d.steps || 0;
    trainings += d.training ? 1 : 0;
    if (d.strategic_move && d.strategic_move.trim()) keyMoves += 1;
  }

  const deepMinutes = Math.round(deepHours * 60);
  const tracked = deepHours + noiseHours;
  const noisePercent = tracked > 0 ? Math.round((noiseHours / tracked) * 100) : 0;
  const avgSteps = days.length ? Math.round(stepsTotal / days.length) : 0;

  return {
    deep_minutes_total: deepMinutes,
    key_moves_count: keyMoves,
    trainings_count: trainings,
    noise_percent: noisePercent,
    avg_steps: avgSteps,
    days_count: days.length,
  };
};

const getIncomeStatus = (target, actual) => {
  if (actual === null || Number.isNaN(actual)) return { label: "по плану", kind: "track", delta: null };
  const delta = actual - target;
  const ratio = target > 0 ? actual / target : 1;
  if (ratio >= 1.05) return { label: "впереди", kind: "ahead", delta };
  if (ratio >= 0.95) return { label: "по плану", kind: "track", delta };
  return { label: "отставание", kind: "behind", delta };
};

const layout = (title, body, active = "") => `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand">Vector OS</div>
    <nav class="nav">
      <a class="${active === "vector" ? "active" : ""}" href="/vector">Вектор</a>
      <a class="${active === "day" ? "active" : ""}" href="/today">День</a>
      <a class="${active === "week" ? "active" : ""}" href="/week">Неделя</a>
      <a class="${active === "month" ? "active" : ""}" href="/month">Месяц</a>
    </nav>
  </header>
  <main class="container">
    ${body}
  </main>
</body>
</html>`;

const redirect = (res, location) => {
  res.writeHead(302, { Location: location });
  res.end();
};

const sendHtml = (res, html) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
};

const sendText = (res, code, text) => {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
};

const pickLast = (value) => (Array.isArray(value) ? value[value.length - 1] : value);

const parseFormBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      const parsed = new URLSearchParams(body);
      const obj = {};
      for (const [key, value] of parsed.entries()) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (Array.isArray(obj[key])) {
            obj[key].push(value);
          } else {
            obj[key] = [obj[key], value];
          }
        } else {
          obj[key] = value;
        }
      }
      resolve(obj);
    });
    req.on("error", reject);
  });

const normalizeTrainingModes = (value) => {
  const allowed = new Set(["none", "light", "strength", "cardio"]);
  const list = (Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .filter((v) => allowed.has(v));

  if (list.includes("none")) return ["none"];
  const deduped = Array.from(new Set(list));
  return deduped.length ? deduped : ["none"];
};

const handleTodayGet = (res, url) => {
  const today = getTodayIsoDate();
  const requestedDate = url?.searchParams.get("date");
  const selectedDate = isValidIsoDate(requestedDate) ? requestedDate : today;
  const entry = store.dayByDate.get(selectedDate);
  const vector = ensureVector();
  const status = getTodayStatus(entry);
  const deepMinutes = Math.round((entry?.deep_hours ?? 0) * 60);
  const outMinutes = Math.round((entry?.noise_hours ?? 0) * 60);
  const showMoveHint = deepMinutes > 0 && !(entry?.strategic_move && entry.strategic_move.trim());
  const selectedModes = normalizeTrainingModes(
    entry?.training_modes || entry?.training_type || (entry?.training ? ["light"] : ["none"])
  );
  const updatedText = entry?.updated_at ? `Обновлено · ${formatTimeHm(entry.updated_at)}` : "";
  const isPastDate = selectedDate < today;
  const activeProject = vector.project_goal?.trim() || "Не задано";
  const isChecked = (mode) => (selectedModes.includes(mode) ? "checked" : "");

  const body = `
  <section class="card today-card">
    <div class="today-head">
      <h1>День ·
        <form method="get" action="/today" class="date-form">
          <input class="date-link" type="date" name="date" value="${escapeHtml(selectedDate)}" onchange="this.form.submit()" />
        </form>
      </h1>
      <span class="status-dot status-dot-${status}" aria-label="Статус дня"></span>
    </div>
    ${updatedText ? `<p class="save-note">${escapeHtml(updatedText)}</p>` : ""}
    ${
      isPastDate
        ? `<div class="past-note"><span>Просмотр прошлой даты</span><a href="/today">Вернуться к сегодняшнему дню</a></div>`
        : ""
    }
    <form method="post" action="/today" class="form today-form">
      <input type="hidden" name="date" value="${escapeHtml(selectedDate)}" />

      <section class="today-section">
        <h2>Фокус</h2>
        <div class="today-inline">
          <label>Минуты глубокой работы
            <input type="number" min="0" max="720" name="deep_minutes" inputmode="numeric" value="${deepMinutes}" />
          </label>

          <label>Минуты вне фокуса
            <input type="number" min="0" max="720" name="noise_minutes" inputmode="numeric" value="${outMinutes}" />
          </label>
        </div>
      </section>

      <section class="today-section">
        <h2>Проект</h2>
        <label>Активный проект
          <input type="text" value="${escapeHtml(activeProject)}" readonly class="readonly-input" />
        </label>
        <label>Ключевой шаг дня
          <input type="text" maxlength="120" name="strategic_move" value="${escapeHtml(entry?.strategic_move ?? "")}" />
        </label>
        ${showMoveHint ? '<p class="hint-note">Есть минуты фокуса. Добавьте ключевой шаг дня.</p>' : ""}
      </section>

      <section class="today-section">
        <h2>Тело</h2>
        <div class="segmented-row" role="group" aria-label="Тип тренировки">
          <label class="segment">
            <input type="checkbox" name="training_modes" value="none" ${isChecked("none")} />
            <span>Нет</span>
          </label>
          <label class="segment">
            <input type="checkbox" name="training_modes" value="light" ${isChecked("light")} />
            <span>Лёгкая</span>
          </label>
          <label class="segment">
            <input type="checkbox" name="training_modes" value="strength" ${isChecked("strength")} />
            <span>Силовая</span>
          </label>
          <label class="segment">
            <input type="checkbox" name="training_modes" value="cardio" ${isChecked("cardio")} />
            <span>Кардио</span>
          </label>
        </div>

        <label>Шаги
          <input type="number" min="0" max="50000" name="steps" inputmode="numeric" value="${entry?.steps ?? 0}" />
        </label>
      </section>

      <button type="submit">Зафиксировать день</button>
    </form>
    <script>
      (() => {
        const boxes = Array.from(document.querySelectorAll('input[name="training_modes"]'));
        const none = boxes.find((b) => b.value === "none");
        const others = boxes.filter((b) => b.value !== "none");
        const sync = (changed) => {
          if (!none) return;
          if (changed === none && none.checked) {
            others.forEach((b) => { b.checked = false; });
            return;
          }
          if (changed && changed !== none && changed.checked) {
            none.checked = false;
          }
          const anyChecked = boxes.some((b) => b.checked);
          if (!anyChecked) none.checked = true;
        };
        boxes.forEach((b) => b.addEventListener("change", () => sync(b)));
      })();
    </script>
  </section>
  `;

  sendHtml(res, layout("День", body, "day"));
};

const handleWeekGet = (res, url) => {
  const today = getTodayIsoDate();
  const requestedDate = url?.searchParams.get("date");
  const selectedDate = isValidIsoDate(requestedDate) ? requestedDate : today;
  const range = getWeekRange(selectedDate);
  const weekRow = store.weekByStart.get(range.start);
  const { flags, current } = getDeviationFlags(range.start, range.end);

  const status = getStatus(weekRow?.trajectory_quality ?? null, flags.length);
  const statusClass = `status status-${status}`;

  const body = `
  <section class="card week-card">
    <div class="today-head">
      <h1>Неделя ·
        <form method="get" action="/week" class="date-form">
          <input class="date-link week-date-link" type="date" name="date" value="${escapeHtml(selectedDate)}" onchange="this.form.submit()" />
        </form>
      </h1>
    </div>
    <p class="sub">${escapeHtml(range.start)} → ${escapeHtml(range.end)}</p>

    <div class="stats">
      <div><span>Глубокая работа</span><strong>${current.deep_hours_total.toFixed(2)}</strong></div>
      <div><span>Стратегические шаги</span><strong>${current.strategic_moves_count}</strong></div>
      <div><span>Тренировки</span><strong>${current.training_count}</strong></div>
      <div><span>Средние шаги</span><strong>${current.avg_steps}</strong></div>
      <div><span>Шум %</span><strong>${Math.round(current.noise_ratio * 100)}%</strong></div>
      <div><span>Скорость</span><strong>${current.weekly_velocity.toFixed(2)}</strong></div>
    </div>

    <div class="status-wrap">
      <div class="${statusClass}">${status === "red" ? "КРАСНЫЙ" : status === "yellow" ? "ЖЕЛТЫЙ" : "ЗЕЛЕНЫЙ"}</div>
      <ul class="flags">
        ${flags.length ? flags.map((f) => `<li>${escapeHtml(f)}</li>`).join("") : "<li>Отклонений не обнаружено</li>"}
      </ul>
    </div>

    <form method="post" action="/week" class="form">
      <input type="hidden" name="week_start" value="${escapeHtml(range.start)}" />
      <input type="hidden" name="week_end" value="${escapeHtml(range.end)}" />
      <input type="hidden" name="date" value="${escapeHtml(selectedDate)}" />

      <label>Качество траектории</label>
      <div class="score-row">
        ${[1, 2, 3, 4, 5]
          .map(
            (n) => `
          <label class="score-pill">
            <input type="radio" name="trajectory_quality" value="${n}" ${Number(weekRow?.trajectory_quality) === n ? "checked" : ""} />
            <span>${n}</span>
          </label>`
          )
          .join("")}
      </div>

      <label>Заметки (опционально)
        <textarea name="notes" maxlength="200" rows="3">${escapeHtml(weekRow?.notes ?? "")}</textarea>
      </label>

      <button type="submit">Сохранить неделю</button>
    </form>
  </section>
  `;

  sendHtml(res, layout("Неделя", body, "week"));
};

const handleMonthGet = (res, url) => {
  const vector = ensureVector();
  const monthKey = (url.searchParams.get("month") || getMonthKey()).slice(0, 7);
  const monthRow = store.monthByKey.get(monthKey);
  const monthRange = getMonthRange(monthKey);
  const monthStats = getRangeDayStats(monthRange.start, monthRange.end);
  const weeks = getMonthWeeks(monthKey);
  const saved = url.searchParams.get("saved") === "1";
  const actualIncome = monthRow?.actual_income ?? "";
  const income = getIncomeStatus(vector.income_target, actualIncome === "" ? null : Number(actualIncome));
  const avgDeepPerWeek = weeks.length ? Math.round(monthStats.deep_minutes_total / weeks.length) : 0;
  const isLocked = Boolean(monthRow?.locked_at);
  const lockNote = isLocked ? `Зафиксировано · ${formatTimeHm(monthRow.locked_at)}` : "";
  const showSaved = saved && lockNote;
  const disabled = isLocked ? "disabled" : "";
  const ro = isLocked ? "readonly" : "";
  const actualIncomeDone = Boolean(monthRow?.actual_income_done);

  const weeklyBlocks = weeks
    .map((w, index) => {
      const rangeStart = w.week_start < monthRange.start ? monthRange.start : w.week_start;
      const rangeEnd = w.week_end > monthRange.end ? monthRange.end : w.week_end;
      const stats = getRangeDayStats(rangeStart, rangeEnd);
      return `
      <article class="week-block">
        <h3>Неделя ${index + 1} · ${escapeHtml(rangeStart)} — ${escapeHtml(rangeEnd)}</h3>
        <div class="week-grid">
          <div><span>Минуты глубокой работы</span><strong>${stats.deep_minutes_total}</strong></div>
          <div><span>Ключевые шаги</span><strong>${stats.key_moves_count}</strong></div>
          <div><span>Тренировки</span><strong>${stats.trainings_count}</strong></div>
        </div>
      </article>`;
    })
    .join("");

  const body = `
  <section class="card month-card">
    <div class="month-head">
      <h1>Месяц · ${escapeHtml(getMonthLabel(monthKey))}</h1>
      <span class="month-status month-status-${income.kind}">${income.label}</span>
    </div>
    ${showSaved ? `<p class="save-note">${escapeHtml(lockNote)}</p>` : isLocked ? `<p class="save-note">${escapeHtml(lockNote)}</p>` : ""}
    <form method="post" action="/month" class="form month-form">
      <input type="hidden" name="month_key" value="${escapeHtml(monthKey)}" />

      <section class="month-panel">
        <h2>Общий итог</h2>
        <div class="month-summary-grid">
          <div>
            <h3>Деньги</h3>
            <label>Цель
              <input type="number" value="${vector.income_target}" readonly class="readonly-input" />
            </label>
            <label>Факт
              <div class="month-input-row">
                <input type="number" min="0" name="actual_income" value="${actualIncome}" ${disabled} ${ro} />
                <label class="check-pill">
                  <input type="checkbox" name="actual_income_done" value="1" ${actualIncomeDone ? "checked" : ""} ${disabled} />
                  <span>Ввёл</span>
                </label>
              </div>
            </label>
            <p class="month-meta">Дельта: ${income.delta === null ? "—" : income.delta > 0 ? `+${income.delta}` : income.delta}</p>
          </div>
          <div>
            <h3>Фокус</h3>
            <p class="month-meta">Глубокая работа (мин): <strong>${monthStats.deep_minutes_total}</strong></p>
            <p class="month-meta">Среднее в неделю (мин): <strong>${avgDeepPerWeek}</strong></p>
            <p class="month-meta">Шум %: <strong>${monthStats.noise_percent}%</strong></p>
          </div>
          <div>
            <h3>Тело</h3>
            <p class="month-meta">Тренировок всего: <strong>${monthStats.trainings_count}</strong></p>
            <p class="month-meta">Средние шаги: <strong>${monthStats.avg_steps}</strong></p>
          </div>
          <div>
            <h3>Качество</h3>
            <label>Оценка траектории</label>
            <div class="score-row">
              ${[1, 2, 3, 4, 5]
                .map(
                  (n) => `
                <label class="score-pill">
                  <input type="radio" name="trajectory_quality" value="${n}" ${Number(monthRow?.trajectory_quality) === n ? "checked" : ""} ${disabled} />
                  <span>${n}</span>
                </label>`
                )
                .join("")}
            </div>
          </div>
        </div>
        <label>Что скорректировать в следующем месяце?
          <input type="text" maxlength="140" name="next_change" value="${escapeHtml(monthRow?.next_change ?? "")}" ${disabled} ${ro} />
        </label>
      </section>

      <section class="month-panel">
        <h2>По неделям</h2>
        <div class="week-stack">
          ${weeklyBlocks}
        </div>
      </section>

      ${
        isLocked
          ? '<button type="submit" disabled>Месяц зафиксирован</button>'
          : `<div class="month-actions">
        <button type="submit" name="action" value="save">Сохранить месяц</button>
        <button type="submit" name="action" value="lock">Зафиксировать месяц</button>
      </div>`
      }
    </form>
  </section>
  `;

  sendHtml(res, layout("Месяц", body, "month"));
};

const handleVectorGet = (res) => {
  const vector = ensureVector();

  const body = `
  <section class="card">
    <h1>Вектор</h1>
    <form method="post" action="/vector" class="form">
      <label>Дата старта
        <input type="date" name="start_date" value="${escapeHtml(vector.start_date)}" />
      </label>

      <label>Горизонт (мес.)
        <input type="number" min="1" max="24" name="horizon_months" value="${vector.horizon_months}" />
      </label>

      <label>Целевой доход
        <input type="number" min="0" name="income_target" value="${vector.income_target}" />
      </label>

      <label>Вес минимум
        <input type="number" step="0.1" min="0" name="weight_min" value="${vector.weight_min}" />
      </label>

      <label>Вес максимум
        <input type="number" step="0.1" min="0" name="weight_max" value="${vector.weight_max}" />
      </label>

      <label>Цель проекта
        <input type="text" maxlength="120" name="project_goal" value="${escapeHtml(vector.project_goal)}" />
      </label>

      <label>Макс. часов в неделю
        <input type="number" min="1" max="80" name="max_hours_week" value="${vector.max_hours_week}" />
      </label>

      <button type="submit">Сохранить вектор</button>
    </form>
  </section>
  `;

  sendHtml(res, layout("Вектор", body, "vector"));
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === "GET" && url.pathname === "/styles.css") {
      const cssPath = path.join(__dirname, "public", "styles.css");
      const css = fs.readFileSync(cssPath, "utf-8");
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      res.end(css);
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      redirect(res, "/today");
      return;
    }

    if (req.method === "GET" && url.pathname === "/today") {
      handleTodayGet(res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/today") {
      const body = await parseFormBody(req);
      const modes = normalizeTrainingModes(body.training_modes);
      const mainMode = modes.find((m) => m !== "none") || "none";
      const date = isValidIsoDate(pickLast(body.date)) ? pickLast(body.date) : getTodayIsoDate();
      upsertDay({
        date,
        deep_hours: Number(pickLast(body.deep_minutes) || 0) / 60,
        training: modes.includes("none") ? 0 : 1,
        training_type: mainMode,
        training_modes: modes,
        steps: Number(pickLast(body.steps) || 0),
        strategic_move: pickLast(body.strategic_move)?.trim() || null,
        noise_hours: Number(pickLast(body.noise_minutes) || 0) / 60,
        notes: null,
      });
      redirect(res, `/today?date=${date}`);
      return;
    }

    if (req.method === "GET" && url.pathname === "/week") {
      handleWeekGet(res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/week") {
      const body = await parseFormBody(req);
      upsertWeek({
        week_start: pickLast(body.week_start),
        week_end: pickLast(body.week_end),
        trajectory_quality: pickLast(body.trajectory_quality) ? Number(pickLast(body.trajectory_quality)) : null,
        notes: pickLast(body.notes)?.trim() || null,
      });
      const selectedDate = isValidIsoDate(pickLast(body.date)) ? pickLast(body.date) : getTodayIsoDate();
      redirect(res, `/week?date=${selectedDate}`);
      return;
    }

    if (req.method === "GET" && url.pathname === "/vector") {
      handleVectorGet(res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/month") {
      handleMonthGet(res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/month") {
      const body = await parseFormBody(req);
      const monthKey = (pickLast(body.month_key) || getMonthKey()).slice(0, 7);
      const existing = store.monthByKey.get(monthKey);
      const action = pickLast(body.action) || "save";
      if (!existing?.locked_at) {
        store.monthByKey.set(monthKey, {
          id: existing?.id || store.monthByKey.size + 1,
          month_key: monthKey,
          actual_income: pickLast(body.actual_income) ? Number(pickLast(body.actual_income)) : null,
          actual_income_done: pickLast(body.actual_income_done) === "1",
          trajectory_quality: pickLast(body.trajectory_quality) ? Number(pickLast(body.trajectory_quality)) : null,
          next_change: pickLast(body.next_change)?.trim() || null,
          created_at: existing?.created_at || nowIso(),
          updated_at: nowIso(),
          locked_at: action === "lock" ? nowIso() : existing?.locked_at || null,
        });
      }
      redirect(res, `/month?month=${monthKey}&saved=1`);
      return;
    }

    if (req.method === "POST" && url.pathname === "/vector") {
      const body = await parseFormBody(req);
      ensureVector();
      store.vector = {
        ...store.vector,
        start_date: pickLast(body.start_date),
        horizon_months: Number(pickLast(body.horizon_months) || 12),
        income_target: Number(pickLast(body.income_target) || 0),
        weight_min: Number(pickLast(body.weight_min) || 0),
        weight_max: Number(pickLast(body.weight_max) || 0),
        project_goal: pickLast(body.project_goal)?.trim() || "",
        max_hours_week: Number(pickLast(body.max_hours_week) || 0),
        updated_at: nowIso(),
      };
      redirect(res, "/vector");
      return;
    }

    sendText(res, 404, "Не найдено");
  } catch (err) {
    sendText(res, 500, `Ошибка сервера: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`Vector OS запущен на http://localhost:${PORT}`);
});
