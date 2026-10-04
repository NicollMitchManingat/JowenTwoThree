import { useState, useEffect, useMemo, useRef } from 'react'
import { CookingPot, Plus, Pencil, Trash2, X, AlertTriangle, Search, Minus, CopyPlus, Check, ChevronDown } from 'lucide-react'
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
  // ── QoL state ──
  const [productSearch, setProductSearch] = useState('')
  const [coverageFilter, setCoverageFilter] = useState('all') // all | missing | complete
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [mode, setMode] = useState('single') // single | bulk
  const [bulkSearch, setBulkSearch] = useState('')
  const [bulkChecked, setBulkChecked] = useState({})
  const [bulkQty, setBulkQty] = useState({})
  const [bulkError, setBulkError] = useState('')
  const [hideOutOfStock, setHideOutOfStock] = useState(false)
  // ── Custom product dropdown (badges can't render inside native <option>) ──
  const [productOpen, setProductOpen] = useState(false)
  const [activeProductIndex, setActiveProductIndex] = useState(0)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const productSearchRef = useRef(null)

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

  const recipeCountByProduct = useMemo(() => {
    const map = new Map()
    for (const r of recipes || []) {
      const k = String(r.product_id)
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [recipes])

  const uncoveredProducts = useMemo(() => {
    const covered = new Set((recipes || []).map((r) => String(r.product_id)))
    return (products || []).filter((p) => !covered.has(String(p.id)))
  }, [products, recipes])

  const selectedProductName = (products || []).find((p) => String(p.id) === String(selectedProduct))?.name || ''
  const selectedRecipeCount = recipeCountByProduct.get(String(selectedProduct)) || 0
  const selectedHasRecipe = selectedRecipeCount > 0
  const totalProducts = (products || []).length
  const missingCount = uncoveredProducts.length
  const coveredCount = totalProducts - missingCount

  // Product dropdown options: search + coverage filter. Always keep the
  // currently-selected product visible so filtering never orphans the value.
  const visibleProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    return (products || []).filter((p) => {
      const has = (recipeCountByProduct.get(String(p.id)) || 0) > 0
      if (coverageFilter === 'missing' && has) return false
      if (coverageFilter === 'complete' && !has) return false
      if (q && !p.name.toLowerCase().includes(q)) {
        return String(p.id) === String(selectedProduct)
      }
      return true
    })
  }, [products, productSearch, coverageFilter, recipeCountByProduct, selectedProduct])

  // Close custom dropdown on outside click / Escape, autofocus search on open.
  useEffect(() => {
    if (!productOpen) return
    const onDown = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setProductOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setProductOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [productOpen])

  useEffect(() => {
    if (productOpen) {
      setActiveProductIndex(() => {
        const idx = visibleProducts.findIndex((p) => String(p.id) === String(selectedProduct))
        return idx >= 0 ? idx : 0
      })
      // Focus search so typing filters immediately.
      setTimeout(() => productSearchRef.current?.focus(), 0)
    }
  }, [productOpen, visibleProducts, selectedProduct])

  const selectProductAndClose = (id) => {
    setSelectedProduct(id)
    setProductOpen(false)
    triggerRef.current?.focus()
  }

  const existingIdsForSelected = useMemo(
    () => new Set(linesForSelected.map((l) => String(l.inventory_id))),
    [linesForSelected]
  )

  // Single-add ingredient options: text search across name + unit.
  const filteredInventoryForSingle = useMemo(() => {
    const q = ingredientSearch.trim().toLowerCase()
    if (!q) return inventory || []
    return (inventory || []).filter((i) =>
      `${i.name || ''} ${i.unit || ''}`.toLowerCase().includes(q)
    )
  }, [inventory, ingredientSearch])

  // Bulk-add rows: search + optional out-of-stock hiding + already-added last.
  const bulkRows = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase()
    let rows = inventory || []
    if (q) {
      rows = rows.filter((i) =>
        `${i.name || ''} ${i.unit || ''}`.toLowerCase().includes(q)
      )
    }
    if (hideOutOfStock) {
      rows = rows.filter((i) => Number(i.stock_quantity) > 0)
    }
    return [...rows].sort((a, b) => {
      const aIn = existingIdsForSelected.has(String(a.id)) ? 1 : 0
      const bIn = existingIdsForSelected.has(String(b.id)) ? 1 : 0
      if (aIn !== bIn) return aIn - bIn
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
  }, [inventory, bulkSearch, hideOutOfStock, existingIdsForSelected])

  const openAdd = () => {
    setEditing(null)
    setForm({ inventory_id: '', qty: '' })
    setFormError('')
    setBulkError('')
    setIngredientSearch('')
    setBulkSearch('')
    setBulkChecked({})
    setBulkQty({})
    setMode('single')
    setShowForm(true)
  }

  const openEdit = (line) => {
    setEditing(line)
    setForm({ inventory_id: String(line.inventory_id), qty: String(line.qty_per_sale) })
    setFormError('')
    setBulkError('')
    setIngredientSearch('')
    setMode('single')
    setShowForm(true)
  }

  const closeForm = () => {
    if (saving) return
    setShowForm(false)
    setEditing(null)
    setFormError('')
    setBulkError('')
  }

  const previewIngredient = inventoryById.get(String(form.inventory_id))
  const previewQty = Number(form.qty)
  const isDuplicateSingle = !editing && form.inventory_id !== '' && existingIdsForSelected.has(String(form.inventory_id))
  // ~servings the current stock can support at the typed qty (floor).
  const previewServings = previewIngredient && previewQty > 0
    ? Math.floor(Number(previewIngredient.stock_quantity) / previewQty)
    : null
  const previewExceedsStock = previewIngredient && previewQty > 0
    && Number.isFinite(Number(previewIngredient.stock_quantity))
    && previewQty > Number(previewIngredient.stock_quantity)

  const bumpQty = (delta) => {
    setForm((f) => {
      const cur = Number(f.qty)
      const base = Number.isFinite(cur) && f.qty !== '' ? cur : 0
      const next = Math.max(0, Math.round((base + delta) * 100) / 100)
      return { ...f, qty: next === 0 ? '' : String(next) }
    })
  }

  const persistSingle = async ({ inventory_id, qty }) => {
    if (editing) {
      await db.updateRecipeLine(editing.product_id, editing.inventory_id, Number(qty))
    } else {
      await db.createRecipeLine({
        product_id: selectedProduct,
        inventory_id,
        qty_per_sale: Number(qty),
      })
    }
  }

  const handleSave = async (e, { keepOpen = false } = {}) => {
    e?.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      await persistSingle({ inventory_id: form.inventory_id, qty: form.qty })
      await load()
      if (keepOpen && !editing) {
        // Stay in the modal for rapid multi-ingredient entry.
        setForm({ inventory_id: '', qty: '' })
        setIngredientSearch('')
      } else {
        setShowForm(false)
      }
    } catch (err) {
      setFormError(err?.message || 'Failed to save recipe line')
    } finally {
      setSaving(false)
    }
  }

  const toggleBulk = (id) => {
    if (existingIdsForSelected.has(String(id))) return
    setBulkChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const bulkSelectedIds = useMemo(
    () => Object.keys(bulkChecked).filter((id) => bulkChecked[id] && !existingIdsForSelected.has(String(id))),
    [bulkChecked, existingIdsForSelected]
  )

  const handleBulkSave = async (e) => {
    e?.preventDefault()
    setBulkError('')
    setFormError('')
    const entries = bulkSelectedIds
      .map((id) => ({ id, qty: Number(bulkQty[id]) }))
      .filter((r) => r.qty > 0 && Number.isFinite(r.qty))
    if (entries.length === 0) {
      setBulkError('Tick at least one ingredient and set a qty per sale greater than 0.')
      return
    }
    setSaving(true)
    try {
      const failures = []
      for (const row of entries) {
        try {
          await db.createRecipeLine({
            product_id: selectedProduct,
            inventory_id: row.id,
            qty_per_sale: row.qty,
          })
        } catch (err) {
          failures.push(`${inventoryById.get(String(row.id))?.name || row.id}: ${err?.message || 'failed'}`)
        }
      }
      await load()
      if (failures.length > 0) {
        setBulkError(`${failures.length} line(s) not added — ${failures.join('; ')}`)
      } else {
        setShowForm(false)
        setBulkChecked({})
        setBulkQty({})
      }
    } finally {
      setSaving(false)
    }
  }

  const servingsFor = (inv, qty) => {
    const q = Number(qty)
    const stock = Number(inv?.stock_quantity)
    if (!(q > 0) || !Number.isFinite(stock) || stock < 0) return null
    return Math.floor(stock / q)
  }

  return (
    <div data-testid="recipe-manager">
      {loading && <p className="text-muted">Loading recipes...</p>}
      {loadError && <p className="text-danger" data-testid="recipe-load-error">{loadError}</p>}

      {!loading && !loadError && (
        <>
          {uncoveredProducts.length > 0 && (
            <div style={{ margin: '0 0 0.75rem 0' }}>
              <p className="text-sm text-muted flex items-center gap-2" data-testid="recipe-coverage" style={{ margin: '0 0 0.4rem 0' }}>
                <AlertTriangle size={14} className="text-warning" />
                No recipe — sales won't deduct stock:{' '}
                {uncoveredProducts.map((p) => p.name).join(', ')}
              </p>
              <div className="flex gap-2 flex-wrap">
                {uncoveredProducts.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`btn btn-secondary${String(selectedProduct) === String(p.id) ? ' active' : ''}`}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                    title={`Add recipe for ${p.name}`}
                    onClick={() => setSelectedProduct(p.id)}
                    data-testid={`recipe-jump-${p.id}`}
                  >
                    <Plus size={12} /> {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm flex items-center gap-2" data-testid="recipe-coverage-summary" style={{ margin: '0 0 0.6rem 0' }}>
            <span className="badge badge-success">{coveredCount} with recipe</span>
            <span className={`badge ${missingCount > 0 ? 'badge-danger' : 'badge-neutral'}`}>{missingCount} missing</span>
            <span className="text-muted">of {totalProducts} products</span>
          </p>

          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="flex items-center gap-2" style={{ flexWrap: 'nowrap' }}>
              <label className="font-semibold flex items-center gap-2" id="recipe-product-label" style={{ flexShrink: 0 }}>
                <CookingPot size={16} className="text-primary" /> Product
              </label>
              <div style={{ position: 'relative', width: '100%', maxWidth: '340px', flex: '1 1 auto', minWidth: 0 }} ref={popoverRef}>
                <button
                  ref={triggerRef}
                  type="button"
                  className="form-input flex items-center gap-2 recipe-trigger-btn"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    textAlign: 'left', cursor: 'pointer',
                    borderWidth: '2px',
                    borderColor: selectedProduct
                      ? (selectedHasRecipe ? '#27ae60' : 'var(--color-danger)')
                      : undefined,
                  }}
                  aria-labelledby="recipe-product-label"
                  aria-haspopup="listbox"
                  aria-expanded={productOpen}
                  onClick={() => setProductOpen((o) => !o)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setProductOpen(true)
                    }
                  }}
                  data-testid="recipe-product-trigger"
                  data-selected={selectedProduct}
                  data-value={selectedProduct}
                  value={selectedProduct}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {selectedProductName || 'Select a product...'}
                  </span>
                  {selectedProduct && (
                    selectedHasRecipe ? (
                      <span
                        className="badge badge-success"
                        data-testid="recipe-product-trigger-badge"
                        title={`${selectedRecipeCount} ${selectedRecipeCount === 1 ? 'ingredient' : 'ingredients'}`}
                        aria-label={`${selectedRecipeCount} ${selectedRecipeCount === 1 ? 'ingredient' : 'ingredients'}`}
                      >
                        <Check size={11} /> {selectedRecipeCount}
                      </span>
                    ) : (
                      <span className="badge badge-danger" data-testid="recipe-product-trigger-badge">
                        <AlertTriangle size={11} /> No recipe
                      </span>
                    )
                  )}
                  <ChevronDown size={16} style={{ opacity: 0.6, transform: productOpen ? 'rotate(180deg)' : undefined }} />
                </button>
                {/* Hidden native select preserves the old testid/contract for any external harness. */}
                <select
                  aria-hidden="true"
                  tabIndex={-1}
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  data-testid="recipe-product-select"
                  style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
                >
                  {(products || []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {productOpen && (
                  <div
                    role="listbox"
                    aria-label="Products with recipe status"
                    data-testid="recipe-product-list"
                    className="recipe-product-list"
                    style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                      background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                      borderRadius: '10px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                      <input
                        ref={productSearchRef}
                        className="form-input"
                        style={{ paddingLeft: '2rem', width: '100%' }}
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => { setProductSearch(e.target.value); setActiveProductIndex(0) }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setActiveProductIndex((i) => Math.min(i + 1, visibleProducts.length - 1))
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setActiveProductIndex((i) => Math.max(i - 1, 0))
                          } else if (e.key === 'Enter') {
                            e.preventDefault()
                            const target = visibleProducts[activeProductIndex]
                            if (target) selectProductAndClose(target.id)
                          }
                        }}
                        aria-label="Search products"
                        data-testid="recipe-product-search"
                      />
                    </div>
                    <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                      {visibleProducts.length === 0 && (
                        <p className="text-sm text-muted" style={{ padding: '0.75rem' }}>No products match.</p>
                      )}
                      {visibleProducts.map((p, idx) => {
                        const count = recipeCountByProduct.get(String(p.id)) || 0
                        const has = count > 0
                        const isSelected = String(p.id) === String(selectedProduct)
                        const isActive = idx === activeProductIndex
                        return (
                          <div
                            key={p.id}
                            role="option"
                            aria-selected={isSelected}
                            data-testid={`recipe-product-option-${p.id}`}
                            onClick={() => selectProductAndClose(p.id)}
                            onMouseEnter={() => setActiveProductIndex(idx)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.6rem',
                              padding: '0.6rem 0.75rem', cursor: 'pointer',
                              background: isActive ? 'var(--bg-hover)' : isSelected ? 'var(--bg-main)' : 'transparent',
                              borderLeft: `3px solid ${has ? '#27ae60' : 'var(--color-danger)'}`,
                            }}
                          >
                            <span style={{ flex: 1, fontWeight: isSelected ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.name}
                            </span>
                            {has ? (
                              <span
                                className="badge badge-success"
                                data-testid={`recipe-product-badge-${p.id}`}
                                title={`${count} ${count === 1 ? 'ingredient' : 'ingredients'}`}
                              >
                                {count}
                              </span>
                            ) : (
                              <span className="badge badge-danger" data-testid={`recipe-product-badge-${p.id}`}>
                                <AlertTriangle size={11} /> No recipe
                              </span>
                            )}
                            {isSelected && <Check size={14} aria-label="Selected" />}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2" style={{ minHeight: 'var(--filter-control-h)', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <div className="flex items-center recipe-filter-group" role="group" aria-label="Filter products by recipe coverage" style={{ flexShrink: 0, flexWrap: 'nowrap' }}>
                {([
                  ['all', 'All'],
                  ['missing', 'Missing'],
                  ['complete', 'Has recipe'],
                ]).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`btn ${coverageFilter === val ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCoverageFilter(val)}
                    data-testid={`recipe-filter-${val === 'complete' ? 'complete' : val}`}
                    aria-pressed={coverageFilter === val}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary recipe-add-btn" onClick={openAdd} disabled={!selectedProduct} data-testid="recipe-add-btn">
                <Plus size={16} /> Add ingredient
              </button>
            </div>
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
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: mode === 'bulk' ? '560px' : '440px', width: '100%' }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit quantity' : `Add ingredient to ${selectedProductName}`}</h3>
              <button className="btn-icon-small" disabled={saving} onClick={closeForm} aria-label="Close recipe form"><X size={18} /></button>
            </div>
            {!editing && (
              <div className="flex gap-2" role="tablist" aria-label="Add mode">
                <button
                  type="button" role="tab" aria-selected={mode === 'single'}
                  className={`btn ${mode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }} onClick={() => setMode('single')}
                  data-testid="recipe-mode-single"
                >
                  Single
                </button>
                <button
                  type="button" role="tab" aria-selected={mode === 'bulk'}
                  className={`btn ${mode === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }} onClick={() => setMode('bulk')}
                  data-testid="recipe-mode-bulk"
                >
                  <CopyPlus size={14} /> Bulk add
                </button>
              </div>
            )}

            {mode === 'single' || editing ? (
              <form onSubmit={(e) => handleSave(e)}>
                <div className="modal-body">
                  {formError && <p className="text-danger" data-testid="recipe-form-error">{formError}</p>}
                  {!editing && (
                    <div className="form-group">
                      <label>Ingredient <span className="text-danger">*</span></label>
                      <input
                        className="form-input"
                        placeholder="Search ingredients..."
                        value={ingredientSearch}
                        onChange={(e) => setIngredientSearch(e.target.value)}
                        aria-label="Search ingredients"
                        data-testid="recipe-ingredient-search"
                      />
                      <select className="form-input" value={form.inventory_id}
                        onChange={(e) => setForm((f) => ({ ...f, inventory_id: e.target.value }))}
                        data-testid="recipe-ingredient-select" required>
                        <option value="">Select an ingredient...</option>
                        {filteredInventoryForSingle.map((i) => {
                          const already = existingIdsForSelected.has(String(i.id))
                          return (
                            <option key={i.id} value={i.id}>
                              {i.name}{i.unit ? ` (${i.unit})` : ''} — {i.stock_quantity} in stock{already ? ' ✓ in recipe' : ''}
                            </option>
                          )
                        })}
                      </select>
                      {filteredInventoryForSingle.length === 0 && (
                        <p className="text-sm text-muted" data-testid="recipe-ingredient-no-match">
                          No ingredients match "{ingredientSearch}". Clear the search to see all.
                        </p>
                      )}
                      {isDuplicateSingle && (
                        <p className="text-sm text-warning" data-testid="recipe-duplicate-hint">
                          Already in this recipe — saving will ask you to edit its quantity instead.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="form-group">
                    <label>
                      Qty per sale{previewIngredient?.unit ? ` (${previewIngredient.unit})` : ''} <span className="text-danger">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button type="button" className="btn-icon-small" onClick={() => bumpQty(-0.01)} disabled={saving} aria-label="Decrease quantity" data-testid="recipe-qty-dec">
                        <Minus size={14} />
                      </button>
                      <input type="number" className="form-input" placeholder="e.g., 0.20" step="0.01" min="0"
                        value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                        data-testid="recipe-qty-input" required style={{ flex: 1 }} />
                      <button type="button" className="btn-icon-small" onClick={() => bumpQty(0.01)} disabled={saving} aria-label="Increase quantity" data-testid="recipe-qty-inc">
                        <Plus size={14} />
                      </button>
                    </div>
                    {previewIngredient && form.qty && (
                      <p className="text-sm text-muted" data-testid="recipe-preview">
                        Each {selectedProductName} sale deducts {form.qty} {previewIngredient.unit || 'units'} of {previewIngredient.name}.
                      </p>
                    )}
                    {previewServings != null && Number.isFinite(previewServings) && (
                      <p className="text-sm text-muted" data-testid="recipe-servings">
                        Current stock covers ~{previewServings} sale(s) at this qty.
                      </p>
                    )}
                    {previewExceedsStock && (
                      <p className="text-sm text-danger" data-testid="recipe-stock-warning">
                        Qty exceeds on-hand stock ({previewIngredient.stock_quantity} {previewIngredient.unit || ''}) — one sale would drive it negative.
                      </p>
                    )}
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" disabled={saving} onClick={closeForm}>Cancel</button>
                  {!editing && (
                    <button
                      type="button" className="btn btn-secondary" disabled={saving}
                      onClick={(e) => handleSave(e, { keepOpen: true })}
                      data-testid="recipe-save-add-another"
                      title="Save and keep the modal open to add another ingredient"
                    >
                      {saving ? 'Saving...' : 'Save & add another'}
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={saving} data-testid="recipe-save-btn">
                    {saving ? 'Saving...' : editing ? 'Save quantity' : 'Add ingredient'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleBulkSave}>
                <div className="modal-body">
                  {(formError || bulkError) && (
                    <p className="text-danger" data-testid="recipe-form-error">{formError || bulkError}</p>
                  )}
                  <div className="form-group">
                    <label>Search & tick multiple ingredients</label>
                    <input
                      className="form-input"
                      placeholder="Search ingredients..."
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      aria-label="Search ingredients for bulk add"
                      data-testid="recipe-bulk-search"
                    />
                    <label className="text-sm text-muted flex items-center gap-2" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={hideOutOfStock}
                        onChange={(e) => setHideOutOfStock(e.target.checked)}
                        data-testid="recipe-bulk-hide-oos"
                      />
                      Hide out-of-stock (0 on hand)
                    </label>
                  </div>
                  <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }} data-testid="recipe-bulk-list">
                    {bulkRows.length === 0 && (
                      <p className="text-sm text-muted" style={{ padding: '0.75rem' }}>No ingredients match.</p>
                    )}
                    {bulkRows.map((i) => {
                      const already = existingIdsForSelected.has(String(i.id))
                      const checked = !!bulkChecked[i.id] && !already
                      const qty = bulkQty[i.id] ?? ''
                      const servings = servingsFor(i, qty)
                      return (
                        <div
                          key={i.id}
                          className="flex items-center gap-2"
                          style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', opacity: already ? 0.6 : 1 }}
                          data-testid={`recipe-bulk-row-${i.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={already || saving}
                            onChange={() => toggleBulk(i.id)}
                            aria-label={`Add ${i.name} to recipe`}
                            data-testid={`recipe-bulk-check-${i.id}`}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="font-semibold" style={{ fontSize: '0.9rem' }}>
                              {i.name}{i.unit ? ` (${i.unit})` : ''}
                              {already && <span className="text-muted"> — ✓ in recipe</span>}
                            </div>
                            <div className="text-sm text-muted">
                              {i.stock_quantity} in stock
                              {servings != null && qty !== '' && ` → ~${servings} sale(s)`}
                            </div>
                          </div>
                          <input
                            type="number" className="form-input" placeholder="Qty" step="0.01" min="0"
                            style={{ width: '110px' }}
                            value={qty}
                            disabled={already || saving}
                            onChange={(e) => {
                              const v = e.target.value
                              setBulkQty((prev) => ({ ...prev, [i.id]: v }))
                              if (v !== '' && !already) {
                                setBulkChecked((prev) => ({ ...prev, [i.id]: true }))
                              }
                            }}
                            aria-label={`Quantity per sale for ${i.name}`}
                            data-testid={`recipe-bulk-qty-${i.id}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-sm text-muted" data-testid="recipe-bulk-count" style={{ marginTop: '0.5rem' }}>
                    {bulkSelectedIds.length} selected
                    {uncoveredProducts.length > 0 ? '' : ''}
                  </p>
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" disabled={saving} onClick={closeForm}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || bulkSelectedIds.length === 0} data-testid="recipe-bulk-save">
                    {saving ? 'Saving...' : `Add ${bulkSelectedIds.length || ''} ingredient(s)`.trim()}
                  </button>
                </div>
              </form>
            )}
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

  async function handleDeleteConfirm() {
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
}
