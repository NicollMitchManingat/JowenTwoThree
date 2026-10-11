import { useState, useEffect, useRef } from 'react';
import { Search, Download, Receipt, Clock, CheckCircle, XCircle, Undo2, ChevronUp } from 'lucide-react';
import { db } from '../services/db';
import RefundModal from '../components/pos/RefundModal';
import LoadingSkeleton from '../components/analytics/LoadingSkeleton';

export const refundTotalFor = (refundsByTxn, transactionId) =>
  (refundsByTxn[transactionId] || []).reduce((s, r) => s + (Number(r.refund_amount) || 0), 0)

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
  { key: 'REFUNDED', label: 'Refunded' },
];

const DATE_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
];

const normStatus = (order) => order.status || 'COMPLETED';

// Start-of-day boundaries in local time so "Today" matches wall-clock days.
const startOfDay = (d) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
};

const matchesDate = (order, preset, from, to) => {
  const t = new Date(order.created_at || 0).getTime();
  if (Number.isNaN(t)) return false;
  const now = new Date();
  if (preset === 'today') {
    const s = startOfDay(now);
    if (t < s || t >= s + 86400000) return false;
  } else if (preset === '7d') {
    if (t < startOfDay(now) - 6 * 86400000) return false;
  } else if (preset === '30d') {
    if (t < startOfDay(now) - 29 * 86400000) return false;
  }
  if (from) {
    const f = startOfDay(new Date(`${from}T00:00:00`));
    if (t < f) return false;
  }
  if (to) {
    const e = startOfDay(new Date(`${to}T00:00:00`)) + 86400000;
    if (t >= e) return false;
  }
  return true;
};

