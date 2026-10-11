import { useState, useEffect } from 'react';
import { UserCog, RefreshCcw, Tag, Users, CookingPot, Clock, Receipt, Lock, X } from 'lucide-react';
import { db } from '../services/db';
import { authAPI } from '../services/authAPI';
import { formatElapsed, loadSessionSummary } from '../services/sessionAnalytics';
import DiscountManager from '../components/settings/DiscountManager';
import AccountManager from '../components/settings/AccountManager';
import RecipeManager from '../components/settings/RecipeManager';

const STALE_SESSION_MS = 24 * 3600 * 1000;

export default function SettingsPage({ currentUser, onLogout }) {
  const isAdmin = currentUser.role === 'admin';
  const canUseSessions = isAdmin || currentUser.role === 'cashier';
  const [activeSession, setActiveSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionWorking, setSessionWorking] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [handover, setHandover] = useState(null);
  const [handoverLoading, setHandoverLoading] = useState(false);
  // Manager-approval gate for non-admins (mirrors the refund flow):
  // 'start' | 'end' | null.
  const [gateAction, setGateAction] = useState(null);
  const [gatePassword, setGatePassword] = useState('');
  const [gateError, setGateError] = useState('');
  const [gateWorking, setGateWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSessionLoading(true);
      setSessionError('');
      try {
        const active = await db.getActiveSession();
        if (!cancelled) setActiveSession(active);
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

  const handleStart = async (approvedBy) => {
    setSessionWorking(true);
    setSessionError('');
    try {
      const opened = await db.startSession({ by: currentUser.username, approvedBy });
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

  const handleEnd = async (approvedBy) => {
    if (!activeSession) return;
    setSessionWorking(true);
    setSessionError('');
    try {
      const endedAt = new Date().toISOString();
      let closed = activeSession;
      try {
        if (activeSession.id) {
          closed = await db.endSession(activeSession.id, { by: currentUser.username, approvedBy }) || activeSession;
        }
      } catch (err) {
        console.error('Failed to close session remotely:', err);
      }
      const session = { ...closed, ended_at: closed.ended_at || endedAt };
      setHandoverLoading(true);
      const summary = await loadSessionSummary(session);
      setHandover({ session, summary });
      setActiveSession(null);
    } catch (err) {
      setSessionError(err?.message || 'Failed to end session.');
    } finally {
      setHandoverLoading(false);
      setSessionWorking(false);
    }
  };

  // Admins act directly; cashiers go through the manager-password gate.
  // The cashier session never changes — approval is only recorded.
  const requestStart = () => {
    if (isAdmin) void handleStart(currentUser.username);
    else openGate('start');
  };

  const requestEnd = () => {
    if (isAdmin) void handleEnd(currentUser.username);
    else openGate('end');
  };

  const openGate = (action) => {
    setGateAction(action);
    setGatePassword('');
    setGateError('');
  };

  const closeGate = () => {
    if (gateWorking) return;
    setGateAction(null);
    setGatePassword('');
    setGateError('');
  };

  const handleGateConfirm = async () => {
    setGateError('');
    let approvedBy;
    try {
      const check = await authAPI.verifyManager(gatePassword);
      approvedBy = check.username;
    } catch (err) {
      setGateError(err?.message || 'Manager approval failed');
      return;
    }
    setGateWorking(true);
    try {
      if (gateAction === 'start') await handleStart(approvedBy);
      else await handleEnd(approvedBy);
      setGateAction(null);
      setGatePassword('');
    } finally {
      setGateWorking(false);
    }
  };

  const elapsed = activeSession ? now - new Date(activeSession.started_at).getTime() : 0;
  const isStale = activeSession && elapsed > STALE_SESSION_MS;

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

        {canUseSessions && (
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
                  {!isAdmin && (
                    <p className="m-0 text-sm text-muted" data-testid="session-gate-hint">
                      Starting or ending a session needs the manager password.
                    </p>
                  )}
                  {activeSession ? (
                    <button
                      className="btn btn-danger btn-full"
                      disabled={sessionWorking || handoverLoading}
                      onClick={requestEnd}
                      data-testid="session-end-btn"
                    >
                      {handoverLoading ? 'Closing out…' : 'End Session'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-success btn-full"
                      disabled={sessionWorking || !!sessionError}
                      onClick={requestStart}
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

        {canUseSessions && handover && (
          <div className="card" style={{ gridColumn: '1 / -1', border: '2px solid var(--color-accent)' }}>
            <div className="card-header">
              <h3 className="m-0 flex items-center gap-2">
                <Receipt size={20} className="text-primary" /> Shift Handover
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
              <button className="btn btn-secondary" onClick={() => setHandover(null)}>Dismiss</button>
            </div>
          </div>
        )}

        {gateAction && (
          <div className="modal-overlay" onClick={closeGate}>
            <div className="modal-content card" onClick={(e) => e.stopPropagation()}
              role="dialog" aria-labelledby="session-gate-title" data-testid="session-gate-modal"
              style={{ maxWidth: '400px', width: '100%' }}>
              <div className="modal-header">
                <h3 id="session-gate-title">Manager approval needed</h3>
                <button className="btn-icon-small" onClick={closeGate} aria-label="Close approval"><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p className="text-sm text-muted mb-3">
                  {gateAction === 'start' ? 'Starting' : 'Ending'} a session needs a manager.
                  Enter the admin password — you stay signed in as {currentUser.username}.
                </p>
                <div className="form-group">
                  <label htmlFor="session-gate-password">Admin password</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="session-gate-password"
                      type="password"
                      className="form-input"
                      value={gatePassword}
                      onChange={(e) => setGatePassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && gatePassword && !gateWorking) handleGateConfirm(); }}
                      placeholder="Enter admin password"
                      autoFocus
                      data-testid="session-gate-password"
                    />
                  </div>
                </div>
                {gateError && <p className="m-0 text-sm text-danger" data-testid="session-gate-error">{gateError}</p>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeGate} disabled={gateWorking}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={!gatePassword || gateWorking}
                  onClick={handleGateConfirm}
                  data-testid="session-gate-confirm-btn"
                >
                  {gateWorking ? 'Verifying…' : `Approve & ${gateAction === 'start' ? 'start' : 'end'}`}
                </button>
              </div>
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
