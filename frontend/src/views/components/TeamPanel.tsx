import { FormEvent, useState } from "react";
import { apiJson, type WorkspaceDetail, type WorkspaceRole } from "../../models";

export function TeamPanel({
  workspaceId,
  detail,
  onRefresh,
}: {
  workspaceId: string;
  detail: WorkspaceDetail["workspace"];
  onRefresh: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("MEMBER");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = detail.yourRole === "ADMIN";

  async function invite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setToken(null);
    try {
      const res = await apiJson<{ invite: { token: string; email: string } }>(
        `/api/workspaces/${workspaceId}/invites`,
        {
          method: "POST",
          body: JSON.stringify({ email, role }),
        }
      );
      setToken(res.invite.token);
      setEmail("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    }
  }

  async function setMemberRole(memberId: string, next: WorkspaceRole) {
    await apiJson(`/api/workspaces/${workspaceId}/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: next }),
    });
    onRefresh();
  }

  async function removeMember(memberId: string) {
    await apiJson(`/api/workspaces/${workspaceId}/members/${memberId}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Team</h2>
      {isAdmin ? (
        <form onSubmit={invite} style={{ marginBottom: "1rem" }}>
          <div className="field">
            <label>Invite by email</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ flex: "1 1 200px" }}
              />
              <select value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)}>
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button className="btn btn-primary" type="submit">
                Create invite
              </button>
            </div>
          </div>
          {token ? (
            <p className="muted">
              Share this token with the invitee (they paste it under Accept invite):{" "}
              <code style={{ wordBreak: "break-all" }}>{token}</code>
            </p>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
        </form>
      ) : (
        <p className="muted">Only admins can invite members or change roles.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {detail.members.map((m) => (
          <li
            key={m.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div>
              <strong>{m.user.name}</strong>
              <div className="muted">{m.user.email}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span className={`badge ${m.role === "ADMIN" ? "badge-admin" : "badge-member"}`}>{m.role}</span>
              {isAdmin ? (
                <>
                  <select
                    value={m.role}
                    onChange={(e) => void setMemberRole(m.id, e.target.value as WorkspaceRole)}
                    style={{ padding: "0.25rem" }}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button type="button" className="btn btn-ghost" onClick={() => void removeMember(m.id)}>
                    Remove
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
