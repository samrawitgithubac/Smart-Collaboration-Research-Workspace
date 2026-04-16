import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireWorkspaceMember } from "../middleware/workspace.js";
import type { Server } from "socket.io";

const MAX_SIZE_MB = Number(process.env.UPLOAD_MAX_MB ?? 25);
const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

function ensureUploadDir() {
  return fs.mkdir(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

export function createFilesRouter(io: Server | null) {
  const router = Router({ mergeParams: true });

  router.use(requireAuth, requireWorkspaceMember());

  function emitFileEvent(workspaceId: string, event: string, payload: unknown) {
    io?.to(`workspace:${workspaceId}`).emit(event, payload);
  }

  router.get("/", async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const files = await prisma.file.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
    });
    res.json({ files });
  });

  router.post("/", upload.single("file"), async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const f = req.file;
    if (!f) {
      res.status(400).json({ error: "file field required" });
      return;
    }
    const relKey = f.filename;
    const record = await prisma.file.create({
      data: {
        workspaceId,
        storageKey: relKey,
        originalName: f.originalname,
        mimeType: f.mimetype,
        sizeBytes: f.size,
        uploadedById: req.authUser!.id,
      },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
    });
    emitFileEvent(workspaceId, "file:created", { file: record });
    res.status(201).json({ file: record });
  });

  router.get("/:fileId/download", async (req, res) => {
    const { workspaceId, fileId } = req.params as { workspaceId: string; fileId: string };
    const record = await prisma.file.findFirst({ where: { id: fileId, workspaceId } });
    if (!record) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const abs = path.join(uploadDir, record.storageKey);
    res.download(abs, record.originalName, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: "Download failed" });
    });
  });

  router.delete("/:fileId", async (req, res) => {
    const { workspaceId, fileId } = req.params as { workspaceId: string; fileId: string };
    const record = await prisma.file.findFirst({ where: { id: fileId, workspaceId } });
    if (!record) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const isAdmin = req.workspace!.role === "ADMIN";
    const isUploader = record.uploadedById === req.authUser!.id;
    if (!isAdmin && !isUploader) {
      res.status(403).json({ error: "Only the uploader or an admin can delete this file" });
      return;
    }
    const abs = path.join(uploadDir, record.storageKey);
    await prisma.file.delete({ where: { id: record.id } });
    try {
      await fs.unlink(abs);
    } catch {
      /* ignore missing file on disk */
    }
    emitFileEvent(workspaceId, "file:deleted", { fileId });
    res.status(204).send();
  });

  return router;
}
