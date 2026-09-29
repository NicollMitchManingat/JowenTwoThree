import { useState, useEffect, useMemo } from 'react'
import { CookingPot, Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { db } from '../../services/db'

// Admin recipe management: which inventory (and how much of it, in the
// inventory row's own unit) each sale of a product deducts.
// Checkout reads product_recipes live, so edits apply to the next sale.
// Table/seed live in frontend/product_recipes.sql (run once in Supabase).
export default function RecipeManager() {
  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [recipes, setRecipes] = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ inventory_id: '', qty: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [prods, inv, lines] = await Promise.all([
        db.getProducts(),
        db.getInventory(),
        db.getAllRecipes(),
      ])
      const prodList = (prods || []).map((p) => ({ id: p.id, name: p.product_name }))
      setProducts(prodList)
      setInventory(inv || [])
      setRecipes(lines || [])
      setSelectedProduct((prev) => prev || prodList[0]?.id || '')
    } catch (err) {
      setLoadError(err?.message || 'Failed to load recipes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const inventoryById = useMemo(
    () => new Map((inventory || []).map((i) => [String(i.id), i])),
    [inventory]
  )

  const linesForSelected = useMemo(
    () => (recipes || []).filter((r) => String(r.product_id) === String(selectedProduct)),
    [recipes, selectedProduct]
  )

  const uncoveredProducts = useMemo(() => {
    const covered = new Set((recipes || []).map((r) => String(r.product_id)))
    return (products || []).filter((p) => !covered.has(String(p.id)))
  }, [products, recipes])

  const selectedProductName = (products || []).find((p) => String(p.id) === String(selectedProduct))?.name || ''

  const openAdd = () => {
    setEditing(null)
    setForm({ inventory_id: '', qty: '' })
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (line) => {
    setEditing(line)
    setForm({ inventory_id: String(line.inventory_id), qty: String(line.qty_per_sale) })
    setFormError('')
    setShowForm(true)
  }

  const previewIngredient = inventoryById.get(String(form.inventory_id))

  const handleSave = async (e) => {
    e?.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      if (editing) {
        await db.updateRecipeLine(editing.product_id, editing.inventory_id, Number(form.qty))
      } else {
        await db.createRecipeLine({
          product_id: selectedProduct,
          inventory_id: form.inventory_id,
          qty_per_sale: Number(form.qty),
        })
      }
      setShowForm(false)
      await load()
    } catch (err) {
      setFormError(err?.message || 'Failed to save recipe line')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await db.deleteRecipeLine(deleteTarget.product_id, deleteTarget.inventory_id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setFormError(err?.message || 'Failed to delete recipe line')
      setDeleteTarget(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="recipe-manager">
      {loading && <p className="text-muted">Loading recipes...</p>}
      {loadError && <p className="text-danger" data-testid="recipe-load-error">{loadError}</p>}

      {!loading && !loadError && (
        <>
          {uncoveredProducts.length > 0 && (
            <p className="text-sm text-muted flex items-center gap-2" data-testid="recipe-coverage" style={{ margin: '0 0 0.75rem 0' }}>
              <AlertTriangle size={14} className="text-warning" />
              No recipe — sales won't deduct stock:{' '}
              {uncoveredProducts.map((p) => p.name).join(', ')}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '1rem' }}>
            <label className="font-semibold flex items-center gap-2">
              <CookingPot size={16} className="text-primary" /> Product
            </label>
            <select
              className="form-input"
              style={{ maxWidth: '280px' }}
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              data-testid="recipe-product-select"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={openAdd} disabled={!selectedProduct} data-testid="recipe-add-btn">
              <Plus size={16} /> Add ingredient
            </button>
          </div>

          {linesForSelected.length === 0 ? (
            <p className="text-muted" data-testid="recipe-empty">
              No recipe lines for {selectedProductName || 'this product'} yet. Sales won't deduct stock until you add ingredients.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr><th>Ingredient</th><th>Qty per sale</th><th>In stock</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {linesForSelected.map((line, idx) => {
                    const inv = inventoryById.get(String(line.inventory_id))
                    return (
                      <tr key={`${line.product_id}-${line.inventory_id}`} data-testid={`recipe-line-${idx}`}>
                        <td className="font-semibold">{line.inventory?.name || inv?.name || 'Unknown'}</td>
                        <td>{Number(line.qty_per_sale)} {inv?.unit || line.inventory?.unit || ''}</td>
                        <td className="text-muted">{inv != null ? `${inv.stock_quantity} ${inv.unit || ''}` : '-'}</td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn-icon-small" title="Edit quantity" aria-label={`Edit quantity for ${inv?.name || 'ingredient'}`}
                              onClick={() => openEdit(line)} data-testid={`recipe-edit-${idx}`}>
                              <Pencil size={14} />
                            </button>
                            <button className="btn-icon-small danger" title="Remove ingredient" aria-label={`Remove ${inv?.name || 'ingredient'} from recipe`}
                              onClick={() => setDeleteTarget(line)} data-testid={`recipe-delete-${idx}`}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit quantity' : `Add ingredient to ${selectedProductName}`}</h3>
              <button className="btn-icon-small" disabled={saving} onClick={() => setShowForm(false)} aria-label="Close recipe form"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {formError && <p className="text-danger" data-testid="recipe-form-error">{formError}</p>}
                {!editing && (
                  <div className="form-group">
                    <label>Ingredient <span className="text-danger">*</span></label>
                    <select className="form-input" value={form.inventory_id}
                      onChange={(e) => setForm((f) => ({ ...f, inventory_id: e.target.value }))}
                      data-testid="recipe-ingredient-select" required>
                      <option value="">Select an ingredient...</option>
                      {(inventory || []).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}{i.unit ? ` (${i.unit})` : ''} — {i.stock_quantity} in stock
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>
                    Qty per sale{previewIngredient?.unit ? ` (${previewIngredient.unit})` : ''} <span className="text-danger">*</span>
                  </label>
                  <input type="number" className="form-input" placeholder="e.g., 0.20" step="0.01" min="0"
                    value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                    data-testid="recipe-qty-input" required />
                  {previewIngredient && form.qty && (
                    <p className="text-sm text-muted" data-testid="recipe-preview">
                      Each {selectedProductName} sale deducts {form.qty} {previewIngredient.unit || 'units'} of {previewIngredient.name}.
                    </p>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} data-testid="recipe-save-btn">
                  {saving ? 'Saving...' : editing ? 'Save quantity' : 'Add ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}
            role="dialog" aria-labelledby="recipe-delete-title" data-testid="recipe-delete-modal"
            style={{ maxWidth: '440px', width: '100%' }}>
            <div className="modal-header">
              <h3 id="recipe-delete-title">Remove ingredient?</h3>
              <button className="btn-icon-small" onClick={() => setDeleteTarget(null)} aria-label="Close delete confirmation"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted m-0">
                Future sales of <strong>{selectedProductName}</strong> will no longer deduct{' '}
                <strong>{inventoryById.get(String(deleteTarget.inventory_id))?.name || 'this ingredient'}</strong>.
                Past deductions are kept.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} data-testid="recipe-delete-cancel">Cancel</button>
              <button className="btn btn-primary" onClick={handleDeleteConfirm} data-testid="recipe-delete-confirm">Confirm remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
