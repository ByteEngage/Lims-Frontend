// Checks that every user sees and can do exactly what their ticked modules allow.
// The real app is rendered; only the server responses are mocked.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../src/App.jsx';
import SampleDetail from '../src/SampleDetail.jsx';
import ResultEntry from '../src/ResultEntry.jsx';
import Samples from '../src/Samples.jsx';
import Users from '../src/Users.jsx';
import Reports from '../src/Reports.jsx';
import Audit from '../src/Audit.jsx';

const ALL = ['ViewSamples', 'RegisterSamples', 'ResultEntry', 'Review', 'QC', 'Approval', 'ReportFinalizer', 'Reports', 'TestSetup', 'AuditTrail', 'UserManagement'];
const ACTIONS = ['RegisterSamples', 'ResultEntry', 'Review', 'QC', 'Approval', 'ReportFinalizer'];

// the seeded demo users, with the modules the server gives them
const DEMO = {
  admin: ALL,
  reception: ['RegisterSamples', 'ViewSamples'],
  analyst: ['ResultEntry', 'ViewSamples'],
  reviewer: ['Review', 'ViewSamples'],
  qc: ['QC', 'ViewSamples'],
  approver: ['Approval', 'ViewSamples'],
  finalizer: ['ReportFinalizer', 'Reports', 'ViewSamples']
};

let sampleStatus = 'Registered';

function sampleDetail(status) {
  const conforming = status !== 'Registered';
  return {
    id: 1, sampleCode: 'S-2026-0001', reportNumber: status === 'Finalized' ? 'R-2026-0001' : null, status, clientName: 'Acme', description: 'Concrete cube', domain: 'Building Material',
    registeredAt: '2026-10-01T10:00:00', registeredBy: 'reception', reviewedBy: null, qcBy: null, approvedBy: null,
    finalizedBy: status === 'Finalized' ? 'finalizer' : null, finalizedAt: status === 'Finalized' ? '2026-10-02T10:00:00' : null,
    reviewNote: null, qcNote: null, returnNote: null,
    tests: [{
      id: 5, done: conforming, testType: 'Concrete cube test',
      parameters: [{
        id: 9, name: 'Compressive strength', unit: 'MPa', resultType: 'Numeric', method: null, expected: null, lower: 25, upper: 60,
        result: conforming ? { value: 70, textValue: null, conforming: false, enteredBy: 'analyst' } : null
      }]
    }]
  };
}

const worklist = [{
  sampleTestId: 7, sampleId: 1, sampleCode: 'S-2026-0001', clientName: 'Acme', domain: 'Mixed', testType: 'Mixed test', returnNote: null,
  parameters: [
    { id: 1, name: 'Strength', unit: 'MPa', resultType: 'Numeric', method: null, lower: 25, upper: 60 },
    { id: 2, name: 'E. coli', unit: '', resultType: 'Presence', method: 'IS 15185:2016', lower: null, upper: null },
    { id: 3, name: 'Acceptance', unit: '', resultType: 'PassFail', method: null, lower: null, upper: null }
  ]
}];

const domains = [{
  id: 1, name: 'Mixed', testTypes: [
    { id: 11, name: 'Ready test', parameters: [{ id: 1, name: 'pH', unit: 'pH', resultType: 'Numeric', method: null, lower: 6.5, upper: 8.5 }] },
    { id: 12, name: 'Needs limits test', parameters: [{ id: 2, name: 'Strength', unit: 'MPa', resultType: 'Numeric', method: null, lower: null, upper: null }] },
    { id: 13, name: 'Detection test', parameters: [{ id: 3, name: 'E. coli', unit: '', resultType: 'Presence', method: 'IS 15185:2016', lower: null, upper: null }] }
  ]
}];

let currentUsers = [];
let lastReportsQs = '';
let lastAuditQs = '';

const reportRow = {
  id: 1, reportNumber: 'R-2026-0001', sampleCode: 'S-2026-0001', domain: 'Civil', clientName: 'Acme', description: 'Cube',
  registeredBy: 'reception', registeredAt: '2026-10-01T10:00:00', reviewedBy: 'reviewer', qcBy: 'qc', approvedBy: 'approver',
  finalizedBy: 'finalizer', finalizedAt: '2026-10-02T10:00:00', tests: ['Concrete cube test'], resultCount: 1, flagged: 1
};

