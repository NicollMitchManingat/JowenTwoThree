import { useState, useEffect } from 'react';
import { UserCog, RefreshCcw, Tag, Users, CookingPot, Clock, ClipboardList, Receipt } from 'lucide-react';
import { db } from '../services/db';
import DiscountManager from '../components/settings/DiscountManager';
import AccountManager from '../components/settings/AccountManager';
import RecipeManager from '../components/settings/RecipeManager';

const HISTORY_PAGE_SIZE = 10;
const STALE_SESSION_MS = 24 * 3600 * 1000;

export function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

// Pure close-out math over a session window. Mirrors the Transactions tab:
// fully refunded orders leave gross entirely; partial refunds subtract.
// Customer totals sum the M/F/U split (robust against legacy rows).
export function computeSessionSummary(txns, refundsByTxn) {
  const list = txns || [];
  const grouped = refundsByTxn || {};
  let gross = 0;
  let discounts = 0;
  let refunded = 0;
  let refundCount = 0;
  let male = 0;
  let female = 0;
  let unspecified = 0;
  list.forEach((o) => {
    const recs = grouped[o.id] || [];
    const r = recs.reduce((sum, rec) => sum + num(rec.refund_amount), 0);
    refundCount += recs.length;
    if ((o.status || 'COMPLETED') !== 'REFUNDED') {
      gross += num(o.total);
      discounts += num(o.discount);
      refunded += r;
    }
    male += num(o.male_count);
    female += num(o.female_count);
    unspecified += num(o.unspecified_count);
  });
  const orders = list.length;
  const customers = male + female + unspecified;
  return {
    orders,
    gross,
    discounts,
    refunded,
    refundCount,
    net: gross - refunded,
    customers: { total: customers, male, female, unspecified },
    avgOrder: orders > 0 ? gross / orders : 0,
  };
}

export function summarizeSessionWindow(session, summary) {
  const start = new Date(session.started_at).getTime();
  const end = new Date(session.ended_at || Date.now()).getTime();
  const hours = Math.max(Number.isFinite(end - start) ? (end - start) / 3600000 : 0, 1 / 3600);
  return {
    ...summary,
    hours,
    salesPerHour: summary.orders / hours,
    revPerHour: summary.gross / hours,
  };
}

