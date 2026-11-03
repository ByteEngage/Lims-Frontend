import { useEffect, useState } from 'react';
import { api, fmtDate } from './api.js';

const EMPTY = { sample: '', report: '', user: '', act: '' };

export default function Audit() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = (f) => { setError(''); return api.audit(f).then(setRows).catch((e) => setError(e.message)); };
  useEffect(() => { load(EMPTY); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <h2>Audit trail</h2>
      <p className="muted">The latest 200 matching actions, newest first. Entries are added by the system and cannot be edited here.</p>
      {error && <p className="error" role="alert">{error}</p>}

      <form className="panel" onSubmit={(e) => { e.preventDefault(); load(form); }}>
        <div className="grid4">
          <label>Sample ID<input value={form.sample} onChange={set('sample')} placeholder="S-2026-0001" /></label>
          <label>Report ID<input value={form.report} onChange={set('report')} placeholder="R-2026-0001" /></label>
          <label>User<input value={form.user} onChange={set('user')} /></label>
          <label>Action<input value={form.act} onChange={set('act')} placeholder="for example Approve" /></label>
        </div>
        <div className="row">
          <button className="primary">Apply filters</button>
          <button type="button" className="ghost" onClick={() => { setForm(EMPTY); load(EMPTY); }}>Clear filters</button>
        </div>
      </form>

      {rows === null ? <p className="muted">Loading audit trail</p> : rows.length === 0 ? <p className="empty">No entries match.</p> : (
        <div className="scroll">
          <table className="audit-table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Sample ID</th><th>Report ID</th><th>Item</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{fmtDate(r.timestamp)}</td>
                  <td>{r.username}</td><td>{r.action}</td>
                  <td className="num">{r.sampleCode}</td><td className="num">{r.reportNumber}</td>
                  <td>{r.entity} {r.entityId}</td><td>{r.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