beforeEach(() => {
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  window.confirm = () => true;
  globalThis.fetch = async (url, opts = {}) => {
    const [path, qs = ''] = String(url).replace(/^https?:\/\/[^/]+/, '').split('?');
    const session = JSON.parse(localStorage.getItem('lims_session') || 'null');
    const reply = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
    if (path === '/api/auth/login') return reply({ token: 't', username: 'analyst', modules: DEMO.analyst });
    if (path === '/api/auth/me') return reply({ username: session.username, modules: session.modules });
    if (path === '/api/samples') return reply([{ id: 1, sampleCode: 'S-2026-0001', status: sampleStatus, clientName: 'Acme', domain: 'Civil', description: 'x', registeredAt: '2026-10-01T10:00:00', registeredBy: 'r' }]);
    if (path === '/api/samples/1') return reply(sampleDetail(sampleStatus));
    if (path === '/api/config/domains') return reply(domains);
    if (path === '/api/results/worklist') return reply(worklist);
    if (path === '/api/users') return reply(currentUsers);
    if (path === '/api/users/meta') return reply({ modules: ALL });
    if (path === '/api/audit') {
      lastAuditQs = qs;
      return reply([{ id: 1, timestamp: '2026-10-02T10:00:00', username: 'finalizer', action: 'FinalizeReport', entity: 'Report', entityId: '1', sampleCode: 'S-2026-0001', reportNumber: 'R-2026-0001', details: 'R-2026-0001 for S-2026-0001' }]);
    }
    if (path === '/api/reports/filters') return reply({ domains: [{ id: 1, name: 'Civil' }], tests: ['Concrete cube test'], people: ['approver', 'finalizer', 'qc', 'reception', 'reviewer'] });
    if (path === '/api/reports') { lastReportsQs = qs; return reply({ total: 1, shown: 1, items: [reportRow] }); }
    if (path === '/api/reports/1') return reply(sampleDetail('Finalized'));
    return reply({ message: 'not mocked: ' + path }, 404);
  };
});
afterEach(() => { cleanup(); localStorage.clear(); sampleStatus = 'Registered'; lastReportsQs = ''; lastAuditQs = ''; });

const signIn = (username, modules) => localStorage.setItem('lims_session', JSON.stringify({ token: 't', username, modules }));
const navTabs = () => within(screen.getByRole('navigation', { name: 'Main' })).queryAllByRole('button').map((b) => b.textContent);

describe('sign-in', () => {
  it('a non-admin user gets their modules straight after signing in (no reload needed)', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'analyst' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Samples' });
    expect(navTabs()).toEqual(['Samples', 'Result entry']);
    expect(JSON.parse(localStorage.getItem('lims_session')).modules).toEqual(DEMO.analyst);
  });
});

describe('navigation: each demo user sees only the pages their modules allow', () => {
  const expected = {
    admin: ['Samples', 'Result entry', 'Reports', 'Test setup', 'Users and access', 'Audit trail'],
    reception: ['Samples'], analyst: ['Samples', 'Result entry'], reviewer: ['Samples'],
    qc: ['Samples'], approver: ['Samples'], finalizer: ['Samples', 'Reports']
  };
  for (const [user, modules] of Object.entries(DEMO)) {
    it(`${user}`, async () => {
      signIn(user, modules);
      render(<App />);
      await waitFor(() => expect(navTabs().length).toBeGreaterThan(0));
      expect(navTabs()).toEqual(expected[user]);
    });
  }

  it('a user with ONLY "Users and access" lands on that page, not on Samples', async () => {
    signIn('hr', ['UserManagement']);
    render(<App />);
    await screen.findByRole('heading', { name: 'Users and access' });
    expect(navTabs()).toEqual(['Users and access']);
    expect(screen.queryByRole('heading', { name: 'Samples' })).toBeNull();
  });

  it('a user with no modules sees a clear message and no pages', async () => {
    signIn('nobody', []);
    render(<App />);
    await screen.findByText(/do not have access to any module/i);
    expect(navTabs()).toEqual([]);
  });

  it('the Register button follows the Register samples module', async () => {
    signIn('reception', DEMO.reception);
    const { unmount } = render(<App />);
    await screen.findByRole('button', { name: 'Register sample' });
    unmount();
    signIn('analyst', DEMO.analyst);
    render(<App />);
    await screen.findByRole('heading', { name: 'Samples' });
    expect(screen.queryByRole('button', { name: 'Register sample' })).toBeNull();
  });
});

