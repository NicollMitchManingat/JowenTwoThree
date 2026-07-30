import { useState } from 'react';
import { UserCog, ShieldAlert, RefreshCcw } from 'lucide-react';

export default function SettingsPage({ currentUser, onLogout }) {
  const [isSessionActive, setIsSessionActive] = useState(false);

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
              <div className="session-indicator">
                <div className="session-dot" style={{
                  backgroundColor: isSessionActive ? 'var(--color-success)' : 'var(--color-danger)',
                  boxShadow: isSessionActive ? '0 0 8px var(--color-success)' : 'none'
                }}></div>
                <span className="font-semibold">{isSessionActive ? 'Session Active' : 'No Active Session'}</span>
              </div>
              <button
                className={`btn btn-full ${isSessionActive ? 'btn-danger' : 'btn-success'}`}
                onClick={() => setIsSessionActive(!isSessionActive)}
              >
                {isSessionActive ? 'End Session' : 'Start Session'}
              </button>
            </div>
          </div>
        )}

        {currentUser.role === 'admin' && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h3 className="m-0 flex items-center gap-2">
                <ShieldAlert size={20} className="text-danger" /> Access Control
              </h3>
            </div>
            <div className="card-body">
              <p className="text-sm text-muted desc-mb">
                Manage employee access levels. Only admins can view analytics and modify inventory.
              </p>
              <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr><th>User</th><th>Username</th><th>Role</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold">Admin</td>
                    <td className="text-muted">admin</td>
                    <td><span className="badge badge-success">ADMIN</span></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Staff</td>
                    <td className="text-muted">staff</td>
                    <td><span className="badge badge-neutral">STAFF</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
