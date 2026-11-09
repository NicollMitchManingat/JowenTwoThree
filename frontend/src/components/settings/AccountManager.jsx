import { useEffect, useState } from 'react'
import { UserCog, Plus, Pencil, X, Eye, EyeOff } from 'lucide-react'
import { authAPI } from '../../services/authAPI'
import { MODULES } from '../../services/permissions'
import { ROLES } from '../../services/managerApproval'
const ROLE_LABELS = { admin: 'Admin', cashier: 'Cashier', stockist: 'Stockman' }
const empty = () => ({ username: '', fullName: '', role: 'cashier', currentPassword: '', password: '', permissions: ['pos', 'transactions', 'settings'] })

export default function AccountManager({ currentUser }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const isSelf = account => account.id === currentUser?.id
  async function load() {
    setLoading(true)
    try { setAccounts(await authAPI.listUsers()); setError('') }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  function open(account) {
    setEditing(account || null)
    setForm(account ? { username: account.username, fullName: account.fullName || '', role: account.role,
      currentPassword: '', password: '', permissions: account.permissions || [] } : empty())
    setFormError('')
    setShowCurrentPassword(false)
    setShowPassword(false)
    setShowForm(true)
  }
  function close() {
    setShowForm(false)
    setForm(empty())
    setShowCurrentPassword(false)
    setShowPassword(false)
    setFormError('')
  }
  async function save(e) {
    e.preventDefault()
    if (saving) return
    if (editing && !!form.password !== !!form.currentPassword) {
      setFormError('Enter both the current password and a new password to change it.')
      return
    }
    setSaving(true)
    try {
      const { currentPassword, ...payload } = form
      if (!payload.password && editing) delete payload.password
      if (editing && payload.password) payload.currentPassword = currentPassword
      if (editing) await authAPI.updateUser(editing.id, payload)
      else await authAPI.createUser(payload)
      close()
      if (!(editing && isSelf(editing) && payload.password)) await load()
    } catch (err) { setFormError(err.message) }
    finally { setSaving(false) }
  }
  async function toggle(account) {
    try { await authAPI.updateUser(account.id, { isActive: !account.isActive }); await load() }
    catch (err) { setError(err.message) }
  }
  if (currentUser?.role !== 'admin') return null
  return <div data-testid="account-manager">
    <div className="account-manager-header">
      <p className="text-sm text-muted m-0">Choose the modules each account can access. Administrators retain full access.</p>
      <button className="btn btn-primary" onClick={() => open()} data-testid="account-add-btn"><Plus size={16} /> Add account</button>
    </div>
    {loading && <p className="text-muted">Loading accounts…</p>}
    {error && <p className="text-danger" role="alert" data-testid="account-error">{error}</p>}
    {!loading && <div className="table-responsive"><table className="data-table">
      <thead><tr><th>Username</th><th>Name</th><th>Access Level</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{accounts.map(account => <tr key={account.id} data-testid={`account-row-${account.id}`}>
        <td className="font-semibold"><UserCog size={14} /> {account.username} {isSelf(account) && <span className="badge badge-neutral">You</span>}</td>
        <td>{account.fullName || '-'}</td>
        <td>{MODULES.filter(m => account.permissions?.includes(m.id)).map(m => m.label).join(', ') || 'No modules'}</td>
        <td><span className="badge badge-neutral">{ROLE_LABELS[account.role]}</span></td>
        <td>{account.isActive ? 'Active' : 'Inactive'}</td>
        <td><div className="account-row-actions">
          <button className="btn-icon-small" aria-label={`Edit ${account.username}`} onClick={() => open(account)} data-testid={`account-edit-${account.id}`}><Pencil size={14} /></button>
          {!isSelf(account) && <button className="btn btn-secondary" onClick={() => toggle(account)} data-testid={`account-toggle-${account.id}`}>{account.isActive ? 'Deactivate' : 'Activate'}</button>}
        </div></td>
      </tr>)}{!accounts.length && <tr><td colSpan="6">No accounts found.</td></tr>}</tbody>
    </table></div>}
    {showForm && <div className="modal-overlay" onClick={() => !saving && close()}>
      <div className="modal-content card" onClick={e => e.stopPropagation()} role="dialog" aria-label="Account details" style={{ maxWidth: '480px', width: '100%' }}>
        <div className="modal-header"><h3>{editing ? `Edit ${editing.username}` : 'Add account'}</h3><button className="btn-icon-small" disabled={saving} aria-label="Close account form" onClick={close}><X size={18} /></button></div>
        <form onSubmit={save}><div className="modal-body">
          {formError && <p className="text-danger" role="alert" data-testid="account-form-error">{formError}</p>}
          <div className="form-group"><label htmlFor="account-username">Username</label><input id="account-username" className="form-input" required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} data-testid="account-username-input" /></div>
          <div className="form-group"><label htmlFor="account-fullname">Full name</label><input id="account-fullname" className="form-input" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} data-testid="account-name-input" /></div>
          <div className="form-group"><label htmlFor="account-role">Role</label><select id="account-role" className="form-input" disabled={editing && isSelf(editing)} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, permissions: e.target.value === 'admin' ? MODULES.map(m => m.id) : f.permissions }))} data-testid="account-role-select">{ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
          <fieldset className="form-group"><legend className="text-sm">Access Level</legend>{MODULES.map(m => <label key={m.id} className="flex items-center gap-2" style={{ marginBottom: '0.4rem' }}><input type="checkbox" checked={form.role === 'admin' || form.permissions.includes(m.id)} disabled={form.role === 'admin'} onChange={e => setForm(f => ({ ...f, permissions: e.target.checked ? [...f.permissions, m.id] : f.permissions.filter(id => id !== m.id) }))} />{m.label}</label>)}</fieldset>
          {editing && <div className="form-group">
            <label htmlFor="account-current-password">Current password</label>
            <div className="account-password-field">
              <input id="account-current-password" type={showCurrentPassword ? 'text' : 'password'} className="form-input" autoComplete="current-password" required={!!form.password} disabled={saving} value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} data-testid="account-current-password-input" />
              <button type="button" className="btn-icon-small account-password-toggle" aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'} aria-pressed={showCurrentPassword} disabled={saving} onClick={() => setShowCurrentPassword(v => !v)}>{showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>}
          <div className="form-group">
            <label htmlFor="account-password">{editing ? 'New password (blank keeps current)' : 'Password (min 6 characters)'}</label>
            <div className="account-password-field">
              <input id="account-password" type={showPassword ? 'text' : 'password'} className="form-input" autoComplete="new-password" minLength={6} required={!editing || !!form.currentPassword} disabled={saving} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} data-testid="account-password-input" />
              <button type="button" className="btn-icon-small account-password-toggle" aria-label={`${showPassword ? 'Hide' : 'Show'} ${editing ? 'new password' : 'password'}`} aria-pressed={showPassword} disabled={saving} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {editing && <p className="text-sm text-muted">Leave both password fields blank to keep the current password.{isSelf(editing) ? ' Changing your password signs you out.' : ''}</p>}
          </div>
        </div><div className="modal-footer"><button type="button" className="btn btn-secondary" disabled={saving} onClick={close}>Cancel</button><button className="btn btn-primary" disabled={saving} data-testid="account-save-btn">{saving ? 'Saving…' : 'Save account'}</button></div></form>
      </div>
    </div>}
  </div>
}
