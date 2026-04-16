import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../controllers/auth/AuthContext";

const showDevBypass = import.meta.env.VITE_AUTH_DEV_BYPASS === "true";

export function LoginPage() {
  const { login, devBypass } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Sign in</h1>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1rem" }}>
          No account? <Link to="/register">Create one</Link>
        </p>
        {showDevBypass ? (
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
            <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.8rem" }}>
              Testing: sign in locally without the API (workspaces and data need the backend running).
            </p>
            <button
              type="button"
              className="btn"
              disabled={busy}
              style={{ width: "100%" }}
              onClick={() => {
                setError(null);
                devBypass();
                nav("/");
              }}
            >
              Dev bypass login
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
