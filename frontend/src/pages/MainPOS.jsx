import { useState, useEffect, useRef, useEffect as useLayoutEffect } from "react";
import { ShoppingCart, Plus, Minus, Users, Tag, X, Search, Coffee, CakeSlice, RefreshCcw, Printer } from 'lucide-react';
import { db } from '../services/db';

export default function MainPOS({ user }) {
  const [customerCount, setCustomerCount] = useState(0);
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState('none');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productNote, setProductNote] = useState('');
  const [selectedSize, setSelectedSize] = useState('Small');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [prods, cats] = await Promise.all([
          db.getProducts(),
          db.getCategories(),
        ])
        setProducts(prods.map(p => ({
          id: p.id,
          name: p.product_name,
          price: Number(p.selling_price),
          category: p.product_categories?.name || 'Other',
        })))
        setCategories(['All', ...new Set(prods.map(p => p.product_categories?.name || 'Other'))])
      } catch (err) {
        console.error('Failed to load products:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredMenu = products.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCustomerCount = (e) => {
    const val = e.target.value;
    if (val === '') { setCustomerCount(''); return; }
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) setCustomerCount(num);
  };
  const handleCustomerBlur = () => { if (customerCount === '') setCustomerCount(0); };
  const incrementCount = () => setCustomerCount(prev => (prev || 0) + 1);
  const decrementCount = () => setCustomerCount(prev => (prev > 0 ? prev - 1 : 0));

  const resetOrder = () => { setCart([]); setCustomerCount(0); setDiscountType('none'); };

  const openProductModal = (item) => {
    setSelectedProduct(item);
    setProductNote('');
    setSelectedSize(null);
  };

  const handleConfirmAdd = () => {
    if (!selectedProduct) return;
    const finalPrice = selectedProduct.price;
    const displayName = selectedProduct.name;

    setCart(prev => {
      const existing = prev.find(i => i.productId === selectedProduct.id && i.note === productNote.trim());
      if (existing) {
        return prev.map(i => i.cartItemId === existing.cartItemId ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { productId: selectedProduct.id, name: displayName, price: finalPrice, qty: 1, note: productNote.trim(), cartItemId: Date.now() + Math.random() }];
    });

    if (customerCount === 0) setCustomerCount(1);
    setSelectedProduct(null);
    setProductNote('');
  };

  const handleCheckout = async () => {
    if (cart.length === 0 && customerCount === 0) return;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let discountMultiplier = 0;
    if (discountType === 'pwd' || discountType === 'senior') discountMultiplier = 0.20;
    if (discountType === 'promo') discountMultiplier = 0.10;
    const discountAmount = subtotal * discountMultiplier;
    const total = subtotal - discountAmount;

    try {
      const txn = await db.createTransaction({
        transaction_number: `TXN-${Date.now()}`,
        idempotency_key: `${Date.now()}-${Math.random()}`,
        subtotal,
        discount: discountAmount,
        total,
        payment_method: 'CASH',
        cash_received: total,
        change_amount: 0,
        customer_count: customerCount,
        special_instructions: '',
        discount_type: discountType !== 'none' ? discountType : null,
        discount_value: discountAmount,
        cart,
      })

      const items = cart.map(item => ({
        transaction_id: txn.id,
        product_id: item.productId,
        quantity: item.qty,
        unit_price: item.price,
        subtotal: item.price * item.qty,
      }))
      await db.createTransactionItems(items)

      if (customerCount > 0) {
        await db.logTraffic(customerCount)
      }

      const receiptData = {
        transaction: txn,
        items: cart.map(item => ({
          name: item.name,
          qty: item.qty,
          price: item.price,
          subtotal: item.price * item.qty,
        })),
        subtotal,
        discountAmount,
        discountType,
        total,
        customerCount,
        timestamp: new Date().toISOString(),
      };
      
      setReceipt(receiptData);
      setShowReceipt(true);
      resetOrder()
    } catch (err) {
      alert('Checkout failed: ' + err.message)
    }
  }

  const removeFromCart = (cartItemId) => setCart(prev => prev.filter(i => i.cartItemId !== cartItemId));
  const updateQty = (cartItemId, delta) => setCart(prev => prev.map(i => {
    if (i.cartItemId === cartItemId) {
      const newQty = i.qty + delta;
      return newQty > 0 ? { ...i, qty: newQty } : i;
    }
    return i;
  }));

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let discountMultiplier = 0;
  if (discountType === 'pwd' || discountType === 'senior') discountMultiplier = 0.20;
  if (discountType === 'promo') discountMultiplier = 0.10;
  const discountAmount = subtotal * discountMultiplier;
  const total = subtotal - discountAmount;

  if (loading) {
    return <div className="page-content"><div className="card"><p className="text-muted">Loading menu...</p></div></div>
  }

  return (
    <div className="pos-container relative">
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add {selectedProduct.name}</h3>
              <button className="btn-icon-small" onClick={() => setSelectedProduct(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label className="font-semibold text-muted text-sm block mb-1">Special Instructions</label>
              <textarea placeholder="e.g., Less sugar, warm..." value={productNote} onChange={(e) => setProductNote(e.target.value)} className="note-input" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedProduct(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmAdd}>
                Add to Order - ₱{selectedProduct.price.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pos-header">
        <div className="flex justify-between items-center w-full">
          <h3 className="m-0">Menu</h3>
          <div className="customer-count-widget m-0">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <span className="font-semibold">Traffic:</span>
            </div>
            <div className="count-controls ml-2">
              <button className="btn-icon-small" onClick={decrementCount}><Minus size={14} /></button>
              <input type="number" className="count-input" value={customerCount} onChange={handleCustomerCount} onBlur={handleCustomerBlur} min="0" />
              <button className="btn-icon-small" onClick={incrementCount}><Plus size={14} /></button>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center w-full flex-wrap gap-4">
          <div className="category-filters flex-1 m-0">
            {categories.map(cat => (
              <button key={cat} className={`btn-filter ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>
                {cat}
              </button>
            ))}
          </div>
          <div className="search-bar m-0" style={{ maxWidth: '250px', minWidth: '200px' }}>
            <Search size={16} className="text-muted" />
            <input type="text" placeholder="Search menu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="pos-grid mt-2">
        <div className="menu-section">
          {filteredMenu.length > 0 ? (
            <div className="product-grid">
              {filteredMenu.map(item => (
                <div key={item.id} className="product-card" onClick={() => openProductModal(item)}>
                  <Coffee size={32} className="product-icon" />
                  <h4>{item.name}</h4>
                  <p className="price">₱{item.price.toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted" style={{ height: '300px' }}>
              <Search size={48} className="mb-4 opacity-30" />
              <p className="text-lg">No products found</p>
            </div>
          )}
        </div>

        <div className="order-section card">
          <div className="order-header">
            <h3>Current Order</h3>
            <div className="flex gap-2 items-center">
              <span className="badge">{cart.reduce((sum, i) => sum + i.qty, 0)} Items</span>
              <button className="btn-icon-small text-danger" onClick={resetOrder} title="Clear Order"><RefreshCcw size={16} /></button>
            </div>
          </div>
          <div className="order-items">
            {cart.length === 0 ? (
              <div className="empty-cart">No items added yet.</div>
            ) : (
              cart.map(item => (
                <div key={item.cartItemId} className="cart-item">
                  <div className="item-info">
                    <h5>{item.name}</h5>
                    {item.note && <p className="item-note">"{item.note}"</p>}
                    <p className="item-price">₱{item.price.toFixed(2)}</p>
                  </div>
                  <div className="item-controls">
                    <button className="btn-icon-small" onClick={() => updateQty(item.cartItemId, -1)}><Minus size={12} /></button>
                    <span className="qty">{item.qty}</span>
                    <button className="btn-icon-small" onClick={() => updateQty(item.cartItemId, 1)}><Plus size={12} /></button>
                    <button className="btn-icon-small danger" onClick={() => removeFromCart(item.cartItemId)}><X size={12} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="order-summary">
            <div className="discount-selector">
              <label><Tag size={14} /> Discount</label>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="none">None</option>
                <option value="pwd">PWD (20%)</option>
                <option value="senior">Senior (20%)</option>
                <option value="promo">Promo (10%)</option>
              </select>
            </div>
            <div className="summary-row"><span>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
            {discountAmount > 0 && <div className="summary-row discount"><span>Discount</span><span>- ₱{discountAmount.toFixed(2)}</span></div>}
            <div className="summary-row total items-center">
              <span>Total</span>
              <span>₱{total.toFixed(2)}</span>
            </div>
            <button className="btn btn-primary w-full mt-2" disabled={cart.length === 0 && customerCount === 0} onClick={handleCheckout}>
              Checkout & Log Traffic
            </button>
          </div>
        </div>
      </div>
      {showReceipt && receipt && (
        <div className="modal-overlay" onClick={() => setShowReceipt(false)}>
          <div className="modal-content card receipt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-paper" data-testid="receipt">
              <div className="receipt-header">
                <h3>Jowen's Cafe</h3>
                <p className="receipt-subhead">Order Receipt</p>
              </div>
              <div className="receipt-meta">
                <div className="receipt-meta-row"><span>Transaction #</span><span>{receipt.transaction.transaction_number}</span></div>
                <div className="receipt-meta-row"><span>Date</span><span>{new Date(receipt.timestamp).toLocaleString()}</span></div>
                <div className="receipt-meta-row"><span>Cashier</span><span>{user?.name || 'Cashier'}</span></div>
                {receipt.customerCount > 0 && <div className="receipt-meta-row"><span>Customers</span><span>{receipt.customerCount}</span></div>}
              </div>
              <div className="receipt-divider"></div>
              <div className="receipt-items">
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="receipt-item">
                    <div className="receipt-item-row">
                      <span className="receipt-item-name">{item.name}</span>
                      <span className="receipt-item-total">₱{item.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="receipt-item-qty">{item.qty} x ₱{item.price.toFixed(2)}{item.note && ` — ${item.note}`}</div>
                  </div>
                ))}
              </div>
              <div className="receipt-divider"></div>
              <div className="receipt-totals">
                <div className="receipt-total-row"><span>Subtotal</span><span>₱{receipt.subtotal.toFixed(2)}</span></div>
                {receipt.discountAmount > 0 && (
                  <div className="receipt-total-row discount"><span>Discount ({receipt.discountType === 'pwd' ? 'PWD' : receipt.discountType === 'senior' ? 'Senior' : 'Promo'} {receipt.discountType === 'promo' ? '10%' : '20%'})</span><span>- ₱{receipt.discountAmount.toFixed(2)}</span></div>
                )}
                <div className="receipt-total-row grand-total"><span>Total</span><span>₱{receipt.total.toFixed(2)}</span></div>
                <div className="receipt-total-row payment"><span>Payment</span><span>Cash</span></div>
              </div>
              <div className="receipt-divider"></div>
              <div className="receipt-footer">
                <p className="receipt-thankyou">Thank you!</p>
                <p>Please keep this receipt for reference.</p>
              </div>
            </div>
            <div className="receipt-actions">
              <button className="btn btn-primary w-full" onClick={() => window.print()}>
                <Printer size={16} /> Print Receipt
              </button>
              <button className="btn btn-secondary w-full mt-2" onClick={() => setShowReceipt(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
