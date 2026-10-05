import { useState, useEffect } from 'react';
import { Search, Download, Receipt, Clock, CheckCircle, XCircle, Undo2 } from 'lucide-react';
import { db } from '../services/db';
import RefundModal from '../components/pos/RefundModal';
import LoadingSkeleton from '../components/analytics/LoadingSkeleton';

export const refundTotalFor = (refundsByTxn, transactionId) =>
  (refundsByTxn[transactionId] || []).reduce((s, r) => s + (Number(r.refund_amount) || 0), 0)

export default function OrderHistoryPage({ user }) {
  const [orders, setOrders] = useState([]);
  const [refundsByTxn, setRefundsByTxn] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [refundOrder, setRefundOrder] = useState(null);
  const [toast, setToast] = useState(null);

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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = [...orders]
    .filter(o =>
      (o.transaction_number || '').toLowerCase().includes(search.toLowerCase())
    )
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
    <div className="page-content">
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

      <div className="action-bar">
        <div className="search-bar">
          <Search size={18} className="text-muted" />
          <input type="text" placeholder="Search by transaction number..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-secondary" onClick={handleExport}><Download size={16} /> Export</button>
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
              <th onClick={() => handleSort('transaction_number')} style={{ cursor: 'pointer' }}>Transaction # {sortField === 'transaction_number' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => handleSort('subtotal')} style={{ cursor: 'pointer' }}>Subtotal {sortField === 'subtotal' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => handleSort('discount')} style={{ cursor: 'pointer' }}>Discount {sortField === 'discount' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => handleSort('total')} style={{ cursor: 'pointer' }}>Total {sortField === 'total' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th>Refunded</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Customers</th>
              <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>Date {sortField === 'created_at' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => {
              const refunded = refundTotalFor(refundsByTxn, order.id)
              const fullyRefunded = (order.status || 'COMPLETED') === 'REFUNDED'
              return (
              <tr key={order.id} data-testid={`order-row-${order.id}`}>
                <td className="font-semibold">{order.transaction_number}</td>
                <td>₱{Number(order.subtotal).toFixed(2)}</td>
                <td>{Number(order.discount) > 0 ? `-₱${Number(order.discount).toFixed(2)}` : '-'}</td>
                <td className="font-semibold">₱{Number(order.total).toFixed(2)}</td>
                <td>{refunded > 0 ? `-₱${refunded.toFixed(2)}` : '-'}</td>
                <td>{statusBadge(order)}</td>
                <td>{order.payment_method || 'Cash'}</td>
                <td>{order.customer_count || 0}{((order.male_count ?? 0) + (order.female_count ?? 0) + (order.unspecified_count ?? 0) > 0) ? ` (M${order.male_count ?? 0}/F${order.female_count ?? 0}${(order.unspecified_count ?? 0) > 0 ? `/U${order.unspecified_count}` : ''})` : ''}</td>
                <td className="text-muted">{new Date(order.created_at).toLocaleString()}</td>
                <td>
                  {/* Refunds are cash-handling: cashier (with manager approval) + admin only. */}
                  {!fullyRefunded && user?.role !== 'stockist' && (
                    <button className="btn btn-secondary" onClick={() => setRefundOrder(order)}
                      data-testid={`refund-btn-${order.id}`} title={user?.role === 'admin' ? 'Refund (admin)' : 'Refund (requires manager approval)'}>
                      <Undo2 size={14} /> Refund
                    </button>
                  )}
                </td>
              </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan="10" className="text-center py-4 text-muted">No transactions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
