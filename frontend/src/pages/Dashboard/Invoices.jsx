import { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Download, DollarSign, X, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { invoicesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './Consignments.css'; // Use shared styles

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const response = await invoicesAPI.list();
      setInvoices(response.data);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (invoice) => {
    try {
      const response = await invoicesAPI.downloadPDF(invoice._id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoice.invoice_number}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  const handleDownloadExcel = async (invoice) => {
    try {
      const response = await invoicesAPI.downloadExcel(invoice._id);
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoice.invoice_number}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download Excel:', error);
    }
  };

  const getStatusClass = (status) => `status-badge status-${status}`;

  // Statistics
  const stats = useMemo(() => {
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const paidAmount = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
    const pendingAmount = invoices.filter(i => i.payment_status !== 'paid').reduce((sum, inv) => sum + (inv.balance_due || 0), 0);
    
    return {
      total_count: invoices.length,
      total_revenue: totalAmount,
      received: paidAmount,
      pending: pendingAmount
    };
  }, [invoices]);

  return (
    <div className="invoices-page">
      <div className="page-header">
        <h1>Invoices</h1>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Invoiced</span>
            <span className="stat-value">₹{stats.total_revenue.toLocaleString()}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Received</span>
            <span className="stat-value">₹{stats.received.toLocaleString()}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pending</span>
            <span className="stat-value">₹{stats.pending.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <h2>All Invoices ({invoices.length})</h2>
        </div>
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <h3>No invoices found</h3>
            <p>Invoices will appear here when created.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice._id}>
                  <td><strong>{invoice.invoice_number}</strong></td>
                  <td>{invoice.customer_name}</td>
                  <td>{invoice.items?.length || 0}</td>
                  <td>₹{invoice.total_amount?.toFixed(2)}</td>
                  <td>₹{invoice.amount_paid?.toFixed(2)}</td>
                  <td>₹{invoice.balance_due?.toFixed(2)}</td>
                  <td>
                    <span className={getStatusClass(invoice.payment_status)}>
                      {invoice.payment_status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="action-btn" 
                      title="Download PDF"
                      onClick={() => handleDownloadPDF(invoice)}
                    >
                      <Download size={18} />
                    </button>
                    {isAdmin() && invoice.payment_status !== 'paid' && (
                      <button 
                        className="action-btn" 
                        title="Add Payment"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setShowPaymentModal(true);
                        }}
                      >
                        <DollarSign size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <PaymentModal 
          invoice={selectedInvoice}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }} 
          onSuccess={loadInvoices} 
        />
      )}
    </div>
  );
}

function PaymentModal({ invoice, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    amount: invoice.balance_due,
    method: 'upi',
    transaction_ref: '',
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await invoicesAPI.addPayment(invoice._id, {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Payment</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            
            <p style={{ marginBottom: '1rem' }}>
              <strong>Invoice:</strong> {invoice.invoice_number}<br />
              <strong>Balance Due:</strong> ₹{invoice.balance_due?.toFixed(2)}
            </p>

            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                max={invoice.balance_due}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Payment Method</label>
              <select 
                value={formData.method} 
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              >
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
                placeholder="e.g., UPI ID or Cheque No."
                value={formData.transaction_ref}
                onChange={(e) => setFormData({ ...formData, transaction_ref: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? 'Processing...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
