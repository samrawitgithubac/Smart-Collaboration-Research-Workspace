# Deploy on Render (API + Swagger + frontend)

This guide deploys the **backend** as a Render **Web Service**, **PostgreSQL** as a Render **database**, and the **frontend** as a **Static Site**. Your boss can open the frontend URL for the app and the API **Swagger** URL for API progress.

- **Swagger UI:** `https://<your-api-service>.onrender.com/api/docs`
- **OpenAPI JSON:** `https://<your-api-service>.onrender.com/api/openapi.json`

Render docs: [https://render.com/docs](https://render.com/docs)

---

## 1. PostgreSQL on Render

1. In the Render dashboard: **New +** → **PostgreSQL**.
2. Pick a name (e.g. `scrw-db`), region, plan.
3. After creation, copy the **Internal Database URL** (or **External** if you ever connect from outside Render).
4. You will use this as **`DATABASE_URL`** on the API service.

---

## 2. Backend (Web Service)

You can deploy the API in either of these ways:

### Option A — Docker (default if you pick “Docker” on Render)

Render looks for a **`Dockerfile` at the repository root**. This repo includes a root **`Dockerfile`** that builds only the **backend** (monorepo layout).

1. **New +** → **Web Service** → connect your **GitHub** repo.
2. Leave **Root Directory** empty (repository root), or set it to `.` so the root `Dockerfile` is used.
3. **Environment:** **Docker** (Render will run `docker build` using the root `Dockerfile`).

No need to set a custom Dockerfile path unless you moved the file.

### Option B — Native Node (no Docker)

1. **New +** → **Web Service** → connect your **GitHub** repo.
2. **Root Directory:** `backend`
3. **Runtime:** Node
4. **Build Command:**

   ```bash
   npm ci && npx prisma generate && npm run build
   ```

5. **Start Command:**

   ```bash
   npx prisma migrate deploy && npm run start
   ```

6. **Instance type:** Free is OK for demos (service **spins down** after idle; first request can take ~30–60s).

### Environment variables (API)

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Paste from the Render Postgres dashboard (same as `Internal Database URL` when API and DB are both on Render). |
| `JWT_SECRET` | Long random string (generate locally: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). |
| `NODE_ENV` | `production` |
| `PORT` | Leave **unset** on Render so the platform injects `PORT` (usually `10000`). The app already uses `process.env.PORT`. |
| `CORS_ORIGIN` | Your **frontend** URL(s), comma-separated, no trailing slash. Example: `https://scrw-web.onrender.com` |
| `PUBLIC_API_URL` | **Public** API base URL, no trailing slash. Example: `https://scrw-api.onrender.com` — used by Swagger “Try it out”. Render also sets `RENDER_EXTERNAL_URL`; the app uses that if `PUBLIC_API_URL` is missing. |
| `UPLOAD_DIR` | `/data/uploads` (or any writable path on the instance; for Free tier, disk is ephemeral — uploads are lost on redeploy). |
| `UPLOAD_MAX_MB` | `25` (optional) |

**Optional:** Add **`NODE_VERSION`** = `20` in **Environment** if the build picks an old Node.

After deploy, check:

- `https://<api-name>.onrender.com/health`
- `https://<api-name>.onrender.com/api/docs`

---

## 3. Frontend (Static Site)

The SPA must be built with your **real API origin** in `VITE_*` variables (Vite bakes them in at build time).

1. **New +** → **Static Site** → same repo.
2. **Root Directory:** `frontend`
3. **Build Command:**

   ```bash
   npm ci && npm run build
   ```

4. **Publish directory:** `dist`

### Environment variables (build-time)

Set these in the Static Site **Environment** tab (Render passes them into the build):

| Key | Example |
|-----|--------|
| `VITE_API_URL` | `https://scrw-api.onrender.com` (no trailing slash) |
| `VITE_SOCKET_URL` | Same as `VITE_API_URL` (Socket.IO on the same host) |

**Do not** set `VITE_AUTH_DEV_BYPASS` on production unless you intentionally want that button.

After the first deploy, copy the static site URL (e.g. `https://scrw-web.onrender.com`) and add it to the API **`CORS_ORIGIN`**, then **Manual Deploy** the API again if CORS was wrong on first boot.

---

## 4. Checklist for your boss

| Link | Purpose |
|------|--------|
| Frontend (Static Site) | Full UI: register, login, workspaces |
| `/api/docs` on API | Swagger: all endpoints, try auth + calls |
| `/health` on API | Quick “API is up” check |

---

## 5. Common issues

- **`P1001: Can't reach database server at localhost:5432` on deploy:** Your Web Service **`DATABASE_URL`** still points at your **laptop** (`localhost`). On Render there is no Postgres on `localhost` inside the container. Fix: open your **Render PostgreSQL** dashboard → copy **Internal Database URL** (or use **Connect** / **Link database** on the Web Service so Render injects `DATABASE_URL`). Paste that full URL into the API service **Environment** as `DATABASE_URL` and redeploy. It should look like `postgresql://...@dpg-xxxxx-a.region-postgres.render.com/...`, not `localhost`.
- **CORS errors in the browser:** `CORS_ORIGIN` must exactly match the frontend origin (scheme + host, no path).
- **401 on API after deploy:** JWT secret changed — users must log in again.
- **502 / timeout on first hit:** Free Web Service was asleep; retry after ~1 minute.
- **Uploads disappear:** Free tier has no persistent disk; use a paid disk or external storage (e.g. S3) for production files.

---

## 6. Alternative: Docker

You can deploy the API with Render’s **Docker** support using `backend/Dockerfile` instead of native Node; set the same environment variables and use a managed Postgres `DATABASE_URL`.
