import type { WorkspaceFile } from "./types";

/** Stored in localStorage when using frontend-only dev bypass (no backend). */
export const DEV_BYPASS_TOKEN = "__SCRW_DEV_BYPASS__";

export function isDevBypassToken(token: string | null | undefined): boolean {
  return token === DEV_BYPASS_TOKEN;
}

/** Mock user for offline UI testing; workspaces/API still need a real backend. */
export const DEV_BYPASS_USER = {
  id: "dev-local-user",
  email: "test@local.dev",
  name: "Test User (offline bypass)",
};

const prefix = import.meta.env.VITE_API_URL ?? "";

function url(path: string): string {
  if (path.startsWith("http")) return path;
  return `${prefix}${path}`;
}

export function getToken(): string | null {
  return localStorage.getItem("scrw_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("scrw_token", token);
  else localStorage.removeItem("scrw_token");
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
    if (body.error && typeof body.error === "object") return JSON.stringify(body.error);
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (!(init.body instanceof FormData)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  if (token && !isDevBypassToken(token)) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url(path), { ...init, headers });
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function uploadFile(workspaceId: string, file: File) {
  const token = getToken();
  const fd = new FormData();
  fd.append("file", file);
  const headers: HeadersInit = {};
  if (token && !isDevBypassToken(token)) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url(`/api/workspaces/${workspaceId}/files`), {
    method: "POST",
    headers,
    body: fd,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ file: WorkspaceFile }>;
}

export async function downloadFile(workspaceId: string, fileId: string, filename: string) {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token && !isDevBypassToken(token)) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url(`/api/workspaces/${workspaceId}/files/${fileId}/download`), {
    headers,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
