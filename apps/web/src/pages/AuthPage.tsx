import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuthSession, login, registerAccount } from "../api";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accountsAvailable, setAccountsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    getAuthSession()
      .then((session) => setAccountsAvailable(session.accountsAvailable))
      .catch((caught: Error) => setError(caught.message));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") await registerAccount({ email, password, displayName });
      else await login({ email, password });
      navigate("/create-nation");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell auth-shell">
      <section className="panel auth-panel">
        <p className="eyebrow">Statecraft Account</p>
        <h1>{mode === "register" ? "Create an account" : "Sign in"}</h1>
        {accountsAvailable === false ? (
          <div className="stack" role="status">
            <p className="form-error">Persistent account mode is not enabled on this server.</p>
            <Link className="primary-action" to="/demo">
              Enter Demo Nation
            </Link>
            <Link to="/">Back to landing</Link>
          </div>
        ) : (
          <form className="stack" onSubmit={submit} aria-busy={accountsAvailable === null || busy}>
            {mode === "register" ? (
              <label>
                Display name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  minLength={2}
                  maxLength={60}
                  required
                />
              </label>
            ) : null}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                minLength={4}
                maxLength={200}
                required
              />
              <small>Minimum 4 characters.</small>
            </label>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="primary-action" disabled={busy || accountsAvailable !== true}>
              {accountsAvailable === null
                ? "Checking..."
                : busy
                  ? "Working..."
                  : mode === "register"
                    ? "Register"
                    : "Sign in"}
            </button>
          </form>
        )}
        {accountsAvailable !== false ? (
          <p>
            {mode === "register" ? (
              <Link to="/login">Already registered? Sign in</Link>
            ) : (
              <Link to="/register">Create an account</Link>
            )}
          </p>
        ) : null}
      </section>
    </main>
  );
}
