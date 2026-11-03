import { useState } from 'react';
import { api } from './api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.login(username.trim(), password);
      onLogin({ token: r.token, username: r.username, modules: r.modules || [] });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <h1>Multi-Domain LIMS</h1>
        <p className="muted">Sign in to register samples, enter results and review reports.</p>
        <label>Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
      </form>
    </div>
  );
}
