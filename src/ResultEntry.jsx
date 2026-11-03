import { useEffect, useState } from 'react';
import { api, CHOICES, EXPECTED, isNumeric, isOutside, limitLabel } from './api.js';

export default function ResultEntry({ focusSampleId, onOpenSample }) {
  const [items, setItems] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => api.worklist().then((rows) => {
    setItems(rows);
    setSelectedId((cur) => {
      if (cur && rows.some((r) => r.sampleTestId === cur)) return cur;
      const focus = focusSampleId ? rows.find((r) => r.sampleId === focusSampleId) : null;
      return focus ? focus.sampleTestId : null;
    });
  }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const selected = items?.find((r) => r.sampleTestId === selectedId) || null;

  return (
    <>
      <h2>Result entry</h2>
      <p className="muted">Tests waiting for results. Enter a result for every parameter. Results outside the limits, or not the expected result, are shown in bold.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}

      {items === null ? <p className="muted">Loading worklist</p> :
        items.length === 0 ? <p className="empty">Nothing is waiting for results right now.</p> : (
          <div className="scroll">
            <table className="worklist-table">
              <thead><tr><th>Sample</th><th>Client</th><th>Domain</th><th>Test</th><th>Parameters</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.sampleTestId} className={r.sampleTestId === selectedId ? 'picked' : ''}>
                    <td><button className="link" to="frm" onClick={() => onOpenSample(r.sampleId)}>{r.sampleCode}</button></td>
                    <td>{r.clientName}</td><td>{r.domain}</td><td>{r.testType}</td>
                    <td className="num">{r.parameters.length}</td>
                    <td><button className={r.sampleTestId === selectedId ? 'ghost' : 'primary'}
                      onClick={() => { setSelectedId(r.sampleTestId); setMessage(''); setError(''); }}>
                      {r.sampleTestId === selectedId ? 'Selected' : 'Enter results'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {selected && (
        <EntryForm key={selected.sampleTestId} item={selected}
          onSaved={(res) => {
            setMessage(res.outsideLimits > 0
              ? `Saved ${selected.sampleCode}, ${selected.testType}. ${res.outsideLimits} result(s) were flagged for review.`
              : `Saved ${selected.sampleCode}, ${selected.testType}. All results are as expected.`);
            setSelectedId(null);
            load();
          }} />
      )}
    </>
  );
}

function EntryForm({ item, onSaved }) {
  const [vals, setVals] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // true when the entered value is outside the limits, or the choice is not the expected result
  const flagged = (p) => {
    const raw = vals[p.id];
    if (raw === undefined || raw === '') return null;      // nothing entered yet
    if (isNumeric(p)) {
      const v = Number(raw);
      return Number.isNaN(v) ? null : isOutside(v, p.lower, p.upper);
    }
    return raw !== EXPECTED[p.resultType];
  };
  const flaggedParams = item.parameters.filter((p) => flagged(p) === true);

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const res = await api.enterResults(item.sampleId, {
        sampleTestId: item.sampleTestId,
        results: item.parameters.map((p) => (isNumeric(p)
          ? { parameterId: p.id, value: Number(vals[p.id]) }
          : { parameterId: p.id, choice: vals[p.id] }))
      });
      onSaved(res);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <form className="panel" id="frm" onSubmit={submit}>
      <h3>{item.sampleCode}: {item.testType}</h3>
      <p className="muted">Client: {item.clientName}. Domain: {item.domain}.</p>
      {item.returnNote && <p className="notice bad">{item.returnNote}</p>}
      <div className="scroll">
        <table className="results-table">
          <thead><tr><th>Parameter</th><th>Method</th><th>Unit</th><th>Limits</th><th>Result</th><th>Check</th></tr></thead>
          <tbody>
            {item.parameters.map((p) => {
              const f = flagged(p);
              return (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.method}</td><td>{p.unit}</td>
                  <td className="num">{limitLabel(p)}</td>
                  <td>
                    {isNumeric(p) ? (
                      <input type="number" step="any" required value={vals[p.id] ?? ''}
                        className={f ? 'out' : ''} aria-label={`${p.name} value`} aria-invalid={!!f}
                        onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })} />
                    ) : (
                      <select required value={vals[p.id] ?? ''} className={f ? 'out' : ''}
                        aria-label={`${p.name} result`} aria-invalid={!!f}
                        onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })}>
                        <option value="">Choose</option>
                        {CHOICES[p.resultType].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </td>
                  <td>{f === null ? '' : f
                    ? <span className="out-text">{isNumeric(p) ? 'Outside limits' : 'Not as expected'}</span>
                    : <span className="ok">{isNumeric(p) ? 'Within limits' : 'As expected'}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {flaggedParams.length > 0 && (
        <p className="notice bad" role="status">
          {flaggedParams.length} result(s) will be flagged ({flaggedParams.map((p) => `${p.name}: ${limitLabel(p)}`).join('; ')}). They are saved and flagged for the reviewer.
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Saving' : 'Save results'}</button>
    </form>
  );





  
}
