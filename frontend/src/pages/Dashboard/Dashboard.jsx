import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { 
  Package, Truck, FileText, DollarSign, Users, Settings, 
  LogOut, Home, BarChart3, Plus, ClipboardList, CreditCard 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ShipmentsPage from './Shipments';
import InvoicesPage from './Invoices';
import UsersPage from './Users';
import OverviewPage from './Overview';
import ConsignmentsPage from './Consignments';
import PricingRulesPage from './PricingRules';
import RateCardsPage from './RateCards';
import ReportsPage from './Reports';
import './Dashboard.css';

export default function Dashboard() {
  const { user, logout, isAdmin, isMasterAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Package size={28} />
          <span>RR Enterprise</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="View dashboard overview and quick stats">
            <Home size={20} />
            <span>Overview</span>
          </NavLink>

          {isAdmin() && (
            <NavLink to="/dashboard/consignments" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Manage consignment records and export to Excel">
              <ClipboardList size={20} />
              <span>Consignments</span>
            </NavLink>
          )}

          <NavLink to="/dashboard/shipments" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Track and manage all shipments">
            <Truck size={20} />
            <span>Shipments</span>
          </NavLink>

          <NavLink to="/dashboard/invoices" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="View invoices and manage payments">
            <FileText size={20} />
            <span>Invoices</span>
          </NavLink>

          {isAdmin() && (
            <>
              <div className="nav-divider">Admin Tools</div>
              
              {isMasterAdmin() && (
                <NavLink to="/dashboard/users" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Manage user accounts and permissions">
                  <Users size={20} />
                  <span>Users</span>
                </NavLink>
              )}

              <NavLink to="/dashboard/pricing" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Configure shipping rates and pricing rules">
                <DollarSign size={20} />
                <span>Pricing Rules</span>
              </NavLink>

              <NavLink to="/dashboard/rate-cards" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Manage user-specific rate cards">
                <CreditCard size={20} />
                <span>Rate Cards</span>
              </NavLink>

              <NavLink to="/dashboard/reports" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="View analytics, reports and business insights">
                <BarChart3 size={20} />
                <span>Reports</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.full_name?.[0] || 'U'}</div>
            <div className="user-details">
              <span className="user-name">{user?.full_name}</span>
              <span className="user-role">{user?.role?.replace('_', ' ')}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="consignments/*" element={<ConsignmentsPage />} />
          <Route path="shipments/*" element={<ShipmentsPage />} />
          <Route path="invoices/*" element={<InvoicesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="pricing" element={<PricingRulesPage />} />
          <Route path="rate-cards" element={<RateCardsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Routes>
      </main>
    </div>
  );
}

