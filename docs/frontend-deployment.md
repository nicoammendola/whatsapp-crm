# Frontend deployment (Vercel)

## Environment variables

Set these in the Vercel project (Settings → Environment Variables):

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (required) | `https://your-backend.up.railway.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (optional, for real-time) | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (optional) | `eyJ...` |

## Deploy steps

1. Push the repo to GitHub (or connect your Git provider in Vercel).
2. In Vercel: **Add New Project** → Import the repository.
3. Set **Root Directory** to `frontend` (monorepo).
4. Add the environment variables above.
5. Deploy. Vercel will run `npm run build` from the `frontend` directory.

## Post-deploy

- Set the backend `FRONTEND_URL` (and CORS) to your Vercel URL (e.g. `https://your-app.vercel.app`) so auth and API calls work from the frontend.
