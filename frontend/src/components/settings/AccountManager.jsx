import { useState } from 'react'
import { UserCog, Plus, Pencil, X, Lock } from 'lucide-react'
import { authAPI } from '../../services/authAPI'
import { ROLES } from '../../services/managerApproval'

const ROLE_LABELS = { admin: 'Admin', cashier: 'Cashier', stockist: 'Stockist' }

// Admin account management (add / edit / deactivate / reset password).
// Passwords are bcrypt-hashed server-side; the browser never sees a hash.
// The admin unlocks this panel with their own password (kept in memory only)
// and every request re-verifies it — the app has no sessions/tokens.
export default function AccountManager({ currentUser }) {
  const [unlockPassword, setUnlockPassword] = useState('')
  const [creds, setCreds] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ username: '', fullName: '', email: '', role: 'cashier', password: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async (username, password) => {
    setLoading(true)
    setError('')
    try {
      setAccounts(await authAPI.listUsers(username, password))
      setCreds({ username, password })
    } catch (err) {
      setError(err?.message || 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async (e) => {
    e?.preventDefault()
    if (!unlockPassword) {
      setError('Enter your admin password to manage accounts')
      return
    }
    await load(currentUser?.username, unlockPassword)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ username: '', fullName: '', email: '', role: 'cashier', password: '' })
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (account) => {
    setEditing(account)
    setForm({ username: account.username, fullName: account.fullName || '', email: account.email || '', role: account.role, password: '' })
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      if (editing) {
        const updates = { fullName: form.fullName, email: form.email, role: form.role }
        if (form.password) updates.password = form.password
        await authAPI.updateUser(editing.id, updates, creds.username, creds.password)
      } else {
        await authAPI.createUser(
          { username: form.username, fullName: form.fullName, email: form.email, role: form.role, password: form.password },
          creds.username, creds.password
        )
      }
      setShowForm(false)
      await load(creds.username, creds.password)
    } catch (err) {
      setFormError(err?.message || 'Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (account) => {
    setError('')
    try {
      await authAPI.updateUser(account.id, { isActive: !account.isActive }, creds.username, creds.password)
      await load(creds.username, creds.password)
    } catch (err) {
      setError(err?.message || 'Failed to update account')
    }
  }

  const isSelf = (account) => account.username === currentUser?.username

  if (!creds) {
    return (
      <div data-testid="account-manager">
        <p className="text-sm text-muted account-unlock-text">Manage cashier and stockist accounts. Enter your admin password to unlock — it is only kept in memory for this panel.</p>
        {error && <p className="text-danger" data-testid="account-error">{error}</p>}
        <form onSubmit={handleUnlock} className="account-unlock-form">
          <label className="flex items-center gap-2">
            <Lock size={14} /> Admin password
          </label>
          <input type="password" className="form-input" style={{ maxWidth: '240px' }}
            placeholder="Your admin password" value={unlockPassword}
            onChange={(e) => setUnlockPassword(e.target.value)}
            data-testid="account-unlock-password" />
          <button type="submit" className="btn btn-primary" disabled={loading} data-testid="account-unlock-btn">
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div data-testid="account-manager">
      <div className="account-manager-header">
        <p className="text-sm text-muted m-0">Deactivated accounts cannot sign in. You cannot deactivate or demote yourself or the last admin.</p>
        <button className="btn btn-primary" onClick={openAdd} data-testid="account-add-btn">
          <Plus size={16} /> Add account
        </button>
      </div>

      {loading && <p className="text-muted">Loading accounts...</p>}
      {error && <p className="text-danger" data-testid="account-error">{error}</p>}

      {!loading && (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr><th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} data-testid={`account-row-${a.id}`}>
                  <td className="font-semibold">
                    <UserCog size={14} className="text-primary" /> {a.username}
                    {isSelf(a) && <span className="badge badge-neutral" title="This is you">You</span>}
                  </td>
                  <td>{a.fullName || '-'}</td>
                  <td className="text-muted">{a.email || '-'}</td>
                  <td><span className={`badge ${a.role === 'admin' ? 'badge-success' : 'badge-neutral'}`}>{ROLE_LABELS[a.role] || a.role}</span></td>
                  <td><span className={`badge ${a.isActive ? 'badge-success' : 'badge-neutral'}`}>{a.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="account-row-actions">
                      <button className="btn-icon-small" title={`Edit ${a.username}`} aria-label={`Edit ${a.username}`}
                        onClick={() => openEdit(a)} data-testid={`account-edit-${a.id}`}>
                        <Pencil size={14} />
                      </button>
                      {!isSelf(a) && (
                        <button className="btn btn-secondary" onClick={() => handleToggle(a)}
                          data-testid={`account-toggle-${a.id}`}>
                          {a.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan="6" className="text-center py-4 text-muted">No accounts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
            <div className="modal-header">
              <h3>{editing ? `Edit ${editing.username}` : 'Add account'}</h3>
              <button className="btn-icon-small" disabled={saving} onClick={() => setShowForm(false)} aria-label="Close account form"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {formError && <p className="text-danger" data-testid="account-form-error">{formError}</p>}
                {!editing && (
                  <div className="form-group">
                    <label>Username <span className="text-danger">*</span></label>
                    <input type="text" className="form-input" placeholder="e.g., cashier2"
                      value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      data-testid="account-username-input" required />
                  </div>
                )}
                <div className="form-group">
                  <label>Full name</label>
                  <input type="text" className="form-input" placeholder="e.g., Maria Santos"
                    value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    data-testid="account-name-input" />
                </div>
                <div className="form-group">
                  <label>Email <span className="text-danger">*</span></label>
                  <input type="email" className="form-input" placeholder="e.g., maria@jowen.com"
                    value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    data-testid="account-email-input" required />
                </div>
                <div className="form-group">
                  <label>Role <span className="text-danger">*</span></label>
                  <select className="form-input" value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    data-testid="account-role-select"
                    disabled={editing && isSelf(editing)}
                    title={editing && isSelf(editing) ? 'You cannot change your own role' : undefined}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{editing ? 'New password (blank keeps current)' : 'Password (min 6 characters)'} {!editing && <span className="text-danger">*</span>}</label>
                  <input type="password" className="form-input" placeholder={editing ? 'Leave blank to keep' : 'e.g., cafe123'}
                    value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    data-testid="account-password-input" required={!editing} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} data-testid="account-save-btn">
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Add account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
