import { useEffect, useState } from 'react';
import { api, can, fmtDate, isNumeric, limitLabel, STATUS_LABELS, STATUS_ORDER } from './api.js';
import { StatusChip } from './Samples.jsx';

function Stepper({ status }) {
  const at = STATUS_ORDER.indexOf(status);
  return (
    <ol className="stepper" aria-label="Sample progress">
      {STATUS_ORDER.map((s, i) => (
        <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="dot" />{STATUS_LABELS[s]}
        </li>
      ))}
    </ol>
  );
}

// The result value is bold (and red, with words) when it is outside the lower and upper limit.
// The server decides whether a result conforms, using the limits (or expected result) saved with it.
export function ResultValue({ result }) {
  if (!result) return <span className="muted">Not entered</span>;
  return <span className={result.conforming ? '' : 'out-value'}>{result.textValue ?? result.value}</span>;
}
function CheckCell({ result, p }) {
  if (!result) return null;
  if (result.conforming) return <span className="ok">{isNumeric(p) ? 'Within limits' : 'As expected'}</span>;
  return <span className="out-text">{isNumeric(p) ? 'Outside limits' : 'Not as expected'}</span>;
}
function LimitCells({ p }) {
  return isNumeric(p)
    ? <><td className="num">{p.lower ?? ''}</td><td className="num">{p.upper ?? ''}</td></>
    : <td className="num" colSpan={2}>Expected: {p.expected}</td>;
}

