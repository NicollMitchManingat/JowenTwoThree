import { useState, useEffect } from 'react';
import { Search, Download, Receipt, Clock, CheckCircle, XCircle } from 'lucide-react';
import { db } from '../services/db';

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    try {
      const data = await db.getTransactions()
      setOrders(data)
    } catch (err) {
      console.error('Failed to load transactions:', err)
    } finally {
      setLoading(false)
    }
  }

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

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const completedCount = orders.filter(o => o.status !== 'Cancelled').length;

  const statusIcon = (status) => {
    switch (status) {
      case 'Completed': return <CheckCircle size={14} style={{ color: '#27ae60' }} />;
      case 'Cancelled': return <XCircle size={14} style={{ color: '#dc2626' }} />;
      default: return <Clock size={14} style={{ color: '#f59e0b' }} />;
    }
  };

  const handleExport = () => {
    const headers = ["Transaction #", "Subtotal", "Discount", "Total", "Payment", "Customers", "Date"]
    const csvRows = [headers.join(",")]
    for (const order of filtered) {
      csvRows.push([
        order.transaction_number, order.subtotal, order.discount, order.total,
        order.payment_method, order.customer_count || 0,
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
    return <div className="page-content"><div className="card"><p className="text-muted">Loading transactions...</p></div></div>
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

      <div className="card table-card table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('transaction_number')} style={{ cursor: 'pointer' }}>Transaction # {sortField === 'transaction_number' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => handleSort('subtotal')} style={{ cursor: 'pointer' }}>Subtotal {sortField === 'subtotal' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => handleSort('discount')} style={{ cursor: 'pointer' }}>Discount {sortField === 'discount' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => handleSort('total')} style={{ cursor: 'pointer' }}>Total {sortField === 'total' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              <th>Payment</th>
              <th>Customers</th>
              <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>Date {sortField === 'created_at' && (sortDir === 'asc' ? '▲' : '▼')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td className="font-semibold">{order.transaction_number}</td>
                <td>₱{Number(order.subtotal).toFixed(2)}</td>
                <td>{Number(order.discount) > 0 ? `-₱${Number(order.discount).toFixed(2)}` : '-'}</td>
                <td className="font-semibold">₱{Number(order.total).toFixed(2)}</td>
                <td>{order.payment_method || 'Cash'}</td>
                <td>{order.customer_count || 0}</td>
                <td className="text-muted">{new Date(order.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" className="text-center py-4 text-muted">No transactions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