describe('sample page: each action button needs its own module AND the right status', () => {
  const steps = [
    { module: 'ResultEntry', status: 'Registered', button: 'Go to result entry' },
    { module: 'Review', status: 'Tested', button: 'Accept results' },
    { module: 'QC', status: 'Reviewed', button: 'Pass QC check' },
    { module: 'Approval', status: 'QCChecked', button: 'Approve sample' },
    { module: 'ReportFinalizer', status: 'Approved', button: 'Finalize report' }
  ];
  const session = (modules) => ({ username: 'u', modules });
  const open = async (modules, status) => {
    sampleStatus = status;
    render(<SampleDetail id={1} session={session(modules)} onBack={() => {}} onEnterResults={() => {}} />);
    await screen.findByRole('heading', { name: 'S-2026-0001' });
  };

  for (const s of steps) {
    it(`${s.button}: shown with only ${s.module} at ${s.status}`, async () => {
      await open([s.module, 'ViewSamples'], s.status);
      expect(screen.getByRole('button', { name: s.button })).toBeTruthy();
    });
    it(`${s.button}: NOT shown when every module except ${s.module} is ticked`, async () => {
      await open(ALL.filter((m) => m !== s.module), s.status);
      expect(screen.queryByRole('button', { name: s.button })).toBeNull();
    });
    it(`${s.button}: NOT shown at the wrong status, even with every module`, async () => {
      await open(ALL, s.status === 'Tested' ? 'Reviewed' : 'Tested');
      expect(screen.queryByRole('button', { name: s.button })).toBeNull();
    });
  }

  it('Review also offers "Send back for retest"; QC too', async () => {
    await open(['Review', 'ViewSamples'], 'Tested');
    expect(screen.getByRole('button', { name: 'Send back for retest' })).toBeTruthy();
    cleanup();
    await open(['QC', 'ViewSamples'], 'Reviewed');
    expect(screen.getByRole('button', { name: 'Send back for retest' })).toBeTruthy();
  });

  it('a Finalized sample shows the printable report to every viewer, and no action buttons', async () => {
    await open(['ViewSamples'], 'Finalized');
    expect(screen.getByRole('region', { name: 'Test report' })).toBeTruthy();
    for (const s of steps) expect(screen.queryByRole('button', { name: s.button })).toBeNull();
  });

  it('an out-of-limit result is shown in bold with words, on the sample page', async () => {
    await open(['ViewSamples'], 'Tested');
    const cell = screen.getAllByText('70')[0];
    expect(cell.className).toContain('out-value');
    expect(screen.getAllByText('Outside limits').length).toBeGreaterThan(0);
  });
});