export default function SampleDetail({ id, session, onBack, onEnterResults }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = () => api.sample(id).then(setS).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  async function act(fn) {
    setError('');
    try { await fn(); setNote(''); await load(); } catch (e) { setError(e.message); }
  }

  if (!s) return <>{error ? <p className="error" role="alert">{error}</p> : <p className="muted">Loading sample</p>}</>;

  const canEnter = can(session, 'ResultEntry') && s.status === 'Registered';
  const canReview = can(session, 'Review') && s.status === 'Tested';
  const canQc = can(session, 'QC') && s.status === 'Reviewed';
  const canApprove = can(session, 'Approval') && s.status === 'QCChecked';
  const canFinalize = can(session, 'ReportFinalizer') && s.status === 'Approved';
  const anyOutside = s.tests.some((t) => t.parameters.some((p) => p.result && !p.result.conforming));

  return (
    <>
      <button className="link" onClick={onBack}>Back to samples</button>
      <div className="head">
        <h2>{s.sampleCode}</h2>
        <StatusChip status={s.status} />
      </div>
      <Stepper status={s.status} />
      <dl className="facts">
        <div><dt>Client</dt><dd>{s.clientName}</dd></div>
        <div><dt>Domain</dt><dd>{s.domain}</dd></div>
        <div><dt>Description</dt><dd>{s.description}</dd></div>
        <div><dt>Registered by</dt><dd>{s.registeredBy}</dd></div>
        {s.reportNumber && <div><dt>Report ID</dt><dd>{s.reportNumber}</dd></div>}
        {s.reviewedBy && <div><dt>Reviewed by</dt><dd>{s.reviewedBy}</dd></div>}
        {s.qcBy && <div><dt>QC checked by</dt><dd>{s.qcBy}</dd></div>}
        {s.approvedBy && <div><dt>Approved by</dt><dd>{s.approvedBy}</dd></div>}
        {s.finalizedBy && <div><dt>Report finalized by</dt><dd>{s.finalizedBy}</dd></div>}
      </dl>
      {s.returnNote && <p className="notice bad">{s.returnNote}</p>}
      {s.reviewNote && <p className="notice">Reviewer note: {s.reviewNote}</p>}
      {s.qcNote && <p className="notice">QC note: {s.qcNote}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {canEnter && (
        <div className="panel">
          <p>This sample is waiting for results.</p>
          <button className="primary" onClick={() => onEnterResults(s.id)}>Go to result entry</button>
        </div>
      )}

      {s.tests.map((t) => (
        <div className="panel" key={t.id}>
          <h3>{t.testType}</h3>
          {t.parameters.length === 0 ? <p className="muted">This test has no parameters.</p> : (
            <div className="scroll">
              <table className="results-table">
                <thead><tr><th>Parameter</th><th>Method</th><th>Unit</th><th>Lower limit</th><th>Upper limit</th><th>Result</th><th>Check</th></tr></thead>
                <tbody>
                  {t.parameters.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td><td>{p.method}</td><td>{p.unit}</td>
                      <LimitCells p={p} />
                      <td className="num"><ResultValue result={p.result} /></td>
                      <td><CheckCell result={p.result} p={p} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {canReview && (
        <DecisionPanel title="Review" note={note} setNote={setNote}
          warn={anyOutside ? 'Some results are outside their limits. Add a note to accept them.' : ''}
          acceptLabel="Accept results"
          onAccept={() => act(() => api.review(id, true, note))}
          onReject={() => act(() => api.review(id, false, note))} />
      )}
      {canQc && (
        <DecisionPanel title="QC check" note={note} setNote={setNote} warn=""
          acceptLabel="Pass QC check"
          onAccept={() => act(() => api.qc(id, true, note))}
          onReject={() => act(() => api.qc(id, false, note))} />
      )}
      {canApprove && (
        <div className="panel">
          <h3>Approval</h3>
          <button className="primary" onClick={() => act(() => api.approve(id))}>Approve sample</button>
        </div>
      )}
      {canFinalize && (
        <div className="panel">
          <h3>Report finalization</h3>
          <p className="muted">Finalizing locks the results and issues the report. This cannot be undone.</p>
          <button className="primary" onClick={() => {
            if (window.confirm(`Finalize the report for ${s.sampleCode}?`)) act(() => api.finalize(id));
          }}>Finalize report</button>
        </div>
      )}

      {s.status === 'Finalized' && <Report s={s} />}
    </>
  );
}

function DecisionPanel({ title, note, setNote, warn, acceptLabel, onAccept, onReject }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {warn && <p className="notice bad">{warn}</p>}
      <label>Note<input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Reason or comment" /></label>
      <div className="row">
        <button className="primary" onClick={onAccept}>{acceptLabel}</button>
        <button className="danger" onClick={onReject}>Send back for retest</button>
      </div>
    </div>
  );
}

export function Report({ s }) {
  return (
    <section className="report panel" aria-label="Test report">
      <div className="report-head">
        <h3>Test report {s.reportNumber ? <>{s.reportNumber} <span className="muted">(sample {s.sampleCode})</span></> : s.sampleCode}</h3>
        <button className="ghost no-print" onClick={() => window.print()}>Print report</button>
      </div>
      <dl className="facts">
        <div><dt>Client</dt><dd>{s.clientName}</dd></div>
        <div><dt>Domain</dt><dd>{s.domain}</dd></div>
        <div><dt>Sample</dt><dd>{s.description}</dd></div>
        <div><dt>Registered</dt><dd>{fmtDate(s.registeredAt)}</dd></div>
      </dl>
      {s.tests.map((t) => (
        <div key={t.id}>
          <h4>{t.testType}</h4>
          <table className="report-table">
            <thead><tr><th>Parameter</th><th>Method</th><th>Unit</th><th>Limits</th><th>Result</th><th>Check</th></tr></thead>
            <tbody>
              {t.parameters.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.method}</td><td>{p.unit}</td>
                  <td className="num">{isNumeric(p) ? limitLabel(p) : `Expected: ${p.expected}`}</td>
                  <td className="num"><ResultValue result={p.result} /></td>
                  <td><CheckCell result={p.result} p={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <table className="report-table signoff">
        <tbody>
          <tr><th>Results entered by</th><td>{[...new Set(s.tests.flatMap((t) => t.parameters.map((p) => p.result?.enteredBy).filter(Boolean)))].join(', ')}</td></tr>
          <tr><th>Reviewed by</th><td>{s.reviewedBy}</td></tr>
          <tr><th>QC checked by</th><td>{s.qcBy}</td></tr>
          <tr><th>Approved by</th><td>{s.approvedBy}</td></tr>
          <tr><th>Finalized by</th><td>{s.finalizedBy}, {fmtDate(s.finalizedAt)}</td></tr>
        </tbody>
      </table>
      <p className="muted">Results in bold are outside the limits or not the expected result.</p>
    </section>
  );
}