export default function SettingsPage({ currentUser, onLogout }) {
  const [activeSession, setActiveSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionWorking, setSessionWorking] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [handover, setHandover] = useState(null);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyDetailId, setHistoryDetailId] = useState(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSessionLoading(true);
      setSessionError('');
      try {
        const [active, past] = await Promise.all([
          db.getActiveSession(),
          db.getSessions(HISTORY_PAGE_SIZE * 10),
        ]);
        if (!cancelled) {
          setActiveSession(active);
          setHistory((past || []).filter((s) => s.ended_at));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load sessions:', err);
          setSessionError('Session tracking is unavailable (apply the latest database migration to enable it).');
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Live 1s tick only while a session is open.
  useEffect(() => {
    if (!activeSession) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeSession]);

  const handleStart = async () => {
    setSessionWorking(true);
    setSessionError('');
    try {
      const opened = await db.startSession({ by: currentUser.username });
      setActiveSession(opened && opened.started_at ? opened : {
        id: opened?.id ?? null,
        started_at: new Date().toISOString(),
        started_by: currentUser.username,
      });
      setHandover(null);
    } catch (err) {
      setSessionError(err?.message || 'Failed to start session.');
    } finally {
      setSessionWorking(false);
    }
  };

  const handleEnd = async () => {
    if (!activeSession) return;
    setSessionWorking(true);
    setSessionError('');
    try {
      const endedAt = new Date().toISOString();
      let closed = activeSession;
      try {
        if (activeSession.id) {
          closed = await db.endSession(activeSession.id, { by: currentUser.username }) || activeSession;
        }
      } catch (err) {
        console.error('Failed to close session remotely:', err);
      }
      const session = { ...closed, ended_at: closed.ended_at || endedAt };
      setHandoverLoading(true);
      const summary = await loadWindowSummary({ ...session, ended_at: session.ended_at });
      setHandover({ session, summary });
      setActiveSession(null);
      try {
        const past = await db.getSessions(HISTORY_PAGE_SIZE * 10);
        setHistory((past || []).filter((s) => s.ended_at));
        setHistoryPage(0);
      } catch {
        // History refresh is best-effort; the handover above already succeeded.
      }
    } catch (err) {
      setSessionError(err?.message || 'Failed to end session.');
    } finally {
      setHandoverLoading(false);
      setSessionWorking(false);
    }
  };

  const elapsed = activeSession ? now - new Date(activeSession.started_at).getTime() : 0;
  const isStale = activeSession && elapsed > STALE_SESSION_MS;

  const loadWindowSummary = async (session) => {
    const txns = await db.getTransactionsForAnalytics(session.started_at, session.ended_at);
    const ids = (txns || []).map((o) => o.id).filter(Boolean);
    const refunds = await db.getRefundsForTransactions(ids);
    const grouped = {};
    (refunds || []).forEach((r) => {
      if (!grouped[r.transaction_id]) grouped[r.transaction_id] = [];
      grouped[r.transaction_id].push(r);
    });
    return summarizeSessionWindow(session, computeSessionSummary(txns, grouped));
  };

  const handleViewHistory = async (session) => {
    // Toggling the open detail closed; otherwise load that window on demand
    // (one range query — history lists never fan out to N queries).
    if (historyDetailId === session.id && handover?.session?.id === session.id) {
      setHandover(null);
      setHistoryDetailId(null);
      return;
    }
    setHistoryDetailLoading(true);
    try {
      setHandover({ session, summary: await loadWindowSummary(session), fromHistory: true });
      setHistoryDetailId(session.id);
    } catch (err) {
      setSessionError(err?.message || 'Failed to load session details.');
    } finally {
      setHistoryDetailLoading(false);
    }
  };
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages - 1);
  const historySlice = history.slice(
    safeHistoryPage * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE
  );

  return (
    <div className="page-content settings-page">
      <div className="settings-grid">
        <div className="card card-stretch">
          <div className="card-header">
            <h3 className="flex items-center gap-2 m-0">
              <UserCog size={20} className="text-primary" /> My Profile
            </h3>
          </div>
          <div className="card-body card-body-stretch" style={{ gap: '0.5rem' }}>
            <p className="m-0 text-muted">
              Username: <strong className="text-main">{currentUser.username}</strong>
            </p>
            <p className="m-0 text-muted flex items-center gap-2">
              Role:
              <span className={`badge ${currentUser.role === 'admin' ? 'badge-success' : 'badge-neutral'}`}
                style={{ textTransform: 'capitalize' }}>
                {currentUser.role}
              </span>
            </p>
            <button className="btn btn-secondary btn-full"
              onClick={onLogout}>
              <RefreshCcw size={16} /> Switch Account
            </button>
          </div>
        </div>

        {currentUser.role === 'admin' && (
          <div className="card card-stretch" style={{ border: '2px solid var(--color-accent)' }}>
            <div className="card-header">
              <h3 className="m-0 flex items-center gap-2 text-primary">Session Management</h3>
            </div>
            <div className="card-body card-body-stretch">
              {sessionLoading ? (
                <p className="m-0 text-muted">Loading session…</p>
              ) : (
                <>
                  <div className="session-indicator">
                    <div className="session-dot" style={{
                      backgroundColor: activeSession ? 'var(--color-success)' : 'var(--color-danger)',
                      boxShadow: activeSession ? '0 0 8px var(--color-success)' : 'none'
                    }}></div>
                    <span className="font-semibold">{activeSession ? 'Session Active' : 'No Active Session'}</span>
                  </div>
                  {activeSession && (
                    <p className="m-0 text-muted flex items-center gap-2" data-testid="session-timer">
                      <Clock size={16} />
                      <strong className="text-main">{formatElapsed(elapsed)}</strong>
                      <span>
                        since {new Date(activeSession.started_at).toLocaleString()}
                        {activeSession.started_by ? ` · by ${activeSession.started_by}` : ''}
                      </span>
                    </p>
                  )}
                  {isStale && (
                    <p className="m-0 text-sm text-muted" data-testid="session-stale-hint">
                      Running over 24h — did someone forget to close it?
                    </p>
                  )}
                  {sessionError && (
                    <p className="m-0 text-sm text-danger" data-testid="session-error">{sessionError}</p>
                  )}
                  {activeSession ? (
                    <button
                      className="btn btn-danger btn-full"
                      disabled={sessionWorking || handoverLoading}
                      onClick={handleEnd}
                      data-testid="session-end-btn"
                    >
                      {handoverLoading ? 'Closing out…' : 'End Session'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-success btn-full"
                      disabled={sessionWorking || !!sessionError}
                      onClick={handleStart}
                      data-testid="session-start-btn"
                    >
                      {sessionWorking ? 'Starting…' : 'Start Session'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {currentUser.role === 'admin' && handover && (
          <div className="card" style={{ gridColumn: '1 / -1', border: '2px solid var(--color-accent)' }}>
            <div className="card-header">
              <h3 className="m-0 flex items-center gap-2">
                <Receipt size={20} className="text-primary" />
                {handover.fromHistory ? 'Session Details' : 'Shift Handover'}
              </h3>
            </div>
            <div className="card-body" data-testid="session-handover">
              <p className="m-0 text-muted text-sm">
                {new Date(handover.session.started_at).toLocaleString()} → {new Date(handover.session.ended_at).toLocaleString()}
                {' '}({formatElapsed(new Date(handover.session.ended_at) - new Date(handover.session.started_at))})
                {handover.session.started_by ? ` · ran by ${handover.session.started_by}` : ''}
              </p>
              <p className="m-0 font-semibold text-lg" data-testid="handover-net-cash">
                Expected cash: ₱{handover.summary.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-4 flex-wrap text-sm text-muted">
                <span data-testid="handover-orders">{handover.summary.orders} orders</span>
                <span>₱{handover.summary.gross.toLocaleString()} gross</span>
                <span>₱{handover.summary.discounts.toLocaleString()} discounts</span>
                <span data-testid="handover-refunds">
                  {handover.summary.refundCount} refunds (−₱{handover.summary.refunded.toLocaleString()})
                </span>
                <span>
                  {handover.summary.customers.total} customers
                  (M{handover.summary.customers.male}/F{handover.summary.customers.female}/U{handover.summary.customers.unspecified})
                </span>
                <span>₱{handover.summary.avgOrder.toFixed(2)}/order</span>
                <span>{handover.summary.salesPerHour.toFixed(1)} sales/hr</span>
              </div>
              <button className="btn btn-secondary" onClick={() => { setHandover(null); setHistoryDetailId(null); }}>Dismiss</button>
            </div>
          </div>
        )}

        {currentUser.role === 'admin' && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h3 className="m-0 flex items-center gap-2">
                <ClipboardList size={20} className="text-primary" /> Session History
              </h3>
            </div>
            <div className="card table-card table-responsive" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Duration</th><th>By</th><th><span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {historySlice.length > 0 ? historySlice.map((s) => (
                    <tr key={s.id} data-testid={`session-row-${s.id}`}>
                      <td className="text-muted">{new Date(s.started_at).toLocaleString()}</td>
                      <td className="font-semibold">{formatElapsed(new Date(s.ended_at) - new Date(s.started_at))}</td>
                      <td style={{ textTransform: 'capitalize' }}>{s.started_by || '—'}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ minHeight: '34px', padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                          disabled={historyDetailLoading}
                          onClick={() => handleViewHistory(s)}
                          data-testid={`session-view-${s.id}`}
                        >
                          {historyDetailLoading && historyDetailId !== s.id ? 'Loading…' : handover?.session?.id === s.id ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" className="text-center py-4 text-muted">No past sessions yet.</td></tr>
                  )}
                </tbody>
              </table>
              {history.length > 0 && (
                <div className="table-pager">
                  <span aria-live="polite" data-testid="session-pager-count">
                    Showing {safeHistoryPage * HISTORY_PAGE_SIZE + 1}–{Math.min(safeHistoryPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE, history.length)} of {history.length}
                  </span>
                  <div className="action-buttons">
                    <button className="btn btn-secondary" disabled={safeHistoryPage === 0} onClick={() => setHistoryPage(safeHistoryPage - 1)} aria-label="Previous page">Prev</button>
                    <button className="btn btn-secondary" disabled={safeHistoryPage >= totalHistoryPages - 1} onClick={() => setHistoryPage(safeHistoryPage + 1)} aria-label="Next page">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentUser.role === 'admin' && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h3 className="m-0 flex items-center gap-2">
                <Tag size={20} className="text-primary" /> Discount Vouchers
              </h3>
            </div>
            <div className="card-body">
              <DiscountManager currentUser={currentUser} />
            </div>
          </div>
        )}

        {currentUser.role === 'admin' && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h3 className="m-0 flex items-center gap-2">
                <CookingPot size={20} className="text-primary" /> Product Recipes
              </h3>
            </div>
            <div className="card-body">
              <p className="text-sm text-muted desc-mb">
                Each sale automatically deducts these ingredients from stock. Changes apply to the next sale.
              </p>
              <RecipeManager />
            </div>
          </div>
        )}

        {currentUser.role === 'admin' && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h3 className="m-0 flex items-center gap-2">
                <Users size={20} className="text-primary" /> User Accounts
              </h3>
            </div>
            <div className="card-body">
              <p className="text-sm text-muted desc-mb">
                Cashiers run the POS, stockists manage inventory, and only admins view analytics or approve refunds.
              </p>
              <AccountManager currentUser={currentUser} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
