# WhatsApp CRM — Setup & Deployment Guide

This guide covers: **Supabase setup**, **local testing**, and **deploying** (Git → Vercel + Railway).

---

## 1. Prepare the Supabase project

Supabase is the database (PostgreSQL). The app uses Prisma; Supabase only needs to provide the DB and connection string.

### 1.1 Create / use a Supabase project

- Go to [supabase.com](https://supabase.com) → Dashboard → **New project**.
- Pick org, name (e.g. `whatsapp-crm`), region, and a strong **Database password** (save it).
- Wait for the project to be ready.

### 1.2 Get connection details

In Supabase Dashboard → **Project Settings** → **Database**:

- **Connection string (URI):** use **“URI”** (not Transaction pooler for Prisma migrations).
- Format:  
  `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
- Copy this as your `DATABASE_URL`.

Optional (for frontend real-time / future use):

- **Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- **API** → anon key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  
  (and service role key for backend if you add Supabase client later)

### 1.3 Apply the database schema (Prisma)

The schema is applied via **Prisma migrations**, not Supabase SQL editor.

**Option A — Development (quick sync, no migration history):**

```bash
cd backend
npm install
npm run db:generate
npm run db:push
```

**Option B — Production-style (use existing migration):**

```bash
cd backend
npm install
npm run db:generate
npx prisma migrate deploy
```

- `db:generate` updates the Prisma client.
- `db:push` syncs the schema to the DB (dev).
- `migrate deploy` applies the migration in `prisma/migrations/20250206000000_init/` (dev or prod).

After this, Supabase has tables: `users`, `whatsapp_sessions`, `contacts`, `messages`, and enum `MessageType`. No manual SQL in Supabase is required.

### 1.4 Backend `.env` (local)

In `backend/.env` set at least:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
JWT_SECRET="your-strong-secret-min-32-chars"
JWT_EXPIRES_IN="7d"
PORT=3001
SESSION_PATH="./whatsapp-sessions"
FRONTEND_URL="http://localhost:3000"
```

---

## 2. Test the solution locally

### 2.1 Backend

```bash
cd backend
npm install
npm run db:generate
npm run db:push   # or: npx prisma migrate deploy
npm run dev
```

- API: [http://localhost:3001](http://localhost:3001)  
- Health: e.g. `GET http://localhost:3001/` or your app’s health route if any.

### 2.2 Frontend

In another terminal:

```bash
cd frontend
npm install
```

Ensure `frontend/.env.local` (or `.env`) has:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Then:

```bash
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)

### 2.3 Manual test flow

1. Open [http://localhost:3000](http://localhost:3000) → should redirect to login/register.
2. **Register** a user (email + password).
3. **Login** → redirect to dashboard.
4. **Settings** → connect WhatsApp (initialize → show QR → scan with phone).
5. **Contacts** → list/search; open a contact → messages.
6. **Dashboard** → needs-attention / pending-replies (may be empty at first).

If anything fails, check backend logs and browser Network tab; ensure `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` match (localhost:3000 and localhost:3001).

---

## 3. Git, remote repo, and deploy (Vercel + Railway)

### 3.1 Git and remote

```bash
# From repo root
git init   # if not already
git add .
git commit -m "Initial commit: WhatsApp CRM backend + frontend"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USER/whatsapp-crm.git

# Push (main or your default branch)
git branch -M main
git push -u origin main
```

Use your actual GitHub (or GitLab, etc.) URL. If the repo already exists with a README, you may need `git pull origin main --rebase` then `git push -u origin main`.

### 3.2 Deploy backend on Railway first

Backend must be live first so the frontend can use its URL.

1. Go to [railway.app](https://railway.app) → Login → **New project**.
2. **Deploy from GitHub repo** → select `whatsapp-crm` (or connect GitHub and then select it).
3. **Set root directory:** `backend` (so Railway uses `backend/Dockerfile`).
4. **Variables** (Railway → your service → Variables):

   | Variable        | Value |
   |-----------------|--------|
   | `DATABASE_URL` | Your Supabase PostgreSQL URI (same as in 1.2) |
   | `JWT_SECRET`   | Strong secret (e.g. 32+ random chars) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `NODE_ENV`     | `production` |
   | `PORT`         | `3001` (or leave unset; Railway can set it) |
   | `SESSION_PATH` | `/data/whatsapp-sessions` |
   | `FRONTEND_URL` | Leave empty for now; set after Vercel deploy (e.g. `https://your-app.vercel.app`) |

5. **Volume (persist WhatsApp session):**
   - Railway → Service → **Volumes** → **New Volume**.
   - Mount path: `/data`.
   - So with `SESSION_PATH=/data/whatsapp-sessions`, session files persist across deploys.

6. Deploy. Railway will build from `backend/Dockerfile` (which runs `npx prisma migrate deploy` then starts the app). Copy the **public URL** (e.g. `https://whatsapp-crm-backend.up.railway.app`).

### 3.3 Deploy frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import the same Git repo.
2. **Root Directory:** set to `frontend` (monorepo).
3. **Environment variables** (Vercel project → Settings → Environment Variables):

   | Variable | Value |
   |----------|--------|
   | `NEXT_PUBLIC_API_URL` | Railway backend URL (e.g. `https://whatsapp-crm-backend.up.railway.app`) |
   | `NEXT_PUBLIC_SUPABASE_URL` | (optional) Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | (optional) Supabase anon key |

4. Deploy. Vercel runs build from `frontend/` and gives you a URL (e.g. `https://whatsapp-crm.vercel.app`).

### 3.4 Wire CORS (backend ↔ frontend)

Back in **Railway** → same service → **Variables**:

- Set `FRONTEND_URL` to your Vercel URL (e.g. `https://whatsapp-crm.vercel.app`).  
- Redeploy the backend if needed so CORS allows the frontend origin.

### 3.5 Summary order

1. Supabase: project + `DATABASE_URL` + run Prisma migrations (`db:push` or `migrate deploy`).
2. Local test: backend + frontend with `.env` / `.env.local`.
3. Git: commit, add remote, push.
4. Railway: deploy backend (root `backend`), set env + volume, get backend URL.
5. Vercel: deploy frontend (root `frontend`), set `NEXT_PUBLIC_API_URL` to backend URL.
6. Railway: set `FRONTEND_URL` to Vercel URL.

After that, the app is live: frontend on Vercel, backend on Railway, DB on Supabase.
