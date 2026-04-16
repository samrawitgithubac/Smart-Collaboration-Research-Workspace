# Smart Collaboration & Research Workspace

Full-stack workspace app for teams: **multi-tenant workspaces**, **JWT auth**, **Admin / Member roles**, **Kanban tasks**, **file uploads**, and **Socket.IO** updates when tasks or files change.

## Stack

| Layer | Technology |
|--------|------------|
| API | Node.js 20, Express, Prisma, PostgreSQL |
| Realtime | Socket.IO (JWT on connection; join per workspace room) |
| Web | React 18, Vite, React Router, TanStack Query, dnd-kit |
| Deploy | Docker Compose (Postgres, API, static web + nginx reverse proxy) |

## Repository layout

```
backend/          # Node API (Express + Prisma)
frontend/         # React SPA (Vite), MVC-style src layout — see below
docker-compose.yml
```

### Frontend MVC layout (`frontend/src`)

| Folder | Role |
|--------|------|
| `models/` | **Model** — API client (`api.ts`), domain types (`types.ts`), shared data contracts |
| `views/` | **View** — UI only: `styles/`, `components/`, `pages/`, `App.tsx` (route → screens) |
| `controllers/` | **Controller** — App logic wiring: `auth/AuthContext.tsx`, `hooks/` (e.g. realtime) |

`main.tsx` bootstraps providers and mounts `views/App.tsx`.

## Architecture (high level)

- **Tenancy**: A `Workspace` is a tenant boundary. All tasks, files, and invites reference `workspaceId`. Users belong to many workspaces via `WorkspaceMember` with `WorkspaceRole` (`ADMIN` | `MEMBER`).
- **Auth**: Register/login returns a JWT. `Authorization: Bearer` is required for API routes. Tokens are verified on HTTP (middleware) and on the Socket.IO handshake.
- **Authorization**: `requireWorkspaceMember()` loads membership for `req.params.workspaceId`. Stricter routes use `requireWorkspaceMember("ADMIN")` (invites, member removal, workspace delete, etc.).
- **Files**: Stored on disk (`UPLOAD_DIR`); metadata in Postgres. Downloads stream via Express `res.download`. In Docker, uploads use a named volume.
- **Realtime**: Clients emit `workspace:join` after connect; server verifies membership and joins socket to `workspace:${workspaceId}`. Task/file mutations emit events to that room so other members’ boards and file lists update without polling.

### Scalability notes

- DB indexes on `workspaceId` (tasks, files, invites) and `WorkspaceMember(userId)` support listing and access checks at scale.
- File storage is local disk; for production at scale, swap `multer` + disk for S3-compatible object storage and store object keys in `File.storageKey`.
- Socket.IO can be scaled horizontally with a Redis adapter; this repo uses the default in-memory adapter (fine for single-node or Compose).

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use only Docker for the database)

### 1. Database

```bash
# Example: create DB matching backend/.env.example
createdb scrw   # or use Docker: docker compose up -d db
```

### 2. Backend API

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET

npm ci
npx prisma migrate deploy
npm run dev
```

API listens on **http://localhost:4000** (default).

### 3. Frontend (see the UI)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. Vite proxies `/api`, `/health`, and `/socket.io` to the API on port 4000. Normal login and all workspace data need the backend; **dev bypass** (see below) only needs the frontend.

### Dev bypass login (testing only, no backend)

The sign-in page can show **Dev bypass login** when `frontend/.env` has `VITE_AUTH_DEV_BYPASS=true` (restart `npm run dev` after changing it). That path only stores a local session in the browser: **no API calls**, so it works even if the backend is off. You can click through the shell; loading workspaces, tasks, and files still requires the API and database.

### Try the flow

1. Register two users (e.g. two browsers or incognito).
2. User A creates a workspace, opens **Team**, invites User B’s email (Admin creates an invite token).
3. User B signs up/logs in with that email, opens **Accept invite**, pastes the token, joins the workspace.
4. Open **Board**: drag tasks between columns; the other user should see updates in near real time.
5. **Files**: upload, download; uploader or Admin can delete.

## Docker (production-style)

From the repo root:

```bash
# Optional: set a strong secret
set JWT_SECRET=your-long-random-string   # PowerShell: $env:JWT_SECRET="..."

docker compose up --build
```

- **Web**: http://localhost:8080 (nginx serves the SPA and proxies `/api` and `/socket.io` to the `api` service).
- **API**: http://localhost:4000 (direct; CORS is set for the web origin).

The API container runs `prisma migrate deploy` on startup, then starts the server.

## Environment variables

### Backend (`backend/`)

See `backend/.env.example`. Important:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Required in production; signs JWTs |
| `CORS_ORIGIN` | Comma-separated browser origins |
| `UPLOAD_DIR` | Directory for uploaded files |
| `UPLOAD_MAX_MB` | Max upload size (default 25) |
| `PORT` | API port (default 4000) |

### Frontend (`frontend/`)

Optional (needed if the API is on another origin than the SPA):

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Base URL for REST (e.g. `https://api.example.com`) |
| `VITE_SOCKET_URL` | Socket.IO origin (same as API if cross-origin) |

Leave both empty when using Vite dev proxy or the bundled nginx setup (same-origin `/api`).

## Security checklist (submission / production)

- Use a long random `JWT_SECRET` and HTTPS in production.
- Restrict `CORS_ORIGIN` to your real front-end URLs.
- Run Postgres with strong credentials and network isolation.
- Review upload limits and allowed MIME types if you expose the app publicly.

## License

Private / assessment use unless otherwise stated.
