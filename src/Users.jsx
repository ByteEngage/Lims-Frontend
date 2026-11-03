import { useEffect, useState } from 'react';
import { api, MODULE_LABELS, NEEDS_VIEW } from './api.js';

export default function Users({ session }) {
  const [users, setUsers] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editId, setEditId] = useState(null);

  const load = () => Promise.all([api.users(), api.userMeta()])
    .then(([u, m]) => { setUsers(u); setMeta(m); })
    .catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function run(fn, ok) {
    setError(''); setMessage('');
    try { await fn(); await load(); if (ok) setMessage(ok); return true; } catch (e) { setError(e.message); return false; }
  }

  if (!users || !meta) return <>{error ? <p className="error" role="alert">{error}</p> : <p className="muted">Loading users</p>}</>;

  const editing = users.find((u) => u.id === editId) || null;

  return (
    <>
      <h2>Users and access</h2>
      <p className="muted">Add or remove users and tick the modules each person can use. There are no roles: a person can do exactly what their ticked modules allow. Changes apply the next time the person opens or reloads the app.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}

      <div className="scroll">
        <table className="users-table">
          <thead><tr><th>Username</th><th>Module access</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const self = u.username === session.username;
              return (
                <tr key={u.id} className={u.id === editId ? 'picked' : ''}>
                  <td><strong>{u.username}</strong>{self && <span className="muted"> (you)</span>}</td>
                  <td>
                    <span className="mods">{u.modules.map((m) => <span className="mod" key={m}>{MODULE_LABELS[m] || m}</span>)}</span>
                  </td>
                  <td>
                    <div className="row">
                      <button disabled={self} title={self ? 'You cannot change your own access' : ''}
                        onClick={() => { setEditId(u.id === editId ? null : u.id); setMessage(''); setError(''); }}>
                        {u.id === editId ? 'Close' : 'Manage'}
                      </button>
                      <button className="danger" disabled={self} title={self ? 'You cannot remove your own account' : ''}
                        onClick={() => {
                          if (window.confirm(`Remove ${u.username}? They will no longer be able to sign in. Their past work stays in the records.`))
                            run(() => api.removeUser(u.id), `${u.username} was removed.`).then(() => setEditId(null));
                        }}>Remove</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditPanel key={editing.id} user={editing} meta={meta}
          onSave={(modules) => run(() => api.setAccess(editing.id, modules), `Access updated for ${editing.username}.`)}
          onPassword={(pw) => run(() => api.resetPassword(editing.id, pw), `Password changed for ${editing.username}.`)} />
      )}

      <AddUser meta={meta} onAdd={(b) => run(() => api.addUser(b), `User ${b.username} added.`)} />
    </>
  );
}

// Checkboxes only. Ticking a module that works on samples also ticks "View samples", which then stays ticked.
function ModulePicker({ meta, value, onChange }) {
  const needsView = value.some((m) => NEEDS_VIEW.includes(m));
  function toggle(m) {
    if (m === 'ViewSamples' && needsView) return;
    let next = value.includes(m) ? value.filter((x) => x !== m) : [...value, m];
    if (next.some((x) => NEEDS_VIEW.includes(x)) && !next.includes('ViewSamples')) next = [...next, 'ViewSamples'];
    onChange(next);
  }
  return (
    <fieldset>
      <legend>Module access</legend>
      <p className="muted small">Tick what this person can open and do. Modules that work on samples also include View samples.</p>
      <div className="checks">
        {meta.modules.map((m) => (
          <label key={m} className="check">
            <input type="checkbox" checked={value.includes(m)} disabled={m === 'ViewSamples' && needsView}
              onChange={() => toggle(m)} /> {MODULE_LABELS[m] || m}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EditPanel({ user, meta, onSave, onPassword }) {
  const [modules, setModules] = useState(user.modules);
  const [pw, setPw] = useState('');

  return (
    <div className="panel">
      <h3>Manage {user.username}</h3>
      <ModulePicker meta={meta} value={modules} onChange={setModules} />
      <button className="primary" disabled={modules.length === 0} onClick={() => onSave(modules)}>Save access</button>
      {modules.length === 0 && <span className="muted small"> Tick at least one module.</span>}

      <hr />
      <h4>Reset password</h4>
      <form className="row" onSubmit={(e) => { e.preventDefault(); onPassword(pw).then((ok) => ok && setPw('')); }}>
        <label className="grow">New password
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} maxLength={72} />
        </label>
        <button className="ghost" style={{ alignSelf: 'end' }}>Change password</button>
      </form>
      <p className="muted small">At least 8 characters, with a letter and a number.</p>
    </div>
  );
}

function AddUser({ meta, onAdd }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [modules, setModules] = useState([]);

  if (!open) return <button className="primary" onClick={() => setOpen(true)}>Add user</button>;

  return (
    <form className="panel" onSubmit={async (e) => {
      e.preventDefault();
      const ok = await onAdd({ username, password, moduleNames: modules });
      if (ok) { setUsername(''); setPassword(''); setModules([]); setOpen(false); }
    }}>
      <h3>Add user</h3>
      <div className="grid2">
        <label>Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={50}
            pattern="[A-Za-z0-9._\-]{3,50}" title="3 to 50 characters: letters, numbers, dot, dash or underscore" autoComplete="off" />
        </label>
        <label>Password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} />
        </label>
      </div>
      <p className="muted small">Password: at least 8 characters, with a letter and a number.</p>
      <ModulePicker meta={meta} value={modules} onChange={setModules} />
      <div className="row">
        <button className="primary" disabled={modules.length === 0}>Create user</button>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {modules.length === 0 && <p className="muted small">Tick at least one module.</p>}
    </form>
  );
}
