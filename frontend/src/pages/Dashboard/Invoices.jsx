import { useState, useEffect, useMemo } from 'react';
import {
  FileText, Download, DollarSign, X, CheckCircle,
  AlertCircle, Clock, Eye, FileSpreadsheet, Printer,
  RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { invoicesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './Invoices.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return String(d); }
};

const STATUS_META = {
  paid:      { label: 'Paid',     color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle },
  partial:   { label: 'Partial',  color: '#d97706', bg: '#fffbeb', icon: Clock },
  pending:   { label: 'Pending',  color: '#dc2626', bg: '#fef2f2', icon: AlertCircle },
  overdue:   { label: 'Overdue',  color: '#dc2626', bg: '#fef2f2', icon: AlertCircle },
  cancelled: { label: 'Cancelled',color: '#6b7280', bg: '#f9fafb', icon: X },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  const Icon = m.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem',
      fontWeight: 600, background: m.bg, color: m.color, border: `1px solid ${m.color}33`
    }}>
      <Icon size={12} /> {m.label}
    </span>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [invoices, setInvoices]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetail, setShowDetail]       = useState(false);
  const [showPayment, setShowPayment]     = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [filterStatus, setFilterStatus]  = useState('all');
  const { isAdmin } = useAuth();

  useEffect(() => { loadInvoices(); }, []);

  const loadInvoices = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await invoicesAPI.list();
      setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to load invoices:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total   = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
    const paid    = invoices.reduce((s, i) => s + (i.amount_paid  || 0), 0);
    const pending = invoices.filter(i => i.payment_status !== 'paid')
                            .reduce((s, i) => s + (i.balance_due || 0), 0);
    const overdue = invoices.filter(i => i.payment_status === 'overdue').length;
    return { count: invoices.length, total, paid, pending, overdue };
  }, [invoices]);

  const filtered = useMemo(() =>
    filterStatus === 'all' ? invoices : invoices.filter(i => i.payment_status === filterStatus),
    [invoices, filterStatus]
  );

  const handleDownload = async (invoice, type) => {
    const key = `${invoice._id}-${type}`;
    setDownloadingId(key);
    try {
      const res = type === 'pdf'
        ? await invoicesAPI.downloadPDF(invoice._id)
        : await invoicesAPI.downloadExcel(invoice._id);

      const mimeType = type === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const ext = type === 'pdf' ? 'pdf' : 'xlsx';

      const blob = new Blob([res.data], { type: mimeType });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `invoice_${invoice.invoice_number}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(`Failed to download ${type}:`, e);
      alert(`Download failed. Please try again.`);
    } finally {
      setDownloadingId(null);
    }
  };

  const openDetail = (invoice) => {
    setSelectedInvoice(invoice);
    setShowDetail(true);
  };

  return (
    <div className="invoices-page">
      {/* Header */}
      <div className="page-header">
        <h1>Invoices</h1>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => loadInvoices(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Invoices</span>
            <span className="stat-value">{stats.count}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Invoiced</span>
            <span className="stat-value">{fmt(stats.total)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Amount Received</span>
            <span className="stat-value">{fmt(stats.paid)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pending Balance</span>
            <span className="stat-value">{fmt(stats.pending)}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['all', 'pending', 'partial', 'paid', 'overdue'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: '0.35rem 1rem',
              borderRadius: '20px',
              border: `1px solid ${filterStatus === s ? '#6366f1' : '#e2e8f0'}`,
              background: filterStatus === s ? '#6366f1' : 'transparent',
              color: filterStatus === s ? '#fff' : '#64748b',
              fontWeight: filterStatus === s ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.15s',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span style={{ marginLeft: '6px', opacity: 0.8 }}>
                ({invoices.filter(i => i.payment_status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="data-card">
        <div className="data-card-header">
          <h2>
            {filterStatus === 'all' ? 'All Invoices' : `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Invoices`}
            <span style={{ marginLeft: '8px', fontSize: '0.9rem', color: '#6b7280', fontWeight: 400 }}>
              ({filtered.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading invoices…</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} style={{ color: '#a0aec0' }} />
            <h3>No invoices found</h3>
            <p>Invoices are auto-generated when consignments are created.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv._id} style={{ cursor: 'pointer' }} onClick={() => openDetail(inv)}>
                    <td>
                      <strong style={{ color: '#6366f1' }}>{inv.invoice_number}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{inv.customer_name}</div>
                      {inv.customer_email && (
                        <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{inv.customer_email}</div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(inv.created_at)}</td>
                    <td><strong>{fmt(inv.total_amount)}</strong></td>
                    <td style={{ color: '#16a34a' }}>{fmt(inv.amount_paid)}</td>
                    <td style={{ color: inv.balance_due > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      {fmt(inv.balance_due)}
                    </td>
                    <td><StatusBadge status={inv.payment_status} /></td>
                    <td className="actions-cell" onClick={e => e.stopPropagation()}>
                      <button
                        className="action-btn"
                        title="View Details"
                        onClick={() => openDetail(inv)}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn"
                        title="Download PDF"
                        disabled={downloadingId === `${inv._id}-pdf`}
                        onClick={() => handleDownload(inv, 'pdf')}
                        style={{ color: '#ef4444' }}
                      >
                        {downloadingId === `${inv._id}-pdf`
                          ? <RefreshCw size={16} className="spin" />
                          : <Download size={16} />}
                      </button>
                      <button
                        className="action-btn"
                        title="Download Excel"
                        disabled={downloadingId === `${inv._id}-excel`}
                        onClick={() => handleDownload(inv, 'excel')}
                        style={{ color: '#16a34a' }}
                      >
                        {downloadingId === `${inv._id}-excel`
                          ? <RefreshCw size={16} className="spin" />
                          : <FileSpreadsheet size={16} />}
                      </button>
                      {isAdmin() && inv.payment_status !== 'paid' && (
                        <button
                          className="action-btn"
                          title="Record Payment"
                          onClick={() => { setSelectedInvoice(inv); setShowPayment(true); }}
                          style={{ color: '#6366f1' }}
                        >
                          <DollarSign size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {showDetail && selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => { setShowDetail(false); setSelectedInvoice(null); }}
          onDownload={handleDownload}
          onPayment={() => { setShowDetail(false); setShowPayment(true); }}
          downloadingId={downloadingId}
          isAdmin={isAdmin()}
        />
      )}

      {/* Payment Modal */}
      {showPayment && selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => { setShowPayment(false); setSelectedInvoice(null); }}
          onSuccess={() => loadInvoices(true)}
        />
      )}
    </div>
  );
}

// ─── Invoice Detail Modal ────────────────────────────────────────────────────

function InvoiceDetailModal({ invoice, onClose, onDownload, onPayment, downloadingId, isAdmin }) {
  const [showPayments, setShowPayments] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-large"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', borderRadius: '12px 12px 0 0' }}>
          <div>
            <h2 style={{ color: '#fff', margin: 0 }}>{invoice.invoice_number}</h2>
            <p style={{ margin: '2px 0 0', opacity: 0.85, fontSize: '0.85rem' }}>
              {fmtDate(invoice.created_at)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <StatusBadge status={invoice.payment_status} />
            <button
              className="btn-close"
              onClick={onClose}
              style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {/* Customer + Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Bill To</p>
              <p style={{ fontWeight: 700, fontSize: '1.05rem', margin: '0 0 4px' }}>{invoice.customer_name}</p>
              {invoice.customer_email && <p style={{ color: '#6b7280', margin: '0 0 2px', fontSize: '0.9rem' }}>{invoice.customer_email}</p>}
              {invoice.billing_address && <p style={{ color: '#6b7280', margin: 0, fontSize: '0.85rem' }}>{invoice.billing_address}</p>}
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Subtotal</span>
                <span>{fmt(invoice.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>GST</span>
                <span>{fmt(invoice.gst_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px', fontWeight: 700, fontSize: '1.05rem' }}>
                <span>Total</span>
                <span style={{ color: '#6366f1' }}>{fmt(invoice.total_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ color: '#16a34a', fontSize: '0.9rem' }}>Paid</span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(invoice.amount_paid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', background: invoice.balance_due > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '6px', padding: '6px 8px' }}>
                <span style={{ color: invoice.balance_due > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>Balance Due</span>
                <span style={{ color: invoice.balance_due > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{fmt(invoice.balance_due)}</span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Line Items ({invoice.items?.length || 0})
          </h3>
          {invoice.items?.length > 0 ? (
            <table className="data-table" style={{ fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Tracking</th>
                  <th>Weight</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{item.description}</td>
                    <td><code style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{item.tracking_number || '—'}</code></td>
                    <td>{item.weight_kg ? `${item.weight_kg} kg` : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>No line items.</p>
          )}

          {/* Payment History */}
          {invoice.payments?.length > 0 && (
            <>
              <button
                onClick={() => setShowPayments(!showPayments)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#374151', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', padding: 0 }}
              >
                {showPayments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Payment History ({invoice.payments.length})
              </button>
              {showPayments && (
                <table className="data-table" style={{ fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p, i) => (
                      <tr key={i}>
                        <td>{fmtDate(p.payment_date)}</td>
                        <td style={{ textTransform: 'capitalize' }}>{String(p.method || '').replace('_', ' ')}</td>
                        <td>{p.transaction_ref || '—'}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {invoice.notes && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.88rem', color: '#92400e' }}>
              <strong>Notes:</strong> {invoice.notes}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {isAdmin && invoice.payment_status !== 'paid' && (
            <button className="btn btn-primary" onClick={onPayment} style={{ background: '#6366f1' }}>
              <DollarSign size={16} /> Record Payment
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => onDownload(invoice, 'excel')}
            disabled={downloadingId === `${invoice._id}-excel`}
            style={{ color: '#16a34a', borderColor: '#16a34a' }}
          >
            {downloadingId === `${invoice._id}-excel`
              ? <><RefreshCw size={16} className="spin" /> Downloading…</>
              : <><FileSpreadsheet size={16} /> Excel</>}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onDownload(invoice, 'pdf')}
            disabled={downloadingId === `${invoice._id}-pdf`}
            style={{ color: '#ef4444', borderColor: '#ef4444' }}
          >
            {downloadingId === `${invoice._id}-pdf`
              ? <><RefreshCw size={16} className="spin" /> Downloading…</>
              : <><Download size={16} /> Download PDF</>}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Modal ───────────────────────────────────────────────────────────

function PaymentModal({ invoice, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm]       = useState({
    amount: invoice.balance_due || 0,
    method: 'upi',
    transaction_ref: '',
    notes: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await invoicesAPI.addPayment(invoice._id, {
        invoice_id: invoice._id,
        amount: parseFloat(form.amount),
        method: form.method,
        transaction_ref: form.transaction_ref,
        notes: form.notes,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2>Record Payment</h2>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Invoice</span>
                <strong>{invoice.invoice_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: '#6b7280' }}>Balance Due</span>
                <strong style={{ color: '#dc2626' }}>{fmt(invoice.balance_due)}</strong>
              </div>
            </div>

            <div className="form-group">
              <label>Amount (₹) *</label>
              <input
                type="number" step="0.01" min="0.01" max={invoice.balance_due}
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Payment Method *</label>
              <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="credit">Customer Credit</option>
              </select>
            </div>

            <div className="form-group">
              <label>Transaction Reference</label>
              <input
                type="text"
                placeholder="UPI ID / Cheque No. / Transaction ID"
                value={form.transaction_ref}
                onChange={e => setForm({ ...form, transaction_ref: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
