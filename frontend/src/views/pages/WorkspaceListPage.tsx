import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../controllers/auth/AuthContext";
import { apiJson, type WorkspaceSummary } from "../../models";

export function WorkspaceListPage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => apiJson<{ workspaces: WorkspaceSummary[] }>("/api/workspaces"),
  });

  const create = useMutation({
    mutationFn: () => apiJson<{ workspace: { id: string; name: string; slug: string } }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
    onSuccess: () => {
      setName("");
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate();
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Workspaces</h1>
          <p className="muted" style={{ margin: "0.15rem 0 0" }}>
            Signed in as {user?.name} ({user?.email})
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="btn btn-ghost" to="/invite">
            Accept invite
          </Link>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>New workspace</h2>
        <form onSubmit={onCreate} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            placeholder="Research project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ flex: "1 1 220px", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
          <button className="btn btn-primary" type="submit" disabled={create.isPending}>
            Create
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </div>

      {isLoading ? <p className="muted">Loading…</p> : null}
      <div style={{ display: "grid", gap: "0.65rem" }}>
        {(data?.workspaces ?? []).map((w) => (
          <Link
            key={w.id}
            to={`/workspaces/${w.id}`}
            className="card"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
              <strong>{w.name}</strong>
              <span className={`badge ${w.role === "ADMIN" ? "badge-admin" : "badge-member"}`}>{w.role}</span>
            </div>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              {w.slug}
            </p>
          </Link>
        ))}
      </div>
      {!isLoading && (data?.workspaces?.length ?? 0) === 0 ? (
        <p className="muted">No workspaces yet. Create one to get started.</p>
      ) : null}
    </div>
  );
}
