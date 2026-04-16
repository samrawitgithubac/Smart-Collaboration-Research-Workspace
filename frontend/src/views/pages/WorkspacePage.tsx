import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../controllers/auth/AuthContext";
import { apiJson, type Task, type WorkspaceDetail, type WorkspaceFile } from "../../models";
import { useWorkspaceSocket } from "../../controllers/hooks/useWorkspaceSocket";
import { KanbanBoard } from "../components/KanbanBoard";
import { FilePanel } from "../components/FilePanel";
import { TeamPanel } from "../components/TeamPanel";

type Tab = "board" | "files" | "team";

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("board");

  const detailQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiJson<WorkspaceDetail>(`/api/workspaces/${workspaceId}`),
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiJson<{ tasks: Task[] }>(`/api/workspaces/${workspaceId}/tasks`),
  });

  const filesQuery = useQuery({
    queryKey: ["files", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiJson<{ files: WorkspaceFile[] }>(`/api/workspaces/${workspaceId}/files`),
  });

  const setTasksCache = useCallback(
    (updater: (prev: Task[]) => Task[]) => {
      qc.setQueryData<{ tasks: Task[] }>(["tasks", workspaceId], (old) => {
        const base = old?.tasks ?? [];
        return { tasks: updater(base) };
      });
    },
    [qc, workspaceId]
  );

  const setFilesCache = useCallback(
    (updater: (prev: WorkspaceFile[]) => WorkspaceFile[]) => {
      qc.setQueryData<{ files: WorkspaceFile[] }>(["files", workspaceId], (old) => {
        const base = old?.files ?? [];
        return { files: updater(base) };
      });
    },
    [qc, workspaceId]
  );

  const onSocket = useCallback(
    (event: string, payload: unknown) => {
      if (event === "task:created") {
        const { task } = payload as { task: Task };
        setTasksCache((prev) => [...prev.filter((t) => t.id !== task.id), task]);
      }
      if (event === "task:updated") {
        const { task } = payload as { task: Task };
        setTasksCache((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      }
      if (event === "task:deleted") {
        const { taskId } = payload as { taskId: string };
        setTasksCache((prev) => prev.filter((t) => t.id !== taskId));
      }
      if (event === "file:created") {
        const { file } = payload as { file: WorkspaceFile };
        setFilesCache((prev) => [file, ...prev.filter((f) => f.id !== file.id)]);
      }
      if (event === "file:deleted") {
        const { fileId } = payload as { fileId: string };
        setFilesCache((prev) => prev.filter((f) => f.id !== fileId));
      }
    },
    [setFilesCache, setTasksCache]
  );

  useWorkspaceSocket(workspaceId, onSocket);

  const refreshDetail = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
  }, [qc, workspaceId]);

  const detail = detailQuery.data?.workspace;
  const isAdmin = detail?.yourRole === "ADMIN";

  const taskList = useMemo(() => tasksQuery.data?.tasks ?? [], [tasksQuery.data?.tasks]);
  const fileList = useMemo(() => filesQuery.data?.files ?? [], [filesQuery.data?.files]);

  if (detailQuery.isError) {
    return (
      <div className="layout">
        <p className="error">You cannot open this workspace.</p>
        <button type="button" className="btn" onClick={() => nav("/")}>
          Back
        </button>
      </div>
    );
  }

  if (!workspaceId || !detail) {
    return (
      <div className="layout">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <button type="button" className="btn btn-ghost" onClick={() => nav("/")} style={{ marginBottom: "0.25rem" }}>
            ← Workspaces
          </button>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>{detail.name}</h1>
          <p className="muted" style={{ margin: "0.15rem 0 0" }}>
            {user?.name} ·{" "}
            <span className={`badge ${isAdmin ? "badge-admin" : "badge-member"}`}>{detail.yourRole}</span>
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <nav className="tabs">
        <button type="button" className={`tab ${tab === "board" ? "active" : ""}`} onClick={() => setTab("board")}>
          Board
        </button>
        <button type="button" className={`tab ${tab === "files" ? "active" : ""}`} onClick={() => setTab("files")}>
          Files
        </button>
        <button type="button" className={`tab ${tab === "team" ? "active" : ""}`} onClick={() => setTab("team")}>
          Team
        </button>
      </nav>

      {tab === "board" ? (
        <KanbanBoard
          workspaceId={workspaceId}
          tasks={taskList}
          onTasksChange={(next) => qc.setQueryData(["tasks", workspaceId], { tasks: next })}
          members={detail.members}
          currentUserId={user?.id ?? ""}
          isAdmin={isAdmin}
        />
      ) : null}

      {tab === "files" ? (
        <FilePanel
          workspaceId={workspaceId}
          files={fileList}
          onFilesChange={(next) => qc.setQueryData(["files", workspaceId], { files: next })}
          isAdmin={isAdmin}
          currentUserId={user?.id ?? ""}
        />
      ) : null}

      {tab === "team" ? <TeamPanel workspaceId={workspaceId} detail={detail} onRefresh={refreshDetail} /> : null}
    </div>
  );
}
