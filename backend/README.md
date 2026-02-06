# WhatsApp CRM — Backend

Express API, Prisma, and Baileys (WhatsApp) integration.

## Environment

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — PostgreSQL connection string (Supabase)
- `JWT_SECRET` — Secret for JWT signing
- `JWT_EXPIRES_IN` — e.g. `7d`
- `PORT` — Server port (default 3001)
- `SESSION_PATH` — Directory for WhatsApp session files
- `FRONTEND_URL` — Allowed CORS origin (frontend URL)

## Database

### Commands

- **Generate Prisma client** (after schema or dependency changes):
  ```bash
  npm run db:generate
  # or: npx prisma generate
  ```

- **Development (quick sync without migration history):**
  ```bash
  npm run db:push
  # or: npx prisma db push
  ```
  Use `db push` when iterating on the schema locally. It updates the database to match `schema.prisma` without creating migration files. Good for dev; not recommended for production.

- **Development (with migrations):**
  ```bash
  npm run db:migrate
  # or: npx prisma migrate dev
  ```
  Creates a new migration from schema changes and applies it. Use when you want to track migrations (e.g. before committing schema changes).

- **Production / deploy:**
  ```bash
  npx prisma migrate deploy
  ```
  Applies pending migrations only. Run this in your deploy step (e.g. in Dockerfile or Railway start command).

- **Studio (browse data):**
  ```bash
  npm run db:studio
  ```

### Summary

| Scenario              | Command                |
|-----------------------|------------------------|
| Regenerate client     | `npx prisma generate`  |
| Dev — quick sync      | `npx prisma db push`   |
| Dev — new migration   | `npx prisma migrate dev` |
| Deploy / production   | `npx prisma migrate deploy` |

## Run locally

```bash
npm install
npm run db:generate
npm run db:push   # or: npx prisma migrate deploy (if DB is reachable)
npm run dev       # or: npm run build && npm start
```

## API

- **Auth:** `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (Bearer token)
- **WhatsApp:** `POST /whatsapp/initialize`, `GET /whatsapp/status`, `POST /whatsapp/disconnect`
- **Contacts:** `GET /contacts`, `GET /contacts/:id`, `PATCH /contacts/:id`
- **Messages:** `GET /messages`, `GET /messages/contact/:contactId`
- **Analytics:** `GET /api/analytics/dashboard`

All except auth require `Authorization: Bearer <token>`.

See `docs/implementation-plan.md` and `docs/api.md` for request/response shapes.

## Deployment (Railway)

### Docker

Build and run locally:

```bash
docker build -t whatsapp-crm-backend .
docker run -p 3001:3001 --env-file .env whatsapp-crm-backend
```

### Railway checklist

1. **Create project** — New project from GitHub repo or Railway CLI (`railway init`).
2. **Deploy** — Use the `backend/` Dockerfile (set root directory to `backend` if needed, or run from repo root with Dockerfile path).
3. **Environment variables** (Railway → Service → Variables):
   - `DATABASE_URL` — Supabase PostgreSQL connection string
   - `JWT_SECRET` — Strong secret for JWT
   - `JWT_EXPIRES_IN` — e.g. `7d`
   - `PORT` — `3001` (or leave unset; Railway sets it)
   - `NODE_ENV` — `production`
   - `SESSION_PATH` — **Important:** use a path that will be mounted as a volume, e.g. `/data/whatsapp-sessions`
   - `FRONTEND_URL` — Your frontend origin (e.g. `https://your-app.vercel.app`) for CORS
4. **Volume for WhatsApp sessions** — So session data persists across deploys:
   - Railway → Service → Volumes → New Volume
   - Mount path: `/data` (or the parent of `SESSION_PATH`; if `SESSION_PATH=/data/whatsapp-sessions`, mount `/data`)
   - Ensure `SESSION_PATH` matches (e.g. `SESSION_PATH=/data/whatsapp-sessions`).
5. **Migrations** — Run on every deploy via Dockerfile `CMD` (`npx prisma migrate deploy`). To run manually:
   ```bash
   railway run npx prisma migrate deploy
   ```
6. **Backend URL** — After deploy, copy the public URL (e.g. `https://your-backend.up.railway.app`) and set it as `NEXT_PUBLIC_API_URL` in the frontend.
