import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw, RotateCcw } from 'lucide-react';
import { consignmentsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './ConsignmentReport.css';

const INITIAL_FILTERS = {
  name: '',
  city: '',
  docket_no: '',
  start_date: '',
  end_date: '',
};

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const buildRequestParams = (filters) => Object.fromEntries(
  Object.entries(filters).filter(([, value]) => String(value || '').trim() !== '')
);

export default function ConsignmentReport() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const toast = useToast();

  // Fetch server-filtered rows with a short debounce so text filters feel responsive.
  useEffect(() => {
    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      const hasRows = rows.length > 0;
      setLoading(!hasRows);
      setRefreshing(hasRows);

      try {
        const response = await consignmentsAPI.report(buildRequestParams(filters));
        const nextRows = response.data || [];

        if (ignore) {
          return;
        }

        setRows(nextRows);
        setSelectedIds((current) => current.filter((id) => nextRows.some((row) => row.id === id)));
        setError('');
      } catch (requestError) {
        if (ignore) {
          return;
        }

        console.error('Failed to load consignment report:', requestError);
        setError('Failed to load consignment report data.');
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [filters]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
  );

  const totalAmount = useMemo(
    () => selectedRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [selectedRows]
  );

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  const handleFilterChange = ({ target: { name, value } }) => {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleToggleRow = (rowId) => {
    setSelectedIds((current) => (
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId]
    ));
  };

  const handleToggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !rows.some((row) => row.id === id)));
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      rows.forEach((row) => next.add(row.id));
      return Array.from(next);
    });
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  // Export only the checked rows using a grid-style table so the PDF reads like a sheet.
  const handleExportPdf = async () => {
    if (selectedRows.length === 0) {
      toast.info('Select at least one consignment to export.');
      return;
    }

    setExportingPdf(true);
    try {
      const response = await consignmentsAPI.exportReportPDF({ ids: selectedIds.join(',') });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `consignment-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Selected consignments exported to PDF.');
    } catch (requestError) {
      console.error('Failed to export consignment report PDF:', requestError);
      toast.error('Failed to export selected consignments to PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <section className="consignment-report-card data-card">
      <div className="data-card-header consignment-report-card__header">
        <div>
          <h2>Consignment PDF Report</h2>
          <p className="consignment-report-card__subtext">
            Filter consignments, select the rows you need, and export only those rows to a sheet-style PDF.
          </p>
        </div>
        <div className="consignment-report-card__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClearFilters}
            disabled={loading && rows.length === 0}
          >
            <RotateCcw size={16} />
            Clear Filters
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportPdf}
            disabled={selectedRows.length === 0 || exportingPdf}
          >
            {exportingPdf ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
            {exportingPdf ? 'Exporting...' : 'Export Selected to PDF'}
          </button>
        </div>
      </div>

      <div className="consignment-report-filters">
        <label className="consignment-report-field">
          <span>Name</span>
          <input
            type="text"
            name="name"
            value={filters.name}
            onChange={handleFilterChange}
            placeholder="Filter by customer name"
          />
        </label>

        <label className="consignment-report-field">
          <span>City</span>
          <input
            type="text"
            name="city"
            value={filters.city}
            onChange={handleFilterChange}
            placeholder="Filter by city"
          />
        </label>

        <label className="consignment-report-field">
          <span>Docket No</span>
          <input
            type="text"
            name="docket_no"
            value={filters.docket_no}
            onChange={handleFilterChange}
            placeholder="Filter by docket number"
          />
        </label>

        <label className="consignment-report-field">
          <span>Start Date</span>
          <input
            type="date"
            name="start_date"
            value={filters.start_date}
            onChange={handleFilterChange}
          />
        </label>

        <label className="consignment-report-field">
          <span>End Date</span>
          <input
            type="date"
            name="end_date"
            value={filters.end_date}
            onChange={handleFilterChange}
          />
        </label>
      </div>

      <div className="consignment-report-toolbar">
        <div className="consignment-report-toolbar__meta">
          <span className="consignment-report-toolbar__badge">
            <FileSpreadsheet size={15} />
            {rows.length} visible rows
          </span>
          <span className="consignment-report-toolbar__badge accent">
            {selectedRows.length} selected
          </span>
        </div>

        {refreshing && (
          <span className="consignment-report-toolbar__status">
            <RefreshCw size={15} className="spin" />
            Updating results...
          </span>
        )}
      </div>

      <div className="consignment-report-table-wrap">
        <table className="consignment-report-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={handleToggleAllVisible}
                  aria-label="Select all visible consignments"
                />
              </th>
              <th>Name</th>
              <th>Date</th>
              <th>Docket No</th>
              <th>City</th>
              <th className="numeric">Weight</th>
              <th className="numeric">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="consignment-report-empty">
                  <RefreshCw size={18} className="spin" />
                  Loading consignment report...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="7" className="consignment-report-empty error">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="consignment-report-empty">
                  No consignments matched the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                return (
                  <tr key={row.id} className={isSelected ? 'selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(row.id)}
                        aria-label={`Select consignment ${row.docket_no || row.name}`}
                      />
                    </td>
                    <td>{row.name || '-'}</td>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.docket_no || '-'}</td>
                    <td>{row.city || '-'}</td>
                    <td className="numeric">{Number(row.weight || 0).toFixed(2)}</td>
                    <td className="numeric amount">{formatCurrency(row.amount)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="consignment-report-total-row">
        <div>
          <span className="consignment-report-total-row__label">Total Amount</span>
          <p>Auto-calculated from the currently selected consignments.</p>
        </div>
        <strong>{formatCurrency(totalAmount)}</strong>
      </div>
    </section>
  );
}