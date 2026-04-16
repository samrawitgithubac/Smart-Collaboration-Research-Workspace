import { Router } from "express";
import { TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireWorkspaceMember } from "../middleware/workspace.js";
import type { Server } from "socket.io";

export function createTasksRouter(io: Server | null) {
  const router = Router({ mergeParams: true });

  router.use(requireAuth, requireWorkspaceMember());

  function emitTaskEvent(workspaceId: string, event: string, payload: unknown) {
    io?.to(`workspace:${workspaceId}`).emit(event, payload);
  }

  router.get("/", async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const tasks = await prisma.task.findMany({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    res.json({ tasks });
  });

  router.post("/", async (req, res) => {
    const schema = z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(5000).optional(),
      status: z.nativeEnum(TaskStatus).optional(),
      assigneeId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { workspaceId } = req.params as { workspaceId: string };
    const maxPos = await prisma.task.aggregate({
      where: { workspaceId, status: parsed.data.status ?? TaskStatus.TODO },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;
    const task = await prisma.task.create({
      data: {
        workspaceId,
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status ?? TaskStatus.TODO,
        position,
        createdById: req.authUser!.id,
        assigneeId: parsed.data.assigneeId,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    emitTaskEvent(workspaceId, "task:created", { task });
    res.status(201).json({ task });
  });

  router.patch("/:taskId", async (req, res) => {
    const schema = z.object({
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(5000).nullable().optional(),
      status: z.nativeEnum(TaskStatus).optional(),
      position: z.number().int().min(0).optional(),
      assigneeId: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { workspaceId, taskId } = req.params as { workspaceId: string; taskId: string };
    const existing = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const patch = parsed.data;
    if (patch.assigneeId) {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: patch.assigneeId },
      });
      if (!member) {
        res.status(400).json({ error: "Assignee must be a workspace member" });
        return;
      }
    }
    const data = {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
    };
    const task = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    emitTaskEvent(workspaceId, "task:updated", { task });
    res.json({ task });
  });

  router.delete("/:taskId", async (req, res) => {
    const { workspaceId, taskId } = req.params as { workspaceId: string; taskId: string };
    const existing = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const isAdmin = req.workspace!.role === "ADMIN";
    if (!isAdmin && existing.createdById !== req.authUser!.id) {
      res.status(403).json({ error: "Only task author or admin can delete" });
      return;
    }
    await prisma.task.delete({ where: { id: taskId } });
    emitTaskEvent(workspaceId, "task:deleted", { taskId });
    res.status(204).send();
  });

  return router;
}
