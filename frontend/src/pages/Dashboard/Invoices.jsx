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
  paid:      { label: 'Paid',     icon: CheckCircle },
  partial:   { label: 'Partial',  icon: Clock },
  pending:   { label: 'Pending',  icon: AlertCircle },
  overdue:   { label: 'Overdue',  icon: AlertCircle },
  cancelled: { label: 'Cancelled',icon: X },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  const Icon = m.icon;
  return (
    <span className={`status-badge status-${status}`}>
      <Icon size={14} /> {m.label}
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
      <div className="filter-tabs">
        {['all', 'pending', 'partial', 'paid', 'overdue'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`filter-tab ${filterStatus === s ? 'active' : ''}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span className="filter-count">
                {invoices.filter(i => i.payment_status === s).length}
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
                        className="action-btn view-details"
                        title="View Details"
                        onClick={() => openDetail(inv)}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className="action-btn download-pdf"
                        title="Download PDF"
                        disabled={downloadingId === `${inv._id}-pdf`}
                        onClick={() => handleDownload(inv, 'pdf')}
                      >
                        {downloadingId === `${inv._id}-pdf`
                          ? <RefreshCw size={18} className="spin" />
                          : <Download size={18} />}
                      </button>
                      <button
                        className="action-btn download-excel"
                        title="Download Excel"
                        disabled={downloadingId === `${inv._id}-excel`}
                        onClick={() => handleDownload(inv, 'excel')}
                      >
                        {downloadingId === `${inv._id}-excel`
                          ? <RefreshCw size={18} className="spin" />
                          : <FileSpreadsheet size={18} />}
                      </button>
                      {isAdmin() && inv.payment_status !== 'paid' && (
                        <button
                          className="action-btn"
                          title="Record Payment"
                          onClick={() => { setSelectedInvoice(inv); setShowPayment(true); }}
                        >
                          <DollarSign size={18} />
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

// ─── Invoice Detail Modal ────────────────────────────────────────────────────

function InvoiceDetailModal({ invoice, onClose, onDownload, onPayment, downloadingId, isAdmin }) {
  const [showPayments, setShowPayments] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-large"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{invoice.invoice_number}</h2>
            <p style={{ margin: '2px 0 0', opacity: 0.7, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Created: {fmtDate(invoice.created_at)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <StatusBadge status={invoice.payment_status} />
            <button
              className="btn-close"
              onClick={onClose}
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {/* Customer + Totals */}
          <div className="detail-grid">
            <div>
              <div className="detail-section">
                <h4>Bill To</h4>
                <div className="detail-value">{invoice.customer_name}</div>
                {invoice.customer_email && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                    {invoice.customer_email}
                  </div>
                )}
                {invoice.billing_address && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '2px' }}>
                    {invoice.billing_address}
                  </div>
                )}
              </div>
            </div>
            
            <div className="detail-card">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{fmt(invoice.subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>GST</span>
                <span>{fmt(invoice.gst_amount)}</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span style={{ color: 'var(--accent-premium)' }}>{fmt(invoice.total_amount)}</span>
              </div>
              <div className="summary-row paid-full" style={{ marginTop: '0.75rem' }}>
                <span>Paid</span>
                <span>{fmt(invoice.amount_paid)}</span>
              </div>
              
              <div className={`summary-row ${invoice.balance_due > 0 ? 'balance' : 'paid-full'}`} style={{ marginTop: '0.5rem' }}>
                <span>Balance Due</span>
                <span>{fmt(invoice.balance_due)}</span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <h4 style={{ 
            fontSize: '0.85rem', fontWeight: 700, 
            textTransform: 'uppercase', letterSpacing: '0.05em', 
            color: 'var(--text-secondary)', marginBottom: '1rem' 
          }}>
            Line Items ({invoice.items?.length || 0})
          </h4>
          
          <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
            {invoice.items?.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Docket No</th>
                    <th>Tracking</th>
                    <th>Weight</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-secondary)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 500, color:'var(--text-secondary)' }}>{item.description}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem',color:'var(--text-secondary)' ,background: 'var(--bg-page)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          {item.docket_no || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem',color:'var(--text-secondary)', background: 'var(--bg-page)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          {item.tracking_number || '—'}
                        </span>
                      </td>
                      <td style={{color:'var(--text-secondary)'}}>{item.weight_kg ? `${item.weight_kg} kg` : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600,color:'var(--text-secondary)' }}>{fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <p>No line items found.</p>
              </div>
            )}
          </div>

          {/* Payment History */}
          {invoice.payments?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={() => setShowPayments(!showPayments)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', 
                  background: 'none', border: 'none', cursor: 'pointer', 
                  fontWeight: 600, color: 'var(--accent-premium)', 
                  fontSize: '0.9rem', marginBottom: '1rem', padding: 0 
                }}
              >
                {showPayments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Payment History ({invoice.payments.length})
              </button>
              
              {showPayments && (
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
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
                        <td style={{color:'var(--text-secondary)',fontWeight:500}}>{fmtDate(p.payment_date)}</td>
                        <td style={{ textTransform: 'capitalize',color:'var(--text-secondary)',fontWeight:500 }}>{String(p.method || '').replace('_', ' ')}</td>
                        <td style={{ color: 'var(--text-secondary)',fontWeight:500 }}>{p.transaction_ref || '—'}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {invoice.notes && (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '12px', padding: '1rem', fontSize: '0.9rem', color: '#ca8a04' }}>
              <strong>Notes:</strong> {invoice.notes}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          {isAdmin && invoice.payment_status !== 'paid' && (
            <button className="btn btn-primary" onClick={onPayment}>
              <DollarSign size={16} /> Record Payment
            </button>
          )}
          
          <button
            className="btn btn-secondary"
            onClick={() => onDownload(invoice, 'excel')}
            disabled={downloadingId === `${invoice._id}-excel`}
          >
            {downloadingId === `${invoice._id}-excel`
              ? <><RefreshCw size={16} className="spin" /></>
              : <><FileSpreadsheet size={16} /> Excel</>}
          </button>
          
          <button
            className="btn btn-secondary"
            onClick={() => onDownload(invoice, 'pdf')}
            disabled={downloadingId === `${invoice._id}-pdf`}
          >
            {downloadingId === `${invoice._id}-pdf`
              ? <><RefreshCw size={16} className="spin" /> </>
              : <><Download size={16} /> PDF</>}
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
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record Payment</h2>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div style={{ background: 'var(--bg-page)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Invoice</span>
                <strong style={{ color: 'var(--text-main)' }}>{invoice.invoice_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Balance Due</span>
                <strong style={{ color: '#dc2626' }}>{fmt(invoice.balance_due)}</strong>
              </div>
            </div>

            <div className="form-group">
              <label>Amount (₹) *</label>
              <input
                type="number" step="0.01" min="0.01" max={invoice.balance_due + 1}
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
              {loading ? (
                <>
                  <RefreshCw size={18} className="spin" /> Processing…
                </>
              ) : (
                'Record Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
