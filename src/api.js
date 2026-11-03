const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const KEY = 'lims_session';

export function loadSession() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveSession(s) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const session = loadSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check that the API is running on ' + BASE + '.');
  }
  if (res.status === 401 && session) {
    saveSession(null);
    window.location.reload();
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status}).`);
  return data;
}

function toQuery(params) {
  const u = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== '' && v != null) u.set(k, v); });
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const api = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/api/auth/me'),

  domains: () => request('/api/config/domains'),
  addDomain: (name) => request('/api/config/domains', { method: 'POST', body: { name } }),
  addTestType: (domainId, name) => request('/api/config/test-types', { method: 'POST', body: { domainId, name } }),
  addParameter: (testTypeId, name, unit, resultType, method) => request('/api/config/parameters', { method: 'POST', body: { testTypeId, name, unit, resultType, method } }),
  setLimits: (b) => request('/api/config/limits', { method: 'POST', body: b }),

  samples: () => request('/api/samples'),
  sample: (id) => request(`/api/samples/${id}`),
  register: (b) => request('/api/samples', { method: 'POST', body: b }),
  worklist: () => request('/api/results/worklist'),
  enterResults: (id, b) => request(`/api/samples/${id}/results`, { method: 'POST', body: b }),
  review: (id, accept, reason) => request(`/api/samples/${id}/review`, { method: 'POST', body: { accept, reason } }),
  qc: (id, accept, reason) => request(`/api/samples/${id}/qc`, { method: 'POST', body: { accept, reason } }),
  approve: (id) => request(`/api/samples/${id}/approve`, { method: 'POST' }),
  finalize: (id) => request(`/api/samples/${id}/finalize`, { method: 'POST' }),

  users: () => request('/api/users'),
  userMeta: () => request('/api/users/meta'),
  addUser: (b) => request('/api/users', { method: 'POST', body: b }),
  setAccess: (id, moduleNames) => request(`/api/users/${id}/access`, { method: 'PUT', body: { moduleNames } }),
  resetPassword: (id, password) => request(`/api/users/${id}/password`, { method: 'POST', body: { password } }),
  removeUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),

  reports: (q) => request('/api/reports' + toQuery(q)),
  reportFilters: () => request('/api/reports/filters'),
  report: (id) => request(`/api/reports/${id}`),
  audit: (q) => request('/api/audit' + toQuery(q))
};

// ---- access helpers ----
// Access is by module only (no roles).
export const can = (session, module) => !!session && (session.modules || []).includes(module);

// Modules that work on samples always include "View samples" (the server enforces this too).
export const NEEDS_VIEW = ['RegisterSamples', 'ResultEntry', 'Review', 'QC', 'Approval', 'ReportFinalizer'];

export const MODULE_LABELS = {
  ViewSamples: 'View samples',
  RegisterSamples: 'Register samples',
  ResultEntry: 'Result entry',
  Review: 'Review results',
  QC: 'QC check',
  Approval: 'Approve results',
  ReportFinalizer: 'Finalize reports',
  Reports: 'Reports',
  TestSetup: 'Test setup',
  AuditTrail: 'Audit trail',
  UserManagement: 'Users and access'
};

export const STATUS_LABELS = {
  Registered: 'Registered', Tested: 'Tested', Reviewed: 'Reviewed',
  QCChecked: 'QC checked', Approved: 'Approved', Finalized: 'Finalized'
};
export const STATUS_ORDER = ['Registered', 'Tested', 'Reviewed', 'QCChecked', 'Approved', 'Finalized'];

// ---- result types ----
export const RESULT_TYPES = [
  ['Numeric', 'Number, with lower and upper limit'],
  ['PassFail', 'Pass or fail'],
  ['Presence', 'Absent or detected']
];
export const CHOICES = { PassFail: ['Pass', 'Fail'], Presence: ['Absent', 'Detected'] };
export const EXPECTED = { PassFail: 'Pass', Presence: 'Absent' };
export const isNumeric = (p) => !p.resultType || p.resultType === 'Numeric';

// what to show in the limits column
export const limitLabel = (p) =>
  isNumeric(p) ? limitText(p.lower, p.upper) : `Expected: ${EXPECTED[p.resultType]}`;

// ---- limits and bold rule ----
export const limitText = (lower, upper) =>
  lower == null || upper == null ? 'No limits set' : `${lower} to ${upper}`;

// true when a value is outside the lower and upper limit
export const isOutside = (value, lower, upper) =>
  value != null && lower != null && upper != null && (value < lower || value > upper);

export const fmtDate = (iso) => (iso ? new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleString() : '');
