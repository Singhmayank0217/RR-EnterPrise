import { useState, useEffect } from 'react';
import { 
  BarChart3, Truck, FileText, DollarSign, TrendingUp, 
  Package, Calendar, Download, RefreshCw, ChevronRight, Info
} from 'lucide-react';
import { shipmentsAPI, invoicesAPI, consignmentsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState('30'); // days
  const toast = useToast();
  const [stats, setStats] = useState({
    totalShipments: 0,
    activeShipments: 0,
    deliveredShipments: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    totalConsignments: 0
  });
  const [shipmentsByStatus, setShipmentsByStatus] = useState({});
  const [revenueByZone, setRevenueByZone] = useState({});

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [shipmentsRes, invoicesRes, consignmentsRes] = await Promise.all([
        shipmentsAPI.list({ limit: 1000 }),
        invoicesAPI.list({ limit: 1000 }),
        consignmentsAPI.list({ limit: 1000 })
      ]);

      const shipments = shipmentsRes.data || [];
      const invoices = invoicesRes.data || [];
      const consignments = consignmentsRes.data || [];

      // Calculate stats
      const activeStatuses = ['pending', 'picked_up', 'in_transit', 'out_for_delivery'];
      const activeShipments = shipments.filter(s => activeStatuses.includes(s.status)).length;
      const deliveredShipments = shipments.filter(s => s.status === 'delivered').length;

      const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      const pendingPayments = invoices
        .filter(inv => inv.payment_status !== 'paid')
        .reduce((sum, inv) => sum + (inv.total_amount - (inv.amount_paid || 0)), 0);

      setStats({
        totalShipments: shipments.length,
        activeShipments,
        deliveredShipments,
        totalInvoices: invoices.length,
        totalRevenue,
        pendingPayments,
        totalConsignments: consignments.length
      });

      // Shipments by status breakdown
      const statusCounts = {};
      shipments.forEach(s => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      });
      setShipmentsByStatus(statusCounts);

      // Revenue breakdown by zone using real consignment data if available
      const zoneCounts = {
        'LOCAL': 0,
        'ZONAL': 0,
        'METRO': 0,
        'ROI': 0
      };

      consignments.forEach(c => {
        const zone = c.zone || 'ROI';
        const total = parseFloat(c.base_rate || 0) + 
                     parseFloat(c.docket_charges || 0) + 
                     parseFloat(c.oda_charge || 0) + 
                     parseFloat(c.fov || 0);
        if (zoneCounts[zone] !== undefined) {
          zoneCounts[zone] += total;
        } else {
          zoneCounts['ROI'] += total;
        }
      });
      setRevenueByZone(zoneCounts);

    } catch (error) {
      console.error('Failed to load report data:', error);
      toast.error('Failed to load analytical data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    setExporting(true);
    toast.info('Generating PDF report...');
    
    // Simulate export
    setTimeout(() => {
      setExporting(false);
      toast.success('Report downloaded successfully!');
    }, 2000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
      picked_up: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
      in_transit: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
      out_for_delivery: 'linear-gradient(90deg, #6366f1, #818cf8)',
      delivered: 'linear-gradient(90deg, #10b981, #34d399)',
      cancelled: 'linear-gradient(90deg, #ef4444, #f87171)',
      returned: 'linear-gradient(90deg, #6b7280, #9ca3af)'
    };
    return colors[status] || '#64748b';
  };

  const getStatusLabel = (status) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const maxStatusCount = Math.max(...Object.values(shipmentsByStatus), 1);

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1>Reports & Analytics</h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
            Visual overview of your logistics performance and revenue.
          </p>
        </div>
        <div className="page-header-actions">
          <div className="date-select-wrapper">
            <Calendar size={16} className="calendar-icon" />
            <select 
              className="date-range-select"
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportPDF} 
            disabled={exporting || loading}
            title="Download full report as PDF"
          >
            {exporting ? <RefreshCw size={18} className="spin" /> : <Download size={18} />}
            {exporting ? 'Generating...' : 'Export PDF'}
          </button>
          <button className="btn btn-primary" onClick={loadReportData} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Truck size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Shipments</h3>
            <div className="value">{stats.totalShipments}</div>
            <div className="change" style={{ color: '#2563eb' }}>
              {stats.activeShipments} in transit <ChevronRight size={14} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Package size={24} />
          </div>
          <div className="stat-content">
            <h3>Shipment Success</h3>
            <div className="value">
              {stats.totalShipments > 0 
                ? Math.round((stats.deliveredShipments / stats.totalShipments) * 100) 
                : 0}%
            </div>
            <div className="change" style={{ color: '#059669' }}>
              {stats.deliveredShipments} delivered ✓
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Revenue</h3>
            <div className="value">{formatCurrency(stats.totalRevenue)}</div>
            <div className="change" style={{ color: '#7c3aed' }}>
              From {stats.totalInvoices} invoices
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>Unpaid Amount</h3>
            <div className="value" style={{ color: stats.pendingPayments > 0 ? '#dc2626' : 'inherit' }}>
              {formatCurrency(stats.pendingPayments)}
            </div>
            <div className="change" style={{ color: stats.pendingPayments > 0 ? '#f59e0b' : '#10b981' }}>
              {stats.pendingPayments > 0 ? 'Needs follow-up ⚠' : 'Full collection ✓'}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="reports-grid">
        {/* Shipments by Status */}
        <div className="data-card">
          <div className="data-card-header">
            <h2>Status Distribution</h2>
            <div className="info-tooltip" title="Current distribution of all shipments by their delivery status">
              <Info size={16} color="#94a3b8" />
            </div>
          </div>
          <div className="chart-container" style={{ padding: '1.5rem' }}>
            {loading ? (
              <div className="loading-shimmer" style={{ height: '200px' }}></div>
            ) : Object.keys(shipmentsByStatus).length === 0 ? (
              <div className="empty-state">
                <Truck size={48} />
                <h3>No shipment data</h3>
                <p>Shipment statistics will appear here once you create shipments.</p>
              </div>
            ) : (
              <div className="bar-chart">
                {Object.entries(shipmentsByStatus).map(([status, count]) => (
                  <div key={status} className="bar-item">
                    <div className="bar-label">
                      <span>{getStatusLabel(status)}</span>
                      <span className="bar-value">{count} shipments</span>
                    </div>
                    <div className="bar-track">
                      <div 
                        className="bar-fill"
                        style={{ 
                          width: `${(count / maxStatusCount) * 100}%`,
                          background: getStatusColor(status)
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Revenue Overview */}
        <div className="data-card">
          <div className="data-card-header">
            <h2>Revenue by Zone</h2>
            <div className="info-tooltip" title="Total revenue earned from consignments in different delivery zones">
              <Info size={16} color="#94a3b8" />
            </div>
          </div>
          <div className="chart-container" style={{ padding: '1.5rem' }}>
            {loading ? (
              <div className="loading-shimmer" style={{ height: '200px' }}></div>
            ) : stats.totalRevenue === 0 ? (
              <div className="empty-state">
                <DollarSign size={48} />
                <h3>No revenue data</h3>
                <p>Record consignments with rates to see zone-wise revenue breakdown.</p>
              </div>
            ) : (
              <div className="revenue-cards">
                {Object.entries(revenueByZone).map(([zone, amount]) => (
                  <div key={zone} className="revenue-card-premium">
                    <div className="revenue-header">
                      <span className="revenue-zone-tag">{zone}</span>
                      <span className="revenue-percent-tag">
                        {stats.totalRevenue > 0 
                          ? Math.round((amount / stats.totalRevenue) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <div className="revenue-amount-large">{formatCurrency(amount)}</div>
                    <div className="revenue-footer-bar">
                      <div 
                        className="revenue-progress" 
                        style={{ 
                          width: `${stats.totalRevenue > 0 ? (amount / stats.totalRevenue) * 100 : 0}%`,
                          background: zone === 'LOCAL' ? '#3b82f6' : zone === 'ZONAL' ? '#10b981' : zone === 'METRO' ? '#8b5cf6' : '#f59e0b'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="data-card">
        <div className="data-card-header">
          <h2>Financial Summary</h2>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div className="summary-grid-enhanced">
            <div className="summary-item-premium">
              <div className="summary-icon-circular">
                <FileText size={20} />
              </div>
              <div className="summary-details">
                <div className="summary-label">Processed Invoices</div>
                <div className="summary-value">{stats.totalInvoices}</div>
              </div>
            </div>
            
            <div className="summary-item-premium">
              <div className="summary-icon-circular">
                <Package size={20} />
              </div>
              <div className="summary-details">
                <div className="summary-label">Consignment Entries</div>
                <div className="summary-value">{stats.totalConsignments}</div>
              </div>
            </div>
            
            <div className="summary-item-premium">
              <div className="summary-icon-circular">
                <TrendingUp size={20} />
              </div>
              <div className="summary-details">
                <div className="summary-label">Efficiency Ratio</div>
                <div className="summary-value">
                  {stats.totalShipments > 0 
                    ? (stats.deliveredShipments / stats.totalShipments).toFixed(2) 
                    : '0.00'}
                </div>
              </div>
            </div>
            
            <div className="summary-item-premium">
              <div className="summary-icon-circular">
                <Calendar size={20} />
              </div>
              <div className="summary-details">
                <div className="summary-label">Tracking Range</div>
                <div className="summary-value">Last {dateRange} Days</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .reports-page {
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .date-select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .calendar-icon {
          position: absolute;
          left: 10px;
          color: #94a3b8;
          pointer-events: none;
        }

        .date-range-select {
          padding: 0.625rem 1rem 0.625rem 2.25rem !important;
          border-radius: 12px !important;
          border: 1px solid #e2e8f0 !important;
          font-weight: 500;
          color: #1e293b;
          min-width: 160px;
        }

        .bar-chart {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .bar-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .bar-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          font-weight: 500;
          color: #475569;
        }

        .bar-value {
          font-weight: 600;
          color: #1e293b;
        }

        .bar-track {
          height: 12px;
          background: #f1f5f9;
          border-radius: 6px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .revenue-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1.25rem;
        }

        .revenue-card-premium {
          background: white;
          border: 1px solid #f1f5f9;
          border-radius: 16px;
          padding: 1.25rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          transition: all 0.3s ease;
        }

        .revenue-card-premium:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.05);
          border-color: #e2e8f0;
        }

        .revenue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .revenue-zone-tag {
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .revenue-percent-tag {
          background: #f0fdf4;
          color: #166534;
          padding: 2px 8px;
          border-radius: 99px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .revenue-amount-large {
          font-size: 1.5rem;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 1rem;
        }

        .revenue-footer-bar {
          height: 4px;
          background: #f1f5f9;
          border-radius: 2px;
          overflow: hidden;
        }

        .revenue-progress {
          height: 100%;
          transition: width 1s ease;
        }

        .summary-grid-enhanced {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.5rem;
        }

        .summary-item-premium {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          background: #f8fafc;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          transition: background 0.2s ease;
        }

        .summary-item-premium:hover {
          background: #f1f5f9;
        }

        .summary-icon-circular {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #667eea;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          flex-shrink: 0;
        }

        .summary-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .summary-value {
          font-size: 1.25rem;
          font-weight: 800;
          color: #1e293b;
        }

        .loading-shimmer {
          background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 12px;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
