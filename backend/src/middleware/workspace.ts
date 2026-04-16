import type { NextFunction, Request, Response } from "express";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type WorkspaceContext = {
  workspaceId: string;
  role: WorkspaceRole;
  memberId: string;
};

declare global {
  namespace Express {
    interface Request {
      workspace?: WorkspaceContext;
    }
  }
}

export function requireWorkspaceMember(minRole?: "MEMBER" | "ADMIN") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const workspaceId = (req.params as { workspaceId: string }).workspaceId;
    const userId = req.authUser?.id;
    if (!userId || !workspaceId) {
      res.status(400).json({ error: "Workspace context required" });
      return;
    }
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) {
      res.status(403).json({ error: "Not a member of this workspace" });
      return;
    }
    if (minRole === "ADMIN" && member.role !== WorkspaceRole.ADMIN) {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    req.workspace = {
      workspaceId,
      role: member.role,
      memberId: member.id,
    };
    next();
  };
}
