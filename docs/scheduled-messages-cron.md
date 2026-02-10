# Scheduled Messages – Cron Setup

Scheduled messages are sent by a cron job that processes due items every minute.

## Endpoint

- **URL:** `GET` or `POST` `/api/cron/send-scheduled-messages`
- **Auth:** Set `CRON_SECRET` in the backend env. Call the endpoint with either:
  - `Authorization: Bearer <CRON_SECRET>`, or
  - `x-cron-secret: <CRON_SECRET>`
- If `CRON_SECRET` is not set, the endpoint accepts requests without auth (suitable only for trusted networks).

## Railway

1. In the Railway project, add a **Cron Job** (or use an external cron service that hits your deployed backend).
2. Schedule: every minute (e.g. `* * * * *`).
3. Command/URL: call your backend, e.g.  
   `curl -X POST "https://your-backend.up.railway.app/api/cron/send-scheduled-messages" -H "x-cron-secret: YOUR_CRON_SECRET"`
4. Set `CRON_SECRET` in the backend service environment variables and use the same value in the cron request.

## Behaviour

- Selects rows in `scheduled_messages` with `status = 'pending'` and `scheduled_time <= NOW()` (UTC).
- For each row: sets status to `sending`, sends the message via Baileys (existing user connection), then sets `sent` and `sent_at` or `failed` and `error_message`.
- Failed sends are retried up to 3 times with exponential backoff (next run at now + 2^retryCount minutes).
- Requires the user’s WhatsApp session to be connected; if not, the send fails and is retried later.
