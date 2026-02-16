# Vector OS — Conversation Memory (Spec v0.1)

_Last updated: 2026-02-16 (Europe/Berlin)_

## 1) Core intent
You want a **navigation layer over your life** — like a Jarvis / navigator:
- You are the **driver** (no “guru”, no pushing or decision-making by others).
- The system acts as **road signs + dashboard**:
  - **Speed**
  - **Deviation from route**
  - **Trajectory quality**
- Control must be **simple and clear** (not the main “activity”).

## 2) Personal baseline & targets
### Money
- Current income: **250**
- Goal: **maintain or multiply to ~2× (≈500+)** within 12 months

### Body / health
- Current weight: **73 kg**
- Target range: **73–75 kg (stay similar, max 75)**
- Goal emphasis: **good health + good external condition** (“плотность”, solid presence)

### Time budget
- Project work: **15–25 h/week**
- Max sustainable total for project layer: **up to 35 h/week**
- Control/ops overhead: **≤ 40 min/week (less is better)**

## 3) Strategy choice
- Start with a **simple personal system** (V1) and run it for ~90 days to gain unique experience.
- **Design V1 so it can scale into a SaaS** later (same data model / core flows).
- Advanced “control engine” is potentially a **separate commercial product** later, enriched by real usage data.

## 4) Desired “curator” model
- Not a constant real human.
- **Advisory + clear structure** fits:
  - Advisory is “external radar” (monthly calibration), not a boss.
- Primary need: **your own instrument**, customized; not rented or limited by someone else’s tooling.

## 5) V1 system principles
1. **Minimal entities** (to avoid bureaucracy)
2. **Fast daily logging** (1–2 minutes)
3. **Weekly auto-summary** (generated)
4. **Monthly calibration** (short)
5. System overhead stays **below 5% of time**.

## 6) Data model (V1)
Keep only **3 object types**:
1. **Vector** (annual / long horizon)
2. **Day**
3. **Week**

### 6.1 Vector (set rarely; the “route”)
Example fields:
```yaml
income_target: 500
weight_range: "73-75"
project_goal: "1 completed commercial product"
max_hours_week: 35
horizon_months: 12
```

### 6.2 Day Log (daily; ultra-short)
Fields (V1):
- `deep_hours` (number)
- `training` (0/1 or enum)
- `steps` (number)
- `strategic_move` (short string, optional)
- `noise_hours` (number; “time that went nowhere”)

Notes:
- Daily entry should be possible **only when there’s something to log**.
- Avoid long reflection text in daily mode.

### 6.3 Week Summary (computed + 1 manual quality score)
Computed:
- `deep_hours_total`
- `training_count`
- `steps_total` / `avg_steps`
- `%noise = noise_hours_total / (deep_hours_total + noise_hours_total)` (or from total tracked hours)
- `strategic_moves_count`

Manual:
- `trajectory_quality` (1–5): “strategic progress vs fuss”

## 7) Navigation logic (metrics)
### Speed
A simple starting metric:
```text
weekly_velocity = deep_hours_total + strategic_moves_count * 2
```

### Deviation rules (starter triggers)
Deviation if (examples):
- **2 weeks подряд**: `strategic_moves_count == 0`
- OR **noise% > 30%** for a week (tunable)

### Trajectory quality
- Weekly manual score 1–5
- Monthly check: “am I building an asset or just staying busy?”

## 8) UX / Product direction
You self-identify as **product/UX-first**.

V1 should be:
- Minimal web UI (for yourself)
- Simple and fast
- No heavy infrastructure in V1 UX (avoid “meta-work”)

## 9) V1 app shape (screens)
3 screens only:
1. **Today**
   - quick inputs: deep hours, training, steps, strategic move, noise hours
2. **Week**
   - computed summary + status (green/yellow/red)
   - enter 1–5 trajectory quality
3. **Vector**
   - view/edit route constants

No auth, no roles, no complex graphs in V1.

## 10) Tech direction (V1, SaaS-ready)
Suggested stack direction:
- Web app
- Local DB (SQLite) to start
- Keep architecture clean so SaaS is possible later:
  - separate domain model
  - migrations
  - event timestamps
  - user concept can be added later even if single-user now

## 11) Meta Log (product discovery for future SaaS)
A dedicated place to capture:
- “What annoyed me?”
- “What did I want to automate?”
- “What would I pay for if this was polished?”

This becomes the raw input for the commercial product roadmap after ~90 days of usage.

## 12) Non-goals (avoid early)
- Overly complex hierarchies (projects/subprojects/categories OKRs everywhere)
- Daily essays / long reflections
- Heavy dashboards or complicated automation before usage proves value
- “Mentor-driven” steering

---

## Quick one-paragraph definition
**Vector OS V1** is a self-owned, minimal web tool that lets you log 5 daily numbers/flags and automatically produces weekly navigation signals for speed, deviation, and trajectory quality — designed from day one with a clean data model so it can later evolve into a multi-user SaaS.
