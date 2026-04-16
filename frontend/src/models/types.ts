export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export type Task = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  createdById: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string };
};

export type WorkspaceFile = {
  id: string;
  workspaceId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: string;
  uploadedBy: { id: string; name: string; email: string };
};

export type WorkspaceRole = "ADMIN" | "MEMBER";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  joinedAt: string;
};

export type WorkspaceDetail = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    members: Array<{
      id: string;
      role: WorkspaceRole;
      joinedAt: string;
      user: { id: string; email: string; name: string };
    }>;
    yourRole: WorkspaceRole;
  };
};
