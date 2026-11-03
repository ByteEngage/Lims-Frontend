import { useEffect, useState } from 'react';
import { api, can, loadSession, saveSession } from './api.js';
import Login from './Login.jsx';
import Samples from './Samples.jsx';
import SampleDetail from './SampleDetail.jsx';
import ResultEntry from './ResultEntry.jsx';
import Reports from './Reports.jsx';
import Config from './Config.jsx';
import Users from './Users.jsx';
import Audit from './Audit.jsx';

export default function App() {
  const [session, setSession] = useState(loadSession());
  const [view, setView] = useState({ name: 'samples' });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // On load, refresh module access, so changes made by an administrator show up straight away.
  useEffect(() => {
    if (!loadSession()) return;
    api.me().then((me) => {
      const next = { ...loadSession(), modules: me.modules };
      saveSession(next);
      setSession(next);
    }).catch(() => {});
  }, []);

  if (!session) {
    return <Login onLogin={(s) => { saveSession(s); setSession(s); setView({ name: 'samples' }); }} />;
  }

  const tabs = [
    ...(can(session, 'ViewSamples') ? [{ id: 'samples', label: 'Samples' }] : []),
    ...(can(session, 'ResultEntry') ? [{ id: 'results', label: 'Result entry' }] : []),
    ...(can(session, 'Reports') ? [{ id: 'reports', label: 'Reports' }] : []),
    ...(can(session, 'TestSetup') ? [{ id: 'config', label: 'Test setup' }] : []),
    ...(can(session, 'UserManagement') ? [{ id: 'users', label: 'Users and access' }] : []),
    ...(can(session, 'AuditTrail') ? [{ id: 'audit', label: 'Audit trail' }] : [])
  ];
  // If the current page is not allowed (for example after access changed), show the first allowed page.
  const wanted = view.name === 'sample' ? 'samples' : view.name;
  const allowed = tabs.map((t) => t.id);
  const active = allowed.includes(wanted) ? wanted : allowed[0];
  const page = active === wanted ? view.name : active;
  const signOut = () => { saveSession(null); setSession(null); };

  return (
    <div className="shell">
      <header className="topbar">
        <button className="sidebar-toggle" type="button"
          aria-label={sidebarOpen ? 'Hide navigation' : 'Show navigation'}
          aria-expanded={sidebarOpen}
          aria-controls="main-navigation"
          onClick={() => setSidebarOpen((open) => !open)}>
          <span aria-hidden="true">{sidebarOpen ? '‹' : '☰'}</span>
        </button>
        <div className="brand">Multi-Domain LIMS</div>
        <div className="who">
          <span>{session.username}</span>
          <button className="link" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <div className="workspace">
        {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
        <aside id="main-navigation" className={`sidebar ${sidebarOpen ? '' : 'closed'}`} aria-hidden={!sidebarOpen}>
          <nav className="tabs" aria-label="Main">
            {tabs.map((t) => (
              <button key={t.id} className={`tab ${active === t.id ? 'on' : ''}`}
                aria-current={active === t.id ? 'page' : undefined}
                tabIndex={sidebarOpen ? 0 : -1}
                onClick={() => {
                  setView({ name: t.id });
                  if (window.matchMedia('(max-width: 640px)').matches) setSidebarOpen(false);
                }}>{t.label}</button>
            ))}
          </nav>
        </aside>
        <main className="page">
          {!active && (
            <p className="empty">You do not have access to any module yet. Ask a user who manages access to tick the modules you need.</p>
          )}
          {page === 'samples' && <Samples session={session} onOpen={(id) => setView({ name: 'sample', id })} />}
          {page === 'sample' && (
            <SampleDetail id={view.id} session={session}
              onBack={() => setView({ name: 'samples' })}
              onEnterResults={(sampleId) => setView({ name: 'results', sampleId })} />
          )}
          {page === 'results' && (
            <ResultEntry focusSampleId={view.sampleId} onOpenSample={(id) => setView({ name: 'sample', id })} />
          )}
          {page === 'reports' && <Reports />}
          {page === 'config' && <Config />}
          {page === 'users' && <Users session={session} />}
          {page === 'audit' && <Audit />}
        </main>
      </div>
    </div>
  );
}