export default function OrderHistoryPage({ user }) {
  const [orders, setOrders] = useState([]);
  const [refundsByTxn, setRefundsByTxn] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [refundOrder, setRefundOrder] = useState(null);
  const [toast, setToast] = useState(null);
  const [showJump, setShowJump] = useState(false);
  const pageRef = useRef(null);

  const loadAll = async () => {
    const data = await db.getTransactions()
    setOrders(data || [])
    try {
      const ids = (data || []).map((o) => o.id).filter(Boolean)
      const refunds = typeof db.getRefundsForTransactions === 'function'
        ? await db.getRefundsForTransactions(ids)
        : []
      const grouped = {}
      ;(refunds || []).forEach((r) => {
        if (!grouped[r.transaction_id]) grouped[r.transaction_id] = []
        grouped[r.transaction_id].push(r)
      })
      setRefundsByTxn(grouped)
    } catch {
      setRefundsByTxn({})
    }
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoadError(null)
      try {
        if (!cancelled) await loadAll()
      } catch (err) {
        console.error('Failed to load transactions:', err)
        if (!cancelled) setLoadError(err.message || 'Failed to load transactions. Please retry.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  // No snapshot for history — but reconnect retries instantly (silently,
  // without flashing the skeleton) instead of waiting for manual Retry.
  useEffect(() => {
    const onOnline = () => {
      loadAll().catch((err) => console.error('Reconnect reload failed:', err))
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The page scrolls inside App's .page-container--scroll, not window — so
  // the back-to-filters button watches that container. In bare renders
  // (tests) there is no scroll container and the button simply stays hidden.
  useEffect(() => {
    const container = pageRef.current?.closest('.page-container--scroll');
    if (!container) return;
    const onScroll = () => setShowJump(container.scrollTop > 300);
    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [loading]);

  const jumpToFilters = () => {
    const container = pageRef.current?.closest('.page-container--scroll');
    if (!container) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Search narrows first; pills count within the search; status and date
  // narrow further; paging slices the visible page. Sort applies last so
  // the pager always reflects the sorted, filtered list.
  const searchFiltered = orders.filter(o =>
    (o.transaction_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = { all: searchFiltered.length, COMPLETED: 0, PARTIALLY_REFUNDED: 0, REFUNDED: 0 };
  searchFiltered.forEach(o => {
    const k = normStatus(o);
    if (statusCounts[k] !== undefined) statusCounts[k] += 1;
  });

  const filtered = searchFiltered
    .filter(o => statusFilter === 'all' || normStatus(o) === statusFilter)
    .filter(o => matchesDate(o, datePreset, dateFrom, dateTo))
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      if (sortField === 'created_at') {
        const da = new Date(aVal || 0).getTime()
        const db = new Date(bVal || 0).getTime()
        return sortDir === 'asc' ? da - db : db - da
      }
      return sortDir === 'asc'
        ? String(aVal || '').localeCompare(String(bVal || ''))
        : String(bVal || '').localeCompare(String(aVal || ''));
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pagedOrders = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  // Selection persists by id across pages and filters; the toolbar resolves
  // it against live data so a removed order simply disables the button.
  const selectedOrder = orders.find(o => String(o.id) === String(selectedId)) ?? null;
  const selectedFullyRefunded = selectedOrder && (selectedOrder.status || 'COMPLETED') === 'REFUNDED';
  const canRefund = user?.role !== 'stockist';
  const canActOnSelected = canRefund && selectedOrder && !selectedFullyRefunded;

  const refundTitle = () => {
    if (!selectedOrder) return 'Select a transaction to refund';
    if (selectedFullyRefunded) return 'Already fully refunded';
    return undefined;
  };

  // Clicking the selected row again unselects it — otherwise there is no
  // way to return to the "nothing selected" state.
  const toggleSelect = (id) => {
    setSelectedId(prev => (prev !== null && String(prev) === String(id) ? null : id));
  };

  // A new search or filter always restarts at page one.
  useEffect(() => { setPage(0); }, [search, statusFilter, datePreset, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setCustomOpen(false);
  };

  const pickPreset = (key) => {
    setDatePreset(key);
    setDateFrom('');
    setDateTo('');
    setCustomOpen(false);
  };

  const setCustomBound = (which, value) => {
    if (which === 'from') setDateFrom(value);
    else setDateTo(value);
    setDatePreset('all');
  };
  // Net revenue: fully refunded orders excluded, partial refunds subtracted.
  const totalRevenue = orders.reduce((s, o) => {
    if ((o.status || 'COMPLETED') === 'REFUNDED') return s
    return s + Number(o.total || 0) - refundTotalFor(refundsByTxn, o.id)
  }, 0);
  const completedCount = orders.filter(o => (o.status || 'COMPLETED') === 'COMPLETED').length;

  const statusIcon = (status) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle size={14} style={{ color: '#27ae60' }} />;
      case 'REFUNDED': return <XCircle size={14} style={{ color: '#dc2626' }} />;
      case 'PARTIALLY_REFUNDED': return <Clock size={14} style={{ color: '#f59e0b' }} />;
      case 'Cancelled': return <XCircle size={14} style={{ color: '#dc2626' }} />;
      default: return <CheckCircle size={14} style={{ color: '#27ae60' }} />;
    }
  };

  const statusBadge = (order) => {
    const status = order.status || 'COMPLETED'
    const label = status === 'PARTIALLY_REFUNDED' ? 'Partially refunded' : status === 'REFUNDED' ? 'Refunded' : 'Completed'
    return <span className="flex items-center gap-2">{statusIcon(status)} {label}</span>
  }

  const handleRefunded = async () => {
    setRefundOrder(null)
    setToast({ type: 'success', message: 'Refund recorded.' })
    try {
      await loadAll()
    } catch (err) {
      console.error('Failed to reload after refund:', err)
    }
  }

  const handleExport = () => {
    const headers = ["Transaction #", "Subtotal", "Discount", "Total", "Refunded", "Net", "Status", "Payment", "Customers", "Male", "Female", "Unspecified", "Date"]
    const csvRows = [headers.join(",")]
    for (const order of filtered) {
      const refunded = refundTotalFor(refundsByTxn, order.id)
      csvRows.push([
        order.transaction_number, order.subtotal, order.discount, order.total,
        refunded.toFixed(2), (Number(order.total || 0) - refunded).toFixed(2), order.status || 'COMPLETED',
        order.payment_method, order.customer_count || 0,
        order.male_count ?? "", order.female_count ?? "", order.unspecified_count ?? "",
        new Date(order.created_at).toLocaleString()
      ].join(","))
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="page-content"><LoadingSkeleton variant="transactions" /><p className="text-sm text-muted">If this takes over 8s, Supabase timed out — it will fail fast with a retry.</p></div>
  }

  if (loadError && orders.length === 0) {
    return <div className="page-content"><div className="card"><p className="text-danger">Failed to load transactions: {loadError}</p><button className="btn btn-primary mt-2" onClick={() => window.location.reload()}>Retry</button></div></div>
  }

  return (
    <div className="page-content" ref={pageRef}>
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#e8f8f5' }}><Receipt size={24} style={{ color: '#27ae60' }} /></div>
          <div><div className="text-sm text-muted">Total Transactions</div><div className="text-lg font-semibold">{orders.length}</div></div>
        </div>
        <div className="card metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#f0edf7' }}><Receipt size={24} style={{ color: 'var(--color-primary)' }} /></div>
          <div><div className="text-sm text-muted">Completed</div><div className="text-lg font-semibold">{completedCount}</div></div>
        </div>
        <div className="card metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#fef5e7' }}><Receipt size={24} style={{ color: '#f59e0b' }} /></div>
          <div><div className="text-sm text-muted">Total Revenue</div><div className="text-lg font-semibold">₱{totalRevenue.toLocaleString()}</div></div>
        </div>
      </div>

      {canRefund && selectedOrder && (
        <p className="selected-chip" data-testid="selected-chip">
          Selected: <strong>{selectedOrder.transaction_number}</strong> (₱{Number(selectedOrder.total || 0).toFixed(2)} · {selectedOrder.status === 'PARTIALLY_REFUNDED' ? 'Partially refunded' : selectedOrder.status === 'REFUNDED' ? 'Refunded' : 'Completed'})
          {selectedFullyRefunded && ' — already refunded'}
        </p>
      )}
      {canRefund && !selectedOrder && orders.length > 0 && (
        <p className="selected-hint" data-testid="selection-hint">Select a row to refund a transaction.</p>
      )}

      <div className="action-bar action-bar--filters action-bar--sticky">
        <div className="search-bar">
          <Search size={18} className="text-muted" />
          <input type="text" placeholder="Search by transaction number..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="txn-filter-field">Status
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="txn-status-select"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>
                {opt.label} ({statusCounts[opt.key] ?? 0})
              </option>
            ))}
          </select>
        </label>
        <label className="txn-filter-field">Date
          <select
            className="form-input"
            value={dateFrom || dateTo || customOpen ? 'custom' : datePreset}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setCustomOpen(true);
              } else {
                pickPreset(e.target.value);
              }
            }}
            data-testid="txn-date-select"
            aria-label="Filter by date"
          >
            {DATE_PRESETS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
            <option value="custom">Custom range…</option>
          </select>
        </label>
        {(dateFrom || dateTo || customOpen) && (
          <span className="txn-date-custom">
            <label>From <input type="date" autoFocus className="form-input" value={dateFrom} max={dateTo || undefined} onChange={(e) => setCustomBound('from', e.target.value)} data-testid="filter-date-from" aria-label="From date" /></label>
            <label>To <input type="date" className="form-input" value={dateTo} min={dateFrom || undefined} onChange={(e) => setCustomBound('to', e.target.value)} data-testid="filter-date-to" aria-label="To date" /></label>
          </span>
        )}
        <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canRefund && (
            <button className="btn btn-secondary" onClick={() => selectedOrder && setRefundOrder(selectedOrder)} disabled={!canActOnSelected} title={user?.role === 'admin' ? (refundTitle() || 'Refund (admin)') : (refundTitle() || 'Refund (requires manager approval)')} data-testid="toolbar-refund-btn">
              <Undo2 size={16} /> Refund
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleExport}><Download size={16} /> Export</button>
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type} toast-global`}>
          <span>{toast.message}</span>
          <button className="btn btn-secondary" style={{ marginLeft: '0.5rem' }} onClick={() => setToast(null)}>Dismiss</button>
        </div>
      )}

      <div className="card table-card table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              {canRefund && <th scope="col" aria-label="Select" style={{ width: '2.5rem' }} />}
              <th onClick={() => handleSort('transaction_number')} style={{ cursor: 'pointer' }}>Transaction # {sortField === 'transaction_number' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => handleSort('subtotal')} style={{ cursor: 'pointer' }}>Subtotal {sortField === 'subtotal' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => handleSort('discount')} style={{ cursor: 'pointer' }}>Discount {sortField === 'discount' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => handleSort('total')} style={{ cursor: 'pointer' }}>Total {sortField === 'total' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th>Refunded</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Customers</th>
              <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>Date {sortField === 'created_at' && (sortDir === 'asc' ? '▲' : '▼')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? pagedOrders.map((order) => {
              const refunded = refundTotalFor(refundsByTxn, order.id)
              const isSelected = String(selectedId) === String(order.id);
              return (
              <tr
                key={order.id}
                data-testid={`order-row-${order.id}`}
                className={`${canRefund ? 'row-selectable' : ''} ${isSelected ? 'row-selected' : ''}`}
                aria-selected={canRefund ? isSelected : undefined}
                onClick={canRefund ? () => toggleSelect(order.id) : undefined}
                onKeyDown={canRefund ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelect(order.id); }
                  else if (e.key === 'Escape') { setSelectedId(null); }
                } : undefined}
                tabIndex={canRefund ? 0 : undefined}
              >
                {canRefund && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="radio"
                      name="transaction-selection"
                      className="row-select-radio"
                      checked={isSelected}
                      onChange={() => toggleSelect(order.id)}
                      aria-label={`Select ${order.transaction_number}`}
                      data-testid={`select-order-${order.id}`}
                    />
                  </td>
                )}
                <td className="font-semibold">{order.transaction_number}</td>
                <td>₱{Number(order.subtotal).toFixed(2)}</td>
                <td>{Number(order.discount) > 0 ? `-₱${Number(order.discount).toFixed(2)}` : '-'}</td>
                <td className="font-semibold">₱{Number(order.total).toFixed(2)}</td>
                <td>{refunded > 0 ? `-₱${refunded.toFixed(2)}` : '-'}</td>
                <td>{statusBadge(order)}</td>
                <td>{order.payment_method || 'Cash'}</td>
                <td>{order.customer_count || 0}{((order.male_count ?? 0) + (order.female_count ?? 0) + (order.unspecified_count ?? 0) > 0) ? ` (M${order.male_count ?? 0}/F${order.female_count ?? 0}${(order.unspecified_count ?? 0) > 0 ? `/U${order.unspecified_count}` : ''})` : ''}</td>
                <td className="text-muted">{new Date(order.created_at).toLocaleString()}</td>
              </tr>
              )
            }) : (
              <tr><td colSpan={canRefund ? '10' : '9'} className="text-center py-4 text-muted">
                {orders.length === 0
                  ? 'No transactions found.'
                  : <>No transactions match these filters.{' '}
                    <button className="btn btn-secondary" onClick={clearFilters} data-testid="clear-txn-filters-btn">Clear filters</button></>}
              </td></tr>
            )}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="table-pager">
            <span aria-live="polite" data-testid="txn-pager-count">
              Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="action-buttons">
              <button className="btn btn-secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} data-testid="txn-prev" aria-label="Previous page">Prev</button>
              <button className="btn btn-secondary" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} data-testid="txn-next" aria-label="Next page">Next</button>
            </div>
          </div>
        )}
      </div>

      {showJump && (
        <button
          className="txn-jump-btn"
          onClick={jumpToFilters}
          title="Back to search and filters"
          aria-label="Back to search and filters"
          data-testid="jump-to-filters-btn"
        >
          <ChevronUp size={18} />
        </button>
      )}

      {refundOrder && (
        <RefundModal
          order={refundOrder}
          user={user}
          existingRefunds={refundsByTxn[refundOrder.id] || []}
          onClose={() => setRefundOrder(null)}
          onRefunded={handleRefunded}
        />
      )}
    </div>
  );
}
