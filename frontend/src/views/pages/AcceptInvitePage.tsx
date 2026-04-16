import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../../models";
import { useAuth } from "../../controllers/auth/AuthContext";

export function AcceptInvitePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      nav("/login");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await apiJson<{ workspaceId: string }>("/api/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: token.trim() }),
      });
      nav(`/workspaces/${res.workspaceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout" style={{ maxWidth: 480 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Accept invite</h1>
        <p className="muted">Paste the invite token that a workspace admin shared with you.</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="token">Invite token</label>
            <textarea id="token" rows={3} value={token} onChange={(e) => setToken(e.target.value)} required />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Joining…" : "Join workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
