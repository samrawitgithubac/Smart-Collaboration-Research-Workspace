import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspaces.js";
import inviteRoutes, { acceptRouter } from "./routes/invites.js";
import { createTasksRouter } from "./routes/tasks.js";
import { createFilesRouter } from "./routes/files.js";
import { attachRealtime } from "./realtime.js";

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? [
  "http://localhost:5173",
];

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
});

attachRealtime(io);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "scrw-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/workspaces/:workspaceId/tasks", createTasksRouter(io));
app.use("/api/workspaces/:workspaceId/files", createFilesRouter(io));
app.use("/api/workspaces/:workspaceId/invites", inviteRoutes);
app.use("/api/invites", acceptRouter);
app.use("/api/workspaces", workspaceRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

httpServer.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