describe('Users and access: checkboxes only', () => {
  beforeEach(() => {
    currentUsers = [
      { id: 1, username: 'admin', modules: ALL },
      { id: 2, username: 'analyst', modules: ['ResultEntry', 'ViewSamples'] }
    ];
  });

  it('there is no role dropdown anywhere, and one checkbox per module', async () => {
    render(<Users session={{ username: 'admin', modules: ALL }} />);
    await screen.findByRole('heading', { name: 'Users and access' });
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    expect(screen.queryByText('Role')).toBeNull();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getAllByRole('checkbox')).toHaveLength(ALL.length);
  });

  it('ticking an action module ticks and locks "View samples"', async () => {
    render(<Users session={{ username: 'admin', modules: ALL }} />);
    await screen.findByRole('heading', { name: 'Users and access' });
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    const view = screen.getByLabelText('View samples');
    expect(view.checked).toBe(false);
    fireEvent.click(screen.getByLabelText('Review results'));
    expect(view.checked).toBe(true);
    expect(view.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Review results'));      // untick again
    expect(view.disabled).toBe(false);
  });

  it('Create user stays disabled until at least one module is ticked', async () => {
    render(<Users session={{ username: 'admin', modules: ALL }} />);
    await screen.findByRole('heading', { name: 'Users and access' });
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    expect(screen.getByRole('button', { name: 'Create user' }).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Audit trail'));
    expect(screen.getByRole('button', { name: 'Create user' }).disabled).toBe(false);
  });

  it('you cannot manage or remove your own row', async () => {
    render(<Users session={{ username: 'admin', modules: ALL }} />);
    await screen.findByText('(you)');
    const row = screen.getByText('admin').closest('tr');
    expect(within(row).getByRole('button', { name: 'Manage' }).disabled).toBe(true);
    expect(within(row).getByRole('button', { name: 'Remove' }).disabled).toBe(true);
    const other = screen.getByText('analyst').closest('tr');
    expect(within(other).getByRole('button', { name: 'Manage' }).disabled).toBe(false);
    expect(within(other).getByRole('button', { name: 'Remove' }).disabled).toBe(false);
  });
});

describe('Result entry: out-of-limit and not-as-expected results are flagged', () => {
  it('numeric, absent/detected and pass/fail', async () => {
    render(<ResultEntry onOpenSample={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enter results' }));

    const strength = await screen.findByLabelText('Strength value');
    fireEvent.change(strength, { target: { value: '70' } });          // above 60
    expect(strength.className).toContain('out');
    fireEvent.change(strength, { target: { value: '30' } });          // inside 25 to 60
    expect(strength.className).not.toContain('out');
    fireEvent.change(strength, { target: { value: '24.99' } });       // just below 25
    expect(strength.className).toContain('out');
    fireEvent.change(strength, { target: { value: '25' } });          // exactly on the limit is fine
    expect(strength.className).not.toContain('out');

    const ecoli = screen.getByLabelText('E. coli result');
    fireEvent.change(ecoli, { target: { value: 'Detected' } });
    expect(ecoli.className).toContain('out');
    fireEvent.change(ecoli, { target: { value: 'Absent' } });
    expect(ecoli.className).not.toContain('out');

    const accept = screen.getByLabelText('Acceptance result');
    fireEvent.change(accept, { target: { value: 'Fail' } });
    expect(accept.className).toContain('out');
    fireEvent.change(accept, { target: { value: 'Pass' } });
    expect(accept.className).not.toContain('out');
  });
});

describe('Register form only offers tests that are ready to use', () => {
  it('a numeric test without limits is disabled; detection tests need no limits', async () => {
    render(<Samples session={{ username: 'r', modules: DEMO.reception }} onOpen={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Register sample' }));
    const select = await screen.findByLabelText('Domain');
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));
    fireEvent.change(select, { target: { value: '1' } });
    expect((await screen.findByLabelText(/Ready test/)).disabled).toBe(false);
    expect(screen.getByLabelText(/Needs limits test/).disabled).toBe(true);
    expect(screen.getByLabelText(/Detection test/).disabled).toBe(false);
  });
});

describe('Reports module', () => {
  const qs = () => new URLSearchParams(lastReportsQs);

  it('a user with ONLY the Reports module lands on Reports (View samples is not needed)', async () => {
    signIn('auditor', ['Reports']);
    render(<App />);
    await screen.findByRole('heading', { name: 'Reports' });
    expect(navTabs()).toEqual(['Reports']);
    await screen.findByText('R-2026-0001');
  });

  it('lists reports with Report ID, Sample ID and who did each step', async () => {
    render(<Reports />);
    await screen.findByText('R-2026-0001');
    const row = screen.getByText('R-2026-0001').closest('tr');
    for (const text of ['S-2026-0001', 'Civil', 'Concrete cube test', 'Acme', 'Cube', 'reception', 'reviewer', 'qc', 'approver', 'finalizer'])
      expect(within(row).getAllByText(text).length).toBeGreaterThan(0);
    expect(within(row).getByText('1 flagged').className).toContain('out-text');
    expect(screen.getByText(/Showing 1 of 1 report/)).toBeTruthy();
  });

  it('has a filter for every field, including dates and who added the sample', async () => {
    render(<Reports />);
    await screen.findByText('R-2026-0001');
    for (const label of ['Search every field', 'Domain', 'Test (item)', 'Client', 'Sample added by', 'Reviewed by', 'QC checked by',
      'Approved by', 'Report finalized by', 'Results', 'Sample registered from', 'Sample registered to', 'Report date from', 'Report date to'])
      expect(screen.getByLabelText(label)).toBeTruthy();
  });

  it('sends every chosen filter to the server', async () => {
    render(<Reports />);
    await screen.findByText('R-2026-0001');
    await waitFor(() => expect(within(screen.getByLabelText('Domain')).getAllByRole('option').length).toBeGreaterThan(1));
    fireEvent.change(screen.getByLabelText('Search every field'), { target: { value: 'cube' } });
    fireEvent.change(screen.getByLabelText('Domain'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Test (item)'), { target: { value: 'Concrete cube test' } });
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'Acm' } });
    fireEvent.change(screen.getByLabelText('Sample added by'), { target: { value: 'reception' } });
    fireEvent.change(screen.getByLabelText('Reviewed by'), { target: { value: 'reviewer' } });
    fireEvent.change(screen.getByLabelText('QC checked by'), { target: { value: 'qc' } });
    fireEvent.change(screen.getByLabelText('Approved by'), { target: { value: 'approver' } });
    fireEvent.change(screen.getByLabelText('Report finalized by'), { target: { value: 'finalizer' } });
    fireEvent.change(screen.getByLabelText('Results'), { target: { value: 'flagged' } });
    fireEvent.change(screen.getByLabelText('Sample registered from'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Report date to'), { target: { value: '2026-10-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(qs().get('domainId')).toBe('1'));
    const q = qs();
    expect(q.get('search')).toBe('cube');
    expect(q.get('test')).toBe('Concrete cube test');
    expect(q.get('client')).toBe('Acm');
    expect(q.get('addedBy')).toBe('reception');
    expect(q.get('reviewedBy')).toBe('reviewer');
    expect(q.get('qcBy')).toBe('qc');
    expect(q.get('approvedBy')).toBe('approver');
    expect(q.get('finalizedBy')).toBe('finalizer');
    expect(q.get('result')).toBe('flagged');
    // dates: start of the chosen day, and for "to" the start of the NEXT day (so the whole last day is included)
    expect(q.get('regFrom')).toBe(new Date('2026-10-01T00:00:00').toISOString());
    expect(q.get('repTo')).toBe(new Date('2026-11-01T00:00:00').toISOString());
    expect(q.get('regTo')).toBeNull();
  });

  it('Clear filters resets everything and asks the server again with no filters', async () => {
    render(<Reports />);
    await screen.findByText('R-2026-0001');
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'zzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(qs().get('client')).toBe('zzz'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(lastReportsQs).toBe(''));
    expect(screen.getByLabelText('Client').value).toBe('');
  });

  it('opens a report from the list and goes back', async () => {
    render(<Reports />);
    fireEvent.click(await screen.findByRole('button', { name: 'R-2026-0001' }));
    const report = await screen.findByRole('region', { name: 'Test report' });
    expect(within(report).getAllByText(/R-2026-0001/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Back to reports' }));
    await screen.findByRole('heading', { name: 'Reports' });
  });

  it('can download the filtered list as CSV', async () => {
    render(<Reports />);
    expect(await screen.findByRole('button', { name: 'Download CSV' })).toBeTruthy();
  });
});

describe('Audit trail shows Sample ID and Report ID', () => {
  it('has both columns, filled in, and filters by them', async () => {
    render(<Audit />);
    await screen.findByText('FinalizeReport');
    const head = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(head).toContain('Sample ID');
    expect(head).toContain('Report ID');
    const row = screen.getByText('FinalizeReport').closest('tr');
    expect(within(row).getByText('S-2026-0001')).toBeTruthy();
    expect(within(row).getAllByText('R-2026-0001').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Sample ID'), { target: { value: 'S-2026-0001' } });
    fireEvent.change(screen.getByLabelText('Report ID'), { target: { value: 'R-2026-0001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(new URLSearchParams(lastAuditQs).get('sample')).toBe('S-2026-0001'));
    expect(new URLSearchParams(lastAuditQs).get('report')).toBe('R-2026-0001');
  });
});

describe('Report ID appears on the sample page once finalized', () => {
  it('shows the Report ID fact', async () => {
    sampleStatus = 'Finalized';
    render(<SampleDetail id={1} session={{ username: 'u', modules: ['ViewSamples'] }} onBack={() => {}} onEnterResults={() => {}} />);
    await screen.findByRole('heading', { name: 'S-2026-0001' });
    expect(screen.getByText('Report ID')).toBeTruthy();
  });
});
