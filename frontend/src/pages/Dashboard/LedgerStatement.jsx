import { useEffect, useMemo, useState } from 'react';
import { BookText, Download, FileSpreadsheet, RefreshCw, Filter } from 'lucide-react';
import { authAPI, invoicesAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './LedgerStatement.css';

const formatCurrency = (value) => `₹${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(value);
  }
};

export default function LedgerStatementPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [ledger, setLedger] = useState({
    customer_name: 'All Customers',
    opening_balance: 0,
    total_debit: 0,
    total_credit: 0,
    closing_balance: 0,
    entries: [],
  });
  const [filters, setFilters] = useState({
    customer_id: '',
    from_date: '',
    to_date: '',
  });

  const hasActiveFilters = useMemo(() => (
    Boolean(filters.customer_id || filters.from_date || filters.to_date)
  ), [filters]);

  const loadUsers = async () => {
    const response = await authAPI.listUsers(0, 1000);
    setUsers(Array.isArray(response.data) ? response.data : []);
  };

  const loadLedger = async (overrideFilters = null) => {
    const selectedFilters = overrideFilters || filters;
    setLoading(true);
    try {
      const params = {};
      if (selectedFilters.customer_id) params.customer_id = selectedFilters.customer_id;
      if (selectedFilters.from_date) params.from_date = selectedFilters.from_date;
      if (selectedFilters.to_date) params.to_date = selectedFilters.to_date;

      const response = await invoicesAPI.getLedger(params);
      setLedger(response.data || {
        customer_name: 'All Customers',
        opening_balance: 0,
        total_debit: 0,
        total_credit: 0,
        closing_balance: 0,
        entries: [],
      });
    } catch (error) {
      console.error('Failed to load ledger statement:', error);
      toast.error('Failed to load ledger statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await loadUsers();
        await loadLedger();
      } catch (error) {
        console.error('Ledger initialization failed:', error);
      }
    })();
  }, []);

  const handleApplyFilters = async () => {
    await loadLedger();
  };

  const handleClearFilters = async () => {
    const cleared = { customer_id: '', from_date: '', to_date: '' };
    setFilters(cleared);
    await loadLedger(cleared);
  };

  const getExportParams = () => {
    const params = {};
    if (filters.customer_id) params.customer_id = filters.customer_id;
    if (filters.from_date) params.from_date = filters.from_date;
    if (filters.to_date) params.to_date = filters.to_date;
    return params;
  };

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    try {
      setExporting('pdf');
      const response = await invoicesAPI.downloadLedgerPDF(getExportParams());
      const customerPart = (ledger.customer_name || 'all_customers').replace(/\s+/g, '_').toLowerCase();
      downloadBlob(new Blob([response.data], { type: 'application/pdf' }), `ledger_statement_${customerPart}.pdf`);
      toast.success('Ledger PDF exported successfully');
    } catch (error) {
      console.error('Failed to export ledger PDF:', error);
      toast.error('Failed to export ledger PDF');
    } finally {
      setExporting('');
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting('excel');
      const response = await invoicesAPI.downloadLedgerExcel(getExportParams());
      const customerPart = (ledger.customer_name || 'all_customers').replace(/\s+/g, '_').toLowerCase();
      downloadBlob(
        new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `ledger_statement_${customerPart}.xlsx`
      );
      toast.success('Ledger Excel exported successfully');
    } catch (error) {
      console.error('Failed to export ledger Excel:', error);
      toast.error('Failed to export ledger Excel');
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="ledger-page">
      <div className="page-header">
        <h1>Ledger Statement</h1>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExportPDF} disabled={loading || exporting !== ''}>
            {exporting === 'pdf' ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
            Export PDF
          </button>
          <button className="btn btn-secondary" onClick={handleExportExcel} disabled={loading || exporting !== ''}>
            {exporting === 'excel' ? <RefreshCw size={16} className="spin" /> : <FileSpreadsheet size={16} />}
            Export Excel
          </button>
        </div>
      </div>

      <div className="data-card" style={{ marginBottom: '1.25rem' }}>
        <div className="data-card-header">
          <h2>Filters</h2>
        </div>
        <div className="ledger-filters">
          <div className="form-group">
            <label>Customer</label>
            <select
              value={filters.customer_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, customer_id: e.target.value }))}
            >
              <option value="">All Customers</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.full_name} ({user.company_name || 'Individual'})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>From Date</label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, from_date: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>To Date</label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, to_date: e.target.value }))}
            />
          </div>

          <div className="form-group ledger-filter-actions">
            <button className="btn btn-primary" onClick={handleApplyFilters} disabled={loading}>
              <Filter size={16} />
              Apply
            </button>
            <button className="btn btn-secondary" onClick={handleClearFilters} disabled={loading || !hasActiveFilters}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
            <BookText size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Opening Balance</span>
            <span className="stat-value">{formatCurrency(ledger.opening_balance)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>
            <Download size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Debit</span>
            <span className="stat-value">{formatCurrency(ledger.total_debit)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
            <FileSpreadsheet size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Credit</span>
            <span className="stat-value">{formatCurrency(ledger.total_credit)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(14,116,144,0.12)', color: '#0e7490' }}>
            <BookText size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Closing Balance</span>
            <span className="stat-value">{formatCurrency(ledger.closing_balance)}</span>
          </div>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <h2>
            Customer Ledger
            <span style={{ marginLeft: '8px', fontSize: '0.9rem', color: '#6b7280', fontWeight: 400 }}>
              ({ledger.entries?.length || 0} entries)
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading ledger statement…</p></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particular</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries && ledger.entries.length > 0 ? (
                  ledger.entries.map((entry, index) => (
                    <tr key={`${entry.invoice_id || 'row'}-${index}`}>
                      <td>{formatDate(entry.date)}</td>
                      <td>{entry.particular}</td>
                      <td style={{ color: '#dc2626', fontWeight: 600 }}>{entry.debit ? formatCurrency(entry.debit) : '-'}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{entry.credit ? formatCurrency(entry.credit) : '-'}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(entry.balance)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                      No ledger entries found for selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
