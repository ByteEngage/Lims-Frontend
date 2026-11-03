import { useEffect, useState } from 'react';
import { api, isNumeric, limitLabel, RESULT_TYPES } from './api.js';

export default function Config() {
  const [domains, setDomains] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => api.domains().then(setDomains).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function run(fn, ok) {
    setError(''); setMessage('');
    try { await fn(); await load(); if (ok) setMessage(ok); return true; } catch (e) { setError(e.message); return false; }
  }

  if (!domains) return <p className="muted">Loading test setup</p>;

  const testTypes = domains.flatMap((d) => d.testTypes.map((t) => ({ ...t, domain: d.name })));
  const params = testTypes.flatMap((t) => t.parameters.map((p) => ({ ...p, test: t.name })));
  const numericParams = params.filter(isNumeric);
  const noLimits = numericParams.filter((p) => p.lower == null || p.upper == null);

  return (
    <>
      <h2>Test setup</h2>
      <p className="muted">Add domains, tests and parameters. A parameter is a number (then it needs a lower and an upper limit), a pass or fail result, or an absent or detected result. A test can only be used for samples when all its numeric parameters have both limits.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {noLimits.length > 0 && (
        <p className="notice bad">{noLimits.length} parameter(s) still need limits: {noLimits.map((p) => `${p.test}: ${p.name}`).join('; ')}.</p>
      )}

      <div className="grid2">
        <MiniForm title="Add domain" fields={[{ k: 'name', label: 'Domain name', max: 100 }]}
          onSubmit={(v) => run(() => api.addDomain(v.name), 'Domain added.')} />
        <MiniForm title="Add test" fields={[
          { k: 'domainId', label: 'Domain', options: domains.map((d) => [d.id, d.name]) },
          { k: 'name', label: 'Test name', max: 100 }]}
          onSubmit={(v) => run(() => api.addTestType(Number(v.domainId), v.name), 'Test added.')} />
        <MiniForm title="Add parameter" fields={[
          { k: 'testTypeId', label: 'Test', options: testTypes.map((t) => [t.id, `${t.domain}: ${t.name}`]) },
          { k: 'name', label: 'Parameter name', max: 100 },
          { k: 'resultType', label: 'Result type', options: RESULT_TYPES },
          { k: 'unit', label: 'Unit (numbers only)', max: 30, optional: true },
          { k: 'method', label: 'Test method or standard (optional)', max: 150, optional: true }]}
          onSubmit={(v) => run(() => api.addParameter(Number(v.testTypeId), v.name, v.unit || '', v.resultType, v.method || ''),
            v.resultType === 'Numeric' ? 'Parameter added. Now set its limits.' : 'Parameter added.')} />
        <MiniForm title="Set limits" fields={[
          { k: 'parameterId', label: 'Numeric parameter', options: numericParams.map((p) => [p.id, `${p.test}: ${p.name}`]) },
          { k: 'standardName', label: 'Standard or specification name', max: 150, optional: true },
          { k: 'lower', label: 'Lower limit', type: 'number' }, { k: 'upper', label: 'Upper limit', type: 'number' }]}
          onSubmit={(v) => run(() => api.setLimits({
            parameterId: Number(v.parameterId), standardName: v.standardName || '',
            lower: Number(v.lower), upper: Number(v.upper) }), 'Limits saved. Results already entered keep the limits they were checked against.')} />
      </div>

      <h3>Current setup</h3>
      {domains.map((d) => (
        <div className="panel" key={d.id}>
          <h4>{d.name}</h4>
          {d.testTypes.length === 0 && <p className="muted">No tests yet.</p>}
          {d.testTypes.map((t) => (
            <div key={t.id} className="indent">
              <strong>{t.name}</strong>
              {t.parameters.length === 0 && <span className="muted"> has no parameters yet</span>}
              <ul>
                {t.parameters.map((p) => (
                  <li key={p.id}>
                    {p.name}{p.unit ? ` (${p.unit})` : ''}: {limitLabel(p)}
                    {isNumeric(p) && p.standardName && p.lower != null ? <span className="muted"> ({p.standardName})</span> : null}
                    {p.method ? <span className="muted"> Method: {p.method}.</span> : null}
                    {isNumeric(p) && (p.lower == null || p.upper == null) && <strong className="out-text"> Needs limits</strong>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function MiniForm({ title, fields, onSubmit }) {
  const [v, setV] = useState({});
  async function submit(e) {
    e.preventDefault();
    const ok = await onSubmit(v);
    if (ok) setV({});
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h3>{title}</h3>
      {fields.map((f) => (
        <label key={f.k}>{f.label}
          {f.options ? (
            <select value={v[f.k] ?? ''} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} required>
              <option value="">Choose</option>
              {f.options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          ) : (
            <input type={f.type || 'text'} step="any" maxLength={f.max} value={v[f.k] ?? ''}
              onChange={(e) => setV({ ...v, [f.k]: e.target.value })} required={!f.optional} />
          )}
        </label>
      ))}
      <button className="primary">Save</button>
    </form>
  );
}
