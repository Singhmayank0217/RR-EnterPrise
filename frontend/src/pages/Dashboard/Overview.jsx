import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Truck, FileText, DollarSign, Users, TrendingUp, Package,
  Plus, ClipboardList, BarChart3, ArrowRight, RefreshCw
} from 'lucide-react';
import { shipmentsAPI, invoicesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function OverviewPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    shipments: 0,
    inTransit: 0,
    invoices: 0,
    pendingPayments: 0,
  });
  const [recentShipments, setRecentShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [shipmentsRes, invoicesRes] = await Promise.all([
        shipmentsAPI.list({ limit: 10 }),
        invoicesAPI.list({ limit: 5 }),
      ]);

      const shipments = shipmentsRes.data;
      const invoices = invoicesRes.data;

      setStats({
        shipments: shipments.length,
        inTransit: shipments.filter(s => s.status === 'in_transit').length,
        invoices: invoices.length,
        pendingPayments: invoices.filter(i => i.payment_status !== 'paid').length,
      });

      setRecentShipments(shipments.slice(0, 5));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => `status-badge status-${status}`;

  // Quick actions for admin
  const quickActions = [
    {
      title: 'New Shipment',
      description: 'Create a new shipment order',
      icon: Plus,
      color: 'blue',
      action: () => navigate('/dashboard/shipments')
    },
    {
      title: 'Add Consignment',
      description: 'Record a new consignment',
      icon: ClipboardList,
      color: 'green',
      action: () => navigate('/dashboard/consignments')
    },
    {
      title: 'View Invoices',
      description: 'Manage billing & payments',
      icon: FileText,
      color: 'purple',
      action: () => navigate('/dashboard/invoices')
    },
    {
      title: 'View Reports',
      description: 'Analytics & insights',
      icon: BarChart3,
      color: 'orange',
      action: () => navigate('/dashboard/reports')
    }
  ];

  return (
    <div className="overview-page">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.full_name?.split(' ')[0] || 'User'}! 👋</h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
            Here's what's happening with your logistics today.
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={loadData}
          disabled={loading}
          title="Refresh data"
        >
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Quick Actions - Easy one-click access */}
      {isAdmin() && (
        <div className="quick-actions-section">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#334155' }}>
            ⚡ Quick Actions
          </h2>
          <div className="quick-actions-grid">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className={`quick-action-card quick-action-${action.color}`}
                onClick={action.action}
              >
                <div className="quick-action-icon">
                  <action.icon size={24} />
                </div>
                <div className="quick-action-content">
                  <span className="quick-action-title">{action.title}</span>
                  <span className="quick-action-desc">{action.description}</span>
                </div>
                <ArrowRight size={18} className="quick-action-arrow" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/dashboard/shipments')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon blue">
            <Truck size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Shipments</h3>
            <div className="value">{stats.shipments}</div>
            <div className="change">Click to manage →</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/dashboard/shipments')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon orange">
            <Package size={24} />
          </div>
          <div className="stat-content">
            <h3>In Transit</h3>
            <div className="value">{stats.inTransit}</div>
            <div className="change">Active shipments</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/dashboard/invoices')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon green">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <h3>Invoices</h3>
            <div className="value">{stats.invoices}</div>
            <div className="change">Click to view →</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/dashboard/invoices')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon purple">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <h3>Pending Payments</h3>
            <div className="value">{stats.pendingPayments}</div>
            <div className="change" style={{ color: stats.pendingPayments > 0 ? '#f59e0b' : '#10b981' }}>
              {stats.pendingPayments > 0 ? 'Needs attention!' : 'All clear ✓'}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Shipments */}
      <div className="data-card">
        <div className="data-card-header">
          <h2>Recent Shipments</h2>
          <button 
            className="btn btn-sm btn-secondary"
            onClick={() => navigate('/dashboard/shipments')}
          >
            View All <ArrowRight size={16} />
          </button>
        </div>
        {loading ? (
          <div className="empty-state">
            <RefreshCw size={32} className="spin" />
            <p>Loading...</p>
          </div>
        ) : recentShipments.length === 0 ? (
          <div className="empty-state">
            <Truck size={48} />
            <h3>No shipments yet</h3>
            <p>Your recent shipments will appear here.</p>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/dashboard/shipments')}
              style={{ marginTop: '1rem' }}
            >
              <Plus size={18} /> Create First Shipment
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentShipments.map((shipment) => (
                <tr key={shipment._id} style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard/shipments')}>
                  <td><strong>{shipment.tracking_number}</strong></td>
                  <td>{shipment.origin.city}</td>
                  <td>{shipment.destination.city}</td>
                  <td>
                    <span className={getStatusClass(shipment.status)}>
                      {shipment.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{new Date(shipment.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .quick-actions-section {
          margin-bottom: 2rem;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
        }

        .quick-action-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .quick-action-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .quick-action-blue:hover { border-color: #667eea; }
        .quick-action-green:hover { border-color: #10b981; }
        .quick-action-purple:hover { border-color: #8b5cf6; }
        .quick-action-orange:hover { border-color: #f59e0b; }

        .quick-action-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .quick-action-blue .quick-action-icon {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .quick-action-green .quick-action-icon {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        .quick-action-purple .quick-action-icon {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
        }
        .quick-action-orange .quick-action-icon {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
        }

        .quick-action-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .quick-action-title {
          font-weight: 600;
          color: #1e293b;
          font-size: 1rem;
        }

        .quick-action-desc {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 2px;
        }

        .quick-action-arrow {
          color: #94a3b8;
          transition: transform 0.2s ease;
        }

        .quick-action-card:hover .quick-action-arrow {
          transform: translateX(4px);
          color: #667eea;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

