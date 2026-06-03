# MediLink Deployment (Vercel + Railway + Supabase + Cloudinary + Clerk)

This repo is split into:
- `apps/web` (Next.js App Router) → deploy to **Vercel**
- `apps/api` (Express + Prisma) → deploy to **Railway**
- **Supabase Postgres** → database
- **Cloudinary** → file storage
- **Clerk** → auth for the web app

## 1) Supabase (Database)

1. Create a Supabase project.
2. Get the Postgres connection strings:
   - Use the **transaction pooler / pooled** URL for runtime (`DATABASE_URL`).
   - Use the **direct** URL for migrations/CLI (`DIRECT_URL`).
3. Initialize the schema.

You have two practical options:

### Option A (fastest for prototype): initialize via SQL
- Open Supabase **SQL Editor**.
- Paste and run the contents of `apps/api/prisma/init_postgres.sql`.

This creates the tables based on the current Prisma schema.

### Option B (recommended long-term): recreate migrations for Postgres
Because older migrations in this repo were created against SQLite, you should regenerate a fresh migration history for Postgres.

Typical flow:
- Set `DIRECT_URL` to your direct Supabase connection string.
- Run locally from `apps/api`:
  - `npx prisma migrate dev --name init_postgres`

Then commit the new migrations and in Railway you can run:
- `npx prisma migrate deploy`

## 2) Cloudinary (File storage)

1. Create a Cloudinary account.
2. Copy:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. (Optional) choose `CLOUDINARY_FOLDER` (defaults to `medilink`).

Uploads are performed server-side by the API, and file view/download endpoints redirect to Cloudinary.

### If you see Cloudinary 401 (ACL failure)
If opening a Cloudinary URL returns `401 Unauthorized` with `X-Cld-Error: deny or ACL failure`, your Cloudinary account likely has token-based access control enabled.

Two options:
- Turn off token-based access control in Cloudinary settings (fastest for prototype), OR
- Keep it enabled and set these API env vars:
   - `CLOUDINARY_AUTH_TOKEN_KEY`
   - `CLOUDINARY_AUTH_TOKEN_DURATION_SECONDS` (optional)

## 3) Railway (API)

### Create the service
1. Create a new Railway project.
2. Add a service from this GitHub repo.
3. Set the **Root Directory** to `apps/api`.

### Commands
- Build command: `npm install; npm run build`
- Start command: `npm run start`

### Required Railway environment variables
Set these in Railway → Variables:
- `DATABASE_URL`
- `DIRECT_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER` (optional)
- SMTP vars if you want email notifications:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### One-time DB setup (choose one)
- If using Option A (SQL init): run the SQL in Supabase first, then deploy API.
- If using Option B (migrations): run `npx prisma migrate deploy` on Railway (either as a one-off command or by temporarily making Start command `npx prisma migrate deploy; npm run start`).

### Verify
- Visit `https://<your-railway-service>/health` → should return `{ ok: true }`.

## 4) Clerk (Auth)

1. Create a Clerk application.
2. Configure allowed redirect URLs / origins for your Vercel domain.
3. Copy the keys for Vercel:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

## 5) Vercel (Web)

1. Import the repo into Vercel.
2. Set the **Root Directory** to `apps/web`.
3. Add Environment Variables (from `apps/web/.env.example`):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (optional)
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (optional)
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` (optional)
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` (optional)
   - `NEXT_PUBLIC_API_BASE_URL` → set to your Railway API base URL (e.g. `https://<service>.up.railway.app`)

## Notes / gotchas
- Railway runs the API as a long-lived process, so the prototype medicine reconcile loop can keep running.
- Vercel file proxy routes now pass through redirects, so large files do not stream through Vercel.
- This codebase still uses the prototype header trust model (`x-user-id`). If you want to harden production security, the next step is verifying Clerk JWTs in the API instead of trusting headers.
