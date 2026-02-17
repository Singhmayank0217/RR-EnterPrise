import { useState, useEffect } from 'react';
import { Users, Plus, X, DollarSign, CreditCard, Trash2, ChevronDown, ChevronUp, Package, Eye, FileText, Truck } from 'lucide-react';
import { authAPI, pricingAPI, rateCardsAPI, consignmentsAPI, invoicesAPI } from '../../services/api';

// Rate card configuration constants
const DELIVERY_PARTNERS = ['DTDC', 'Delhivery', 'BlueDart', 'FedEx', 'DHL', 'Ecom Express', 'Xpressbees', 'Shadowfax', 'Other'];

const SERVICE_TYPES = [
  { value: 'cargo', label: 'Cargo' },
  { value: 'courier', label: 'Courier' },
  { value: 'other', label: 'Other (DTDC + Tariff)' }
];

const TRANSPORT_MODES = [
  { value: 'surface', label: 'Surface' },
  { value: 'air', label: 'Air' }
];

const CARGO_REGIONS = [
  { value: 'north', label: 'North' },
  { value: 'east', label: 'East' },
  { value: 'west', label: 'West' },
  { value: 'south', label: 'South' },
  { value: 'central', label: 'Central' },
  { value: 'kerala', label: 'Kerala' },
  { value: 'guwahati', label: 'Guwahati' },
  { value: 'north_east', label: 'North East' }
];

