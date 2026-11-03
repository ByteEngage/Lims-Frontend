import { useEffect, useState } from 'react';
import { api, fmtDate } from './api.js';
import { Report } from './SampleDetail.jsx';

const EMPTY = {
  search: '', domainId: '', test: '', client: '', addedBy: '', reviewedBy: '', qcBy: '', approvedBy: '', finalizedBy: '',
  result: '', regFrom: '', regTo: '', repFrom: '', repTo: ''
};

// A date picked in the user's own time zone becomes the start of that day; "to" is the start of the next day (exclusive).
const dayStart = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : '');
const dayAfter = (d) => {
  if (!d) return '';
  const x = new Date(`${d}T00:00:00`);
  x.setDate(x.getDate() + 1);
  return x.toISOString();
};
const toParams = (f) => ({
  search: f.search, domainId: f.domainId, test: f.test, client: f.client,
  addedBy: f.addedBy, reviewedBy: f.reviewedBy, qcBy: f.qcBy, approvedBy: f.approvedBy, finalizedBy: f.finalizedBy,
  result: f.result,
  regFrom: dayStart(f.regFrom), regTo: dayAfter(f.regTo), repFrom: dayStart(f.repFrom), repTo: dayAfter(f.repTo)
});

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(items) {
  const head = ['Report ID', 'Sample ID', 'Domain', 'Tests', 'Client', 'Description', 'Sample added by', 'Sample registered',
    'Reviewed by', 'QC checked by', 'Approved by', 'Report finalized by', 'Report date', 'Results', 'Flagged results'];
  const rows = items.map((r) => [r.reportNumber, r.sampleCode, r.domain, r.tests.join('; '), r.clientName, r.description,
    r.registeredBy, fmtDate(r.registeredAt), r.reviewedBy, r.qcBy, r.approvedBy, r.finalizedBy, fmtDate(r.finalizedAt),
    r.resultCount, r.flagged]);
  const text = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'reports.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [options, setOptions] = useState({ domains: [], tests: [], people: [] });
  const [form, setForm] = useState(EMPTY);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [report, setReport] = useState(null);

  const search = (f) => { setError(''); return api.reports(toParams(f)).then(setData).catch((e) => setError(e.message)); };
  useEffect(() => {
    api.reportFilters().then(setOptions).catch((e) => setError(e.message));
    search(EMPTY);
  }, []);

  useEffect(() => {
    if (openId == null) { setReport(null); return; }
    api.report(openId).then(setReport).catch((e) => { setError(e.message); setOpenId(null); });
  }, [openId]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (openId != null) {
    return (
      <>
        <button className="link no-print" onClick={() => setOpenId(null)}>Back to reports</button>
        {error && <p className="error" role="alert">{error}</p>}
        {report ? <Report s={report} /> : <p className="muted">Loading report</p>}
      </>
    );
  }

  const person = (k, label) => (
    <label>{label}
      <select value={form[k]} onChange={set(k)}>
        <option value="">Anyone</option>
        {options.people.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <h2>Reports</h2>
      <p className="muted">Every issued report. A report is created when a sample is finalized and has its own Report ID. Filters combine: a report must match all of them.</p>
      {error && <p className="error" role="alert">{error}</p>}

      <form className="panel" onSubmit={(e) => { e.preventDefault(); search(form); }}>
        <label>Search every field
          <input value={form.search} onChange={set('search')} placeholder="Report ID, sample ID, client, description, test, parameter, method, person" />
        </label>
        <div className="grid3">
          <label>Domain
            <select value={form.domainId} onChange={set('domainId')}>
              <option value="">All domains</option>
              {options.domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>Test (item)
            <select value={form.test} onChange={set('test')}>
              <option value="">All tests</option>
              {options.tests.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>Client
            <input value={form.client} onChange={set('client')} placeholder="Part of the client name" />
          </label>
          {person('addedBy', 'Sample added by')}
          {person('reviewedBy', 'Reviewed by')}
          {person('qcBy', 'QC checked by')}
          {person('approvedBy', 'Approved by')}
          {person('finalizedBy', 'Report finalized by')}
          <label>Results
            <select value={form.result} onChange={set('result')}>
              <option value="">All reports</option>
              <option value="ok">Everything within limits or as expected</option>
              <option value="flagged">Has flagged results</option>
            </select>
          </label>
          <label>Sample registered from<input type="date" value={form.regFrom} onChange={set('regFrom')} /></label>
          <label>Sample registered to<input type="date" value={form.regTo} onChange={set('regTo')} /></label>
          <span />
          <label>Report date from<input type="date" value={form.repFrom} onChange={set('repFrom')} /></label>
          <label>Report date to<input type="date" value={form.repTo} onChange={set('repTo')} /></label>
        </div>
        <div className="row">
          <button className="primary">Apply filters</button>
          <button type="button" className="ghost" onClick={() => { setForm(EMPTY); search(EMPTY); }}>Clear filters</button>
        </div>
      </form>

      {data === null ? <p className="muted">Loading reports</p> : (
        <>
          <div className="row between">
            <p className="muted" role="status">
              {data.total === 0 ? 'No reports match.' : `Showing ${data.shown} of ${data.total} report(s).`}
              {data.total > data.shown && ' Narrow the filters to see the rest.'}
            </p>
            {data.items.length > 0 && <button className="ghost" onClick={() => downloadCsv(data.items)}>Download CSV</button>}
          </div>
          {data.items.length > 0 && (
            <div className="scroll">
              <table className="reports-table">
                <thead>
                  <tr><th>Report ID</th><th>Sample ID</th><th>Domain</th><th>Tests</th><th>Client</th><th>Description</th>
                    <th>Sample added by</th><th>Registered</th><th>Reviewed by</th><th>QC checked by</th><th>Approved by</th>
                    <th>Finalized by</th><th>Report date</th><th>Results</th></tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)}>
                      <td><button className="link" onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}>{r.reportNumber}</button></td>
                      <td className="num">{r.sampleCode}</td><td>{r.domain}</td><td>{r.tests.join(', ')}</td>
                      <td>{r.clientName}</td><td>{r.description}</td>
                      <td>{r.registeredBy}</td><td className="num">{fmtDate(r.registeredAt)}</td>
                      <td>{r.reviewedBy}</td><td>{r.qcBy}</td><td>{r.approvedBy}</td>
                      <td>{r.finalizedBy}</td><td className="num">{fmtDate(r.finalizedAt)}</td>
                      <td>{r.flagged > 0 ? <span className="out-text">{r.flagged} flagged</span> : <span className="ok">All as expected</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
