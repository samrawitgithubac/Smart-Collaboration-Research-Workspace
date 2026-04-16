import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { workspaceSlugFromName } from "../lib/slug.js";
import { requireAuth } from "../middleware/auth.js";
import { requireWorkspaceMember } from "../middleware/workspace.js";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const userId = req.authUser!.id;
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: { joinedAt: "desc" },
  });
  res.json({
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  });
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const userId = req.authUser!.id;
  const slug = workspaceSlugFromName(parsed.data.name);
  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      slug,
      members: {
        create: { userId, role: WorkspaceRole.ADMIN },
      },
    },
  });
  res.status(201).json({ workspace });
});

router.get("/:workspaceId", requireWorkspaceMember(), async (req, res) => {
  const { workspaceId } = req.params;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  res.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      createdAt: workspace.createdAt,
      members: workspace.members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      yourRole: req.workspace!.role,
    },
  });
});

router.patch("/:workspaceId", requireWorkspaceMember("ADMIN"), async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (!parsed.data.name) {
    res.status(400).json({ error: "No updates" });
    return;
  }
  const updated = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data: { name: parsed.data.name },
  });
  res.json({ workspace: updated });
});

router.delete("/:workspaceId", requireWorkspaceMember("ADMIN"), async (req, res) => {
  await prisma.workspace.delete({ where: { id: req.params.workspaceId } });
  res.status(204).send();
});

router.patch(
  "/:workspaceId/members/:memberId/role",
  requireWorkspaceMember("ADMIN"),
  async (req, res) => {
    const schema = z.object({ role: z.nativeEnum(WorkspaceRole) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const member = await prisma.workspaceMember.findFirst({
      where: { id: req.params.memberId, workspaceId: req.params.workspaceId },
    });
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (member.userId === req.authUser!.id && parsed.data.role !== WorkspaceRole.ADMIN) {
      res.status(400).json({ error: "You cannot demote yourself from admin" });
      return;
    }
    const updated = await prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role: parsed.data.role },
    });
    res.json({ member: updated });
  }
);

router.delete(
  "/:workspaceId/members/:memberId",
  requireWorkspaceMember("ADMIN"),
  async (req, res) => {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: req.params.memberId, workspaceId: req.params.workspaceId },
    });
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (member.userId === req.authUser!.id) {
      res.status(400).json({ error: "Cannot remove yourself" });
      return;
    }
    await prisma.workspaceMember.delete({ where: { id: member.id } });
    res.status(204).send();
  }
);

export default router;