const COURIER_ZONES = [
  { value: 'zone_1', label: 'Zone 1 - Tricity' },
  { value: 'zone_2', label: 'Zone 2 - Delhi, Punjab, Haryana' },
  { value: 'zone_3', label: 'Zone 3 - UP, HP, Jammu, Rajasthan' },
  { value: 'zone_4', label: 'Zone 4 - Rest of India' },
  { value: 'zone_5', label: 'Zone 5 - Assam' },
  { value: 'zone_6', label: 'Zone 6 - North East' }
];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetails, setShowUserDetails] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, pricingRes] = await Promise.allSettled([
        authAPI.listUsers(),
        pricingAPI.listRules()
      ]);
      
      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value.data);
      }
      if (pricingRes.status === 'fulfilled') {
        setPricingRules(pricingRes.value.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPricingRuleName = (ruleId) => {
    if (!ruleId) return '-';
    const rule = pricingRules.find(r => r._id === ruleId || r.id === ruleId);
    return rule ? rule.name : '-';
  };

  const getRoleBadgeClass = (role) => {
    const classes = {
      master_admin: 'status-badge status-delivered',
      child_admin: 'status-badge status-in_transit',
      customer: 'status-badge status-pending'
    };
    return classes[role] || 'status-badge';
  };

  const viewUserDetails = (user) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>User Management</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Add User
          </button>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <h2>All Users</h2>
        </div>
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <h3>No users found</h3>
            <p>Users will appear here.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Company</th>
                <th>Pricing Rule</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td><strong>{user.full_name}</strong></td>
                  <td>{user.email}</td>
                  <td>{user.phone || '-'}</td>
                  <td>{user.company_name || '-'}</td>
                  <td>
                    <span className="pricing-badge" style={{
                      background: user.pricing_rule_id ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#4a5568',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <DollarSign size={12} />
                      {getPricingRuleName(user.pricing_rule_id)}
                    </span>
                  </td>
                  <td>
                    <span className={getRoleBadgeClass(user.role)}>
                      {user.role?.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'status-delivered' : 'status-cancelled'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                      onClick={() => viewUserDetails(user)}
                    >
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Modal */}
      {showModal && (
        <CreateUserModal 
          onClose={() => setShowModal(false)} 
          onSuccess={loadData} 
          pricingRules={pricingRules}
        />
      )}

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <UserDetailsModal 
          user={selectedUser}
          onClose={() => {
            setShowUserDetails(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}

// User Details Modal - Shows consignments, invoices, and shipments for a user
function UserDetailsModal({ user, onClose }) {
  const [consignments, setConsignments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [rateCards, setRateCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('consignments');

  useEffect(() => {
    loadUserData();
  }, [user._id]);

  const loadUserData = async () => {
    try {
      const [consignmentsRes, invoicesRes, rateCardsRes] = await Promise.allSettled([
        consignmentsAPI.list({ user_id: user._id }),
        invoicesAPI.list({ customer_id: user._id }),
        rateCardsAPI.getByUser(user._id)
      ]);
      
      if (consignmentsRes.status === 'fulfilled') {
        setConsignments(consignmentsRes.value.data || []);
      }
      if (invoicesRes.status === 'fulfilled') {
        setInvoices(invoicesRes.value.data || []);
      }
      if (rateCardsRes.status === 'fulfilled') {
        setRateCards(rateCardsRes.value.data || []);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()} style={{ maxWidth: '1100px', maxHeight: '90vh' }}>
        <div className="modal-header">
          <div>
            <h2>{user.full_name}</h2>
            <p style={{ color: '#718096', fontSize: '0.9rem', margin: 0 }}>{user.email} • {user.company_name || 'Individual'}</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #667eea, #764ba2)', 
              borderRadius: '12px', 
              padding: '1rem', 
              color: 'white' 
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{consignments.length}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Consignments</div>
            </div>
            <div style={{ 
              background: 'linear-gradient(135deg, #f093fb, #f5576c)', 
              borderRadius: '12px', 
              padding: '1rem', 
              color: 'white' 
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{invoices.length}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Invoices</div>
            </div>
            <div style={{ 
              background: 'linear-gradient(135deg, #4facfe, #00f2fe)', 
              borderRadius: '12px', 
              padding: '1rem', 
              color: 'white' 
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{rateCards.length}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Rate Cards</div>
            </div>
            <div style={{ 
              background: 'linear-gradient(135deg, #43e97b, #38f9d7)', 
              borderRadius: '12px', 
              padding: '1rem', 
              color: 'white' 
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0))}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Business</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            <button 
              onClick={() => setActiveTab('consignments')}
              style={{ 
                padding: '0.5rem 1rem', 
                border: 'none', 
                background: activeTab === 'consignments' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                color: activeTab === 'consignments' ? 'white' : '#4a5568',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '500'
              }}
            >
              <Package size={16} /> Consignments
            </button>
            <button 
              onClick={() => setActiveTab('invoices')}
              style={{ 
                padding: '0.5rem 1rem', 
                border: 'none', 
                background: activeTab === 'invoices' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                color: activeTab === 'invoices' ? 'white' : '#4a5568',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '500'
              }}
            >
              <FileText size={16} /> Invoices
            </button>
            <button 
              onClick={() => setActiveTab('ratecards')}
              style={{ 
                padding: '0.5rem 1rem', 
                border: 'none', 
                background: activeTab === 'ratecards' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                color: activeTab === 'ratecards' ? 'white' : '#4a5568',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '500'
              }}
            >
              <CreditCard size={16} /> Rate Cards
            </button>
          </div>

          {loading ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p>Loading...</p></div>
          ) : (
            <>
              {/* Consignments Tab */}
              {activeTab === 'consignments' && (
                consignments.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <Package size={48} style={{ color: '#a0aec0' }} />
                    <h3>No consignments yet</h3>
                    <p>Consignments for this user will appear here.</p>
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Consignment #</th>
                        <th>Destination</th>
                        <th>Product</th>
                        <th>Weight</th>
                        <th>Total</th>
                        <th>Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consignments.map((c) => (
                        <tr key={c._id}>
                          <td>{formatDate(c.date)}</td>
                          <td><strong>{c.consignment_no}</strong></td>
                          <td>{c.destination}</td>
                          <td>{c.product_name}</td>
                          <td>{c.weight} kg</td>
                          <td>{formatCurrency(c.total)}</td>
                          <td>
                            {c.invoice_no ? (
                              <span style={{ 
                                background: '#48bb78', 
                                color: 'white', 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                fontSize: '0.8rem' 
                              }}>
                                {c.invoice_no}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* Invoices Tab */}
              {activeTab === 'invoices' && (
                invoices.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <FileText size={48} style={{ color: '#a0aec0' }} />
                    <h3>No invoices yet</h3>
                    <p>Invoices for this user will appear here.</p>
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Subtotal</th>
                        <th>GST</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv._id}>
                          <td><strong>{inv.invoice_number}</strong></td>
                          <td>{formatDate(inv.created_at)}</td>
                          <td>{formatCurrency(inv.subtotal)}</td>
                          <td>{formatCurrency(inv.gst_amount)}</td>
                          <td>{formatCurrency(inv.total_amount)}</td>
                          <td>{formatCurrency(inv.amount_paid)}</td>
                          <td>{formatCurrency(inv.balance_due)}</td>
                          <td>
                            <span className={`status-badge ${
                              inv.payment_status === 'paid' ? 'status-delivered' : 
                              inv.payment_status === 'partial' ? 'status-in_transit' : 'status-pending'
                            }`}>
                              {inv.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* Rate Cards Tab */}
              {activeTab === 'ratecards' && (
                rateCards.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <CreditCard size={48} style={{ color: '#a0aec0' }} />
                    <h3>No rate cards yet</h3>
                    <p>Rate cards for this user will appear here.</p>
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>Partner</th>
                        <th>Service</th>
                        <th>Mode</th>
                        <th>Region/Zone</th>
                        <th>Base Rate</th>
                        <th>Docket</th>
                        <th>FOV</th>
                        <th>GST</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateCards.map((rc) => (
                        <tr key={rc._id}>
                          <td><strong>{rc.delivery_partner}</strong></td>
                          <td>{rc.service_type}</td>
                          <td>{rc.mode}</td>
                          <td>{rc.region || rc.zone || '-'}</td>
                          <td>{formatCurrency(rc.base_rate)}</td>
                          <td>{formatCurrency(rc.docket_charge)}</td>
                          <td>{rc.fov}</td>
                          <td>{rc.gst}%</td>
                          <td>
                            <span className={`status-badge ${rc.is_active ? 'status-delivered' : 'status-cancelled'}`}>
                              {rc.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </>
          )}
        </div>
        
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// Empty rate card template
const createEmptyRateCard = () => ({
  id: Date.now(), // Temp ID for React key
  delivery_partner: 'DTDC',
  service_type: 'cargo',
  mode: 'surface',
  region: '',
  zone: '',
  base_rate: 0,
  docket_charge: 0,
  fov: 0,
  fuel_charge: 0,
  gst: 18,
  odi: 0,
  is_active: true
});

function CreateUserModal({ onClose, onSuccess, pricingRules = [] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRateCards, setShowRateCards] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    company_name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    pricing_rule_id: '',
    role: 'customer'
  });
  
  // Rate cards for this user
  const [rateCards, setRateCards] = useState([createEmptyRateCard()]);

  const addRateCard = () => {
    setRateCards([...rateCards, createEmptyRateCard()]);
  };

  const removeRateCard = (index) => {
    if (rateCards.length > 1) {
      setRateCards(rateCards.filter((_, i) => i !== index));
    }
  };

  const updateRateCard = (index, field, value) => {
    const updated = [...rateCards];
    updated[index] = { ...updated[index], [field]: value };
    
    // Clear region/zone when service type changes
    if (field === 'service_type') {
      updated[index].region = '';
      updated[index].zone = '';
    }
    
    setRateCards(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Step 1: Create the user
      const dataToSend = { ...formData };
      if (!dataToSend.pricing_rule_id) delete dataToSend.pricing_rule_id;
      if (!dataToSend.address) delete dataToSend.address;
      if (!dataToSend.city) delete dataToSend.city;
      if (!dataToSend.state) delete dataToSend.state;
      if (!dataToSend.pincode) delete dataToSend.pincode;
      
      const userResponse = await authAPI.createUser(dataToSend);
      const newUserId = userResponse.data._id || userResponse.data.id;
      const userName = formData.full_name;
      
      // Step 2: Create rate cards for this user
      const validRateCards = rateCards.filter(rc => {
        // Validate rate card has required fields
        if (rc.service_type === 'cargo' && !rc.region) return false;
        if (rc.service_type === 'courier' && !rc.zone) return false;
        return true;
      });

      const rateCardPromises = validRateCards.map(rc => {
        const rateCardData = {
          user_id: newUserId,
          user_name: userName,
          delivery_partner: rc.delivery_partner,
          service_type: rc.service_type,
          mode: rc.mode,
          region: rc.service_type === 'cargo' ? rc.region : null,
          zone: rc.service_type === 'courier' ? rc.zone : null,
          base_rate: parseFloat(rc.base_rate) || 0,
          docket_charge: parseFloat(rc.docket_charge) || 0,
          fov: parseFloat(rc.fov) || 0,
          fuel_charge: parseFloat(rc.fuel_charge) || 0,
          gst: parseFloat(rc.gst) || 18,
          odi: parseFloat(rc.odi) || 0,
          is_active: rc.is_active
        };
        return rateCardsAPI.create(rateCardData);
      });

      await Promise.allSettled(rateCardPromises);
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2>Create New User with Rate Cards</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-error">{error}</div>}
            
            {/* Basic Information */}
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#667eea' }}>Basic Information</h3>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Company Name</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Role *</label>
                <select 
                  value={formData.role} 
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{ color: '#000' }}
                >
                  <option value="customer">Customer</option>
                  <option value="child_admin">Child Admin</option>
                  <option value="master_admin">Master Admin</option>
                </select>
              </div>
            </div>

            {/* Address */}
            <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1rem', color: '#667eea' }}>Address (Optional)</h3>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                />
              </div>
            </div>

            {/* Rate Cards Section */}
            <div style={{ marginTop: '1.5rem', borderTop: '2px solid #667eea', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', color: '#667eea', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CreditCard size={18} />
                  Rate Cards for This User
                  <button 
                    type="button" 
                    onClick={() => setShowRateCards(!showRateCards)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea' }}
                  >
                    {showRateCards ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </h3>
                {showRateCards && (
                  <button type="button" className="btn btn-secondary" onClick={addRateCard} style={{ padding: '0.5rem 1rem' }}>
                    <Plus size={16} /> Add Rate Card
                  </button>
                )}
              </div>
              
              <p style={{ color: '#718096', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Define pricing rates for this user. Each rate card combination (delivery partner + service type + mode + region/zone) must be unique.
              </p>

              {showRateCards && rateCards.map((rc, index) => (
                <div key={rc.id} style={{ 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  marginBottom: '1rem',
                  background: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '600', color: '#4a5568' }}>Rate Card #{index + 1}</span>
                    {rateCards.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeRateCard(index)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  {/* Row 1: Partner, Service Type, Mode */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem' }}>Delivery Partner</label>
                      <select 
                        value={rc.delivery_partner} 
                        onChange={(e) => updateRateCard(index, 'delivery_partner', e.target.value)}
                        style={{ color: '#000', padding: '0.5rem' }}
                      >
                        {DELIVERY_PARTNERS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem' }}>Service Type</label>
                      <select 
                        value={rc.service_type} 
                        onChange={(e) => updateRateCard(index, 'service_type', e.target.value)}
                        style={{ color: '#000', padding: '0.5rem' }}
                      >
                        {SERVICE_TYPES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem' }}>Mode</label>
                      <select 
                        value={rc.mode} 
                        onChange={(e) => updateRateCard(index, 'mode', e.target.value)}
                        style={{ color: '#000', padding: '0.5rem' }}
                      >
                        {TRANSPORT_MODES.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    {rc.service_type === 'cargo' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem' }}>Region *</label>
                        <select 
                          value={rc.region} 
                          onChange={(e) => updateRateCard(index, 'region', e.target.value)}
                          style={{ color: '#000', padding: '0.5rem' }}
                          required
                        >
                          <option value="">Select Region</option>
                          {CARGO_REGIONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {rc.service_type === 'courier' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem' }}>Zone *</label>
                        <select 
                          value={rc.zone} 
                          onChange={(e) => updateRateCard(index, 'zone', e.target.value)}
                          style={{ color: '#000', padding: '0.5rem' }}
                          required
                        >
                          <option value="">Select Zone</option>
                          {COURIER_ZONES.map(z => (
                            <option key={z.value} value={z.value}>{z.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Pricing Fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem' }}>Base Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={rc.base_rate}
                        onChange={(e) => updateRateCard(index, 'base_rate', e.target.value)}
                        style={{ padding: '0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem' }}>Docket (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={rc.docket_charge}
                        onChange={(e) => updateRateCard(index, 'docket_charge', e.target.value)}
                        style={{ padding: '0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem' }}>FOV</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={rc.fov}
                        onChange={(e) => updateRateCard(index, 'fov', e.target.value)}
                        style={{ padding: '0.5rem' }}
                        placeholder="0.1-0.8"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem' }}>Fuel %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={rc.fuel_charge}
                        onChange={(e) => updateRateCard(index, 'fuel_charge', e.target.value)}
                        style={{ padding: '0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem' }}>GST %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={rc.gst}
                        onChange={(e) => updateRateCard(index, 'gst', e.target.value)}
                        style={{ padding: '0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem' }}>ODI (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={rc.odi}
                        onChange={(e) => updateRateCard(index, 'odi', e.target.value)}
                        style={{ padding: '0.5rem' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create User & Rate Cards'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
