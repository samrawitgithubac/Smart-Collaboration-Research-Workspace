import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireWorkspaceMember } from "../middleware/workspace.js";

const router = Router({ mergeParams: true });

const INVITE_DAYS = 7;

router.use(requireAuth);

router.post("/", requireWorkspaceMember("ADMIN"), async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    role: z.nativeEnum(WorkspaceRole).optional().default(WorkspaceRole.MEMBER),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const workspaceId = req.params.workspaceId;
  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const already = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: existingUser.id },
    });
    if (already) {
      res.status(409).json({ error: "User is already a member" });
      return;
    }
  }
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_DAYS);
  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId,
      email,
      token,
      role: parsed.data.role,
      expiresAt,
    },
  });
  res.status(201).json({
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      token: invite.token,
    },
  });
});

router.get("/", requireWorkspaceMember("ADMIN"), async (req, res) => {
  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId: req.params.workspaceId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
  });
  res.json({ invites });
});

const acceptRouter = Router();
acceptRouter.use(requireAuth);

acceptRouter.post("/accept", async (req, res) => {
  const schema = z.object({ token: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const invite = await prisma.workspaceInvite.findUnique({
    where: { token: parsed.data.token },
    include: { workspace: true },
  });
  if (!invite || invite.expiresAt < new Date()) {
    res.status(400).json({ error: "Invalid or expired invite" });
    return;
  }
  const userId = req.authUser!.id;
  const userEmail = req.authUser!.email.toLowerCase();
  if (invite.email !== userEmail) {
    res.status(403).json({ error: "This invite is for a different email" });
    return;
  }
  const existing = await prisma.workspaceMember.findFirst({
    where: { workspaceId: invite.workspaceId, userId },
  });
  if (existing) {
    await prisma.workspaceInvite.delete({ where: { id: invite.id } });
    res.json({ workspaceId: invite.workspaceId, alreadyMember: true });
    return;
  }
  await prisma.$transaction([
    prisma.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role,
      },
    }),
    prisma.workspaceInvite.delete({ where: { id: invite.id } }),
  ]);
  res.json({ workspaceId: invite.workspaceId, workspace: invite.workspace });
});

export { acceptRouter };
export default router;
