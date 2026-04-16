import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getToken, isDevBypassToken } from "../../models";

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? "";

export function useWorkspaceSocket(
  workspaceId: string | undefined,
  onEvent: (event: string, payload: unknown) => void
) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!workspaceId) return;
    const token = getToken();
    if (!token || isDevBypassToken(token)) return;

    const socket = io(socketUrl || undefined, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });

    const onConnect = () => {
      socket.emit("workspace:join", workspaceId, (err?: string) => {
        if (err) console.warn("socket join failed", err);
      });
    };

    socket.on("connect", onConnect);
    socket.on("task:created", (p) => cb.current("task:created", p));
    socket.on("task:updated", (p) => cb.current("task:updated", p));
    socket.on("task:deleted", (p) => cb.current("task:deleted", p));
    socket.on("file:created", (p) => cb.current("file:created", p));
    socket.on("file:deleted", (p) => cb.current("file:deleted", p));

    return () => {
      socket.emit("workspace:leave", workspaceId);
      socket.removeAllListeners();
      socket.close();
    };
  }, [workspaceId]);
}
