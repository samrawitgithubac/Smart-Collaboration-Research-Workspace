import type { Server, Socket } from "socket.io";
import { verifyToken } from "./lib/jwt.js";
import { prisma } from "./lib/prisma.js";

declare module "socket.io" {
  interface SocketData {
    user: { id: string; email: string; name: string };
  }
}

export function attachRealtime(io: Server) {
  io.use(async (socket: Socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (typeof socket.handshake.query.token === "string" ? socket.handshake.query.token : undefined);
    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }
    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true },
      });
      if (!user) {
        next(new Error("Unauthorized"));
        return;
      }
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("workspace:join", async (workspaceId: string, cb?: (err?: string) => void) => {
      const userId = socket.data.user?.id as string | undefined;
      if (!userId || typeof workspaceId !== "string") {
        cb?.("Invalid workspace");
        return;
      }
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
      });
      if (!member) {
        cb?.("Forbidden");
        return;
      }
      await socket.join(`workspace:${workspaceId}`);
      cb?.();
    });

    socket.on("workspace:leave", (workspaceId: string) => {
      if (typeof workspaceId === "string") void socket.leave(`workspace:${workspaceId}`);
    });
  });
}
