# Vector OS (Next.js + TypeScript + Postgres)

Vector OS migrated from native Node HTTP + in-memory storage to:
- Next.js (App Router)
- TypeScript
- Server Actions
- Postgres (Supabase-ready via `DATABASE_URL`)

## Tech stack

- Next.js 15 (App Router)
- React 19
- TypeScript 5
- PostgreSQL driver: `pg`
- Server-side rendering + Server Actions (no Express)

## Requirements

- Node.js 20+
- PostgreSQL database (local or Supabase)

## Environment

Create `.env.local`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vectoros
```

## Install & run

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Database schema

Schema file: `db/schema.sql`

It includes tables:
- `vector`
- `projects` (single active project via partial unique index)
- `days`
- `day_training`
- `weeks`
- `month_reviews`
- `month_week_income`

Schema is auto-ensured on first DB access by server code (`lib/db.ts`).

## Routes

- `/today`
  - date picker in header
  - loads existing day record or empty form
  - shows `Обновлено · {время}` when record exists
  - Focus / Project / Body sections
  - save via Server Action
- `/week`
  - week selected by date picker
  - weekly aggregates computed on server
  - trajectory quality as 1..5 controls
- `/month`
  - "Общий итог" and "По неделям"
  - income target/actual/delta + status
  - monthly quality 1..5
  - save vs lock
  - after lock shows `Зафиксировано · {время}` and becomes read-only
- `/vector`
  - long-term parameters

## Server-side logic

All calculations are server-side (`lib/domain.ts`):
- weekly aggregates
- monthly aggregates
- noise %
- speed metric
- income status: `впереди / по плану / отставание`

## Project structure

```text
app/
  actions.ts
  today/page.tsx
  week/page.tsx
  month/page.tsx
  vector/page.tsx
  layout.tsx
  globals.css
components/
  Shell.tsx
  AutoDateInput.tsx
lib/
  db.ts
  domain.ts
  date.ts
  types.ts
db/
  schema.sql
```

## Deploy (Vercel)

1. Push repository to Git provider
2. Import project in Vercel
3. Set `DATABASE_URL` in Vercel env vars
4. Deploy

No custom server is required.
