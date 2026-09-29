import { useState, useEffect } from 'react'
import { Tag, Plus, Pencil, X } from 'lucide-react'
import { db } from '../../services/db'

export function formatDiscountLabel(d) {
  if (!d) return 'None'
  return d.type === 'percent' ? `${d.name} (${Number(d.value)}%)` : `${d.name} (₱${Number(d.value).toFixed(2)})`
}

// Admin CRUD for discount vouchers. System rows (PWD/Senior) are locked:
// no edit, no deactivate. Inactive vouchers stay hidden in the POS dropdown.
export default function DiscountManager({ currentUser }) {
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'percent', value: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setDiscounts((await db.getDiscounts()) || [])
    } catch (err) {
      setLoadError(err?.message || 'Failed to load discounts. Run the latest Supabase migration.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', type: 'percent', value: '' })
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (d) => {
    if (d.is_system) return
    setEditing(d)
    setForm({ name: d.name, type: d.type, value: String(d.value) })
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const payload = { ...form, value: Number(form.value) }
      if (editing) {
        await db.updateDiscount(editing.id, payload)
      } else {
        await db.createDiscount({ ...payload, created_by: currentUser?.username })
      }
      setShowForm(false)
      await load()
    } catch (err) {
      setFormError(err?.message || 'Failed to save discount')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (d) => {
    if (d.is_system) return
    try {
      await db.updateDiscount(d.id, { is_active: !d.is_active })
      await load()
    } catch (err) {
      setLoadError(err?.message || 'Failed to update discount')
    }
  }

  return (
    <div data-testid="discount-manager">
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted m-0">Vouchers appear in the POS discount dropdown. PWD/Senior rates are locked by law.</p>
        <button className="btn btn-primary" onClick={openAdd} data-testid="discount-add-btn">
          <Plus size={16} /> Add voucher
        </button>
      </div>

      {loading && <p className="text-muted">Loading discounts...</p>}
      {loadError && <p className="text-danger" data-testid="discount-load-error">{loadError}</p>}

      {!loading && !loadError && (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Value</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id} data-testid={`discount-row-${d.id}`}>
                  <td className="font-semibold">
                    <Tag size={14} className="text-primary" /> {d.name}{' '}
                    {d.is_system && <span className="badge badge-neutral" title="Statutory rate — cannot be changed">Locked</span>}
                  </td>
                  <td>{d.type === 'percent' ? 'Percent (%)' : 'Flat (₱)'}</td>
                  <td>{d.type === 'percent' ? `${Number(d.value)}%` : `₱${Number(d.value).toFixed(2)}`}</td>
                  <td>
                    <span className={`badge ${d.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {!d.is_system && (
                      <div className="flex gap-2">
                        <button className="btn-icon-small" title={`Edit ${d.name}`} aria-label={`Edit ${d.name}`}
                          onClick={() => openEdit(d)} data-testid={`discount-edit-${d.id}`}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleToggle(d)}
                          data-testid={`discount-toggle-${d.id}`}>
                          {d.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {discounts.length === 0 && (
                <tr><td colSpan="5" className="text-center py-4 text-muted">No discounts yet. Add a voucher to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
            <div className="modal-header">
              <h3>{editing ? `Edit ${editing.name}` : 'Add voucher'}</h3>
              <button className="btn-icon-small" disabled={saving} onClick={() => setShowForm(false)} aria-label="Close discount form"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {formError && <p className="text-danger" data-testid="discount-form-error">{formError}</p>}
                <div className="form-group">
                  <label>Name <span className="text-danger">*</span></label>
                  <input type="text" className="form-input" placeholder="e.g., Weekend 15%"
                    value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    data-testid="discount-name-input" required />
                </div>
                <div className="form-group">
                  <label>Type <span className="text-danger">*</span></label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="discount-type" value="percent" checked={form.type === 'percent'}
                        onChange={() => setForm((f) => ({ ...f, type: 'percent' }))} data-testid="discount-type-percent" />
                      Percent (%)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="discount-type" value="flat" checked={form.type === 'flat'}
                        onChange={() => setForm((f) => ({ ...f, type: 'flat' }))} data-testid="discount-type-flat" />
                      Flat (₱)
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label>Value {form.type === 'percent' ? '(1–99%)' : '(₱)'} <span className="text-danger">*</span></label>
                  <input type="number" className="form-input" placeholder={form.type === 'percent' ? 'e.g., 15' : 'e.g., 50'}
                    step="0.01" min="0" value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    data-testid="discount-value-input" required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} data-testid="discount-save-btn">
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Add voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
