import { useEffect, useState } from 'react';
import { api, can, fmtDate, STATUS_LABELS } from './api.js';

export function StatusChip({ status }) {
  return <span className={`chip s-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

export default function Samples({ session, onOpen }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const canRegister = can(session, 'RegisterSamples');

  const load = () => api.samples().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <>
      <h2>Samples</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {canRegister && <RegisterForm onDone={(id) => { load(); onOpen(id); }} />}
      {rows === null ? <p className="muted">Loading samples</p> :
        rows.length === 0 ? <p className="empty">No samples yet. Register the first one to start tracking it.</p> : (
          <div className="scroll">
            <table className="samples-table">
              <thead><tr><th>Sample ID</th><th>Report ID</th><th>Client</th><th>Domain</th><th>Description</th><th>Status</th><th>Registered</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => onOpen(r.id)}>
                    <td><button className="link" onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}>{r.sampleCode}</button></td>
                    <td className="num">{r.reportNumber || <span className="muted">Not issued</span>}</td>
                    <td>{r.clientName}</td><td>{r.domain}</td><td>{r.description}</td>
                    <td><StatusChip status={r.status} /></td>
                    <td className="num">{fmtDate(r.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}

function RegisterForm({ onDone }) {
  const [domains, setDomains] = useState([]);
  const [domainId, setDomainId] = useState('');
  const [client, setClient] = useState('');
  const [desc, setDesc] = useState('');
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { api.domains().then(setDomains).catch((e) => setError(e.message)); }, []);
  const domain = domains.find((d) => String(d.id) === String(domainId));

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      const r = await api.register({ domainId: Number(domainId), clientName: client, description: desc, testTypeIds: picked });
      setClient(''); setDesc(''); setPicked([]); setOpen(false);
      onDone(r.id);
    } catch (err) { setError(err.message); }
  }

  if (!open) return <button className="primary" onClick={() => setOpen(true)}>Register sample</button>;

  return (
    <form className="panel" onSubmit={submit}>
      <h3>Register sample</h3>
      <div className="grid2">
        <label>Client name<input value={client} maxLength={150} onChange={(e) => setClient(e.target.value)} required /></label>
        <label>Domain
          <select value={domainId} onChange={(e) => { setDomainId(e.target.value); setPicked([]); }} required>
            <option value="">Choose a domain</option>
            {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      </div>
      <label>Sample description<input value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} required /></label>
      <fieldset>
        <legend>Tests to run</legend>
        {!domain ? <p className="muted">Choose a domain to see its tests.</p> :
          domain.testTypes.length === 0 ? <p className="muted">This domain has no tests yet. An administrator can add them in Test setup.</p> :
            domain.testTypes.map((t) => {
              const ready = t.parameters.length > 0 && t.parameters.every((p) => p.resultType !== 'Numeric' || (p.lower != null && p.upper != null));
              return (
                <label key={t.id} className="check">
                  <input type="checkbox" checked={picked.includes(t.id)} disabled={!ready} onChange={() => toggle(t.id)} /> {t.name}
                  {!ready && <span className="muted"> (not ready: needs parameters with lower and upper limits)</span>}
                </label>
              );
            })}
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button className="primary">Save sample</button>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
