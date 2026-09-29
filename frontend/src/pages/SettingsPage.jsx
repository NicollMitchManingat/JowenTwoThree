import { useState } from 'react';
import { UserCog, RefreshCcw, Tag, Users, CookingPot } from 'lucide-react';
import DiscountManager from '../components/settings/DiscountManager';
import AccountManager from '../components/settings/AccountManager';
import RecipeManager from '../components/settings/RecipeManager';

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
