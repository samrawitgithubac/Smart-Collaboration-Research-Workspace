import { FormEvent, useRef, useState } from "react";
import { apiJson, downloadFile, uploadFile, type WorkspaceFile } from "../../models";

export function FilePanel({
  workspaceId,
  files,
  onFilesChange,
  isAdmin,
  currentUserId,
}: {
  workspaceId: string;
  files: WorkspaceFile[];
  onFilesChange: (files: WorkspaceFile[]) => void;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: FormEvent) {
    e.preventDefault();
    const f = inputRef.current?.files?.[0];
    if (!f) return;
    setError(null);
    setBusy(true);
    try {
      const res = await uploadFile(workspaceId, f);
      onFilesChange([res.file, ...files]);
      inputRef.current!.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    await apiJson(`/api/workspaces/${workspaceId}/files/${id}`, { method: "DELETE" });
    onFilesChange(files.filter((x) => x.id !== id));
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Files</h2>
      <form onSubmit={onPick} style={{ marginBottom: "0.75rem" }}>
        <input ref={inputRef} type="file" />
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginLeft: "0.5rem" }}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {files.map((f) => (
          <li
            key={f.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.45rem 0",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <span>
              <strong>{f.originalName}</strong>
              <span className="muted" style={{ marginLeft: "0.35rem" }}>
                ({Math.round(f.sizeBytes / 1024)} KB)
              </span>
            </span>
            <span style={{ display: "flex", gap: "0.35rem" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => downloadFile(workspaceId, f.id, f.originalName)}
              >
                Download
              </button>
              {isAdmin || f.uploadedById === currentUserId ? (
                <button type="button" className="btn btn-ghost" onClick={() => void onDelete(f.id)}>
                  Delete
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {files.length === 0 ? <p className="muted">No files yet.</p> : null}
    </div>
  );
}
