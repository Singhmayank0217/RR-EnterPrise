import { useState, useEffect } from 'react';
import { CreditCard, Plus, Edit, Trash2, X, Check, AlertCircle, ToggleLeft, ToggleRight, Filter } from 'lucide-react';
import { rateCardsAPI, authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

// Configuration will be loaded from API
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
  { value: 'zone_4', label: 'Zone 4 - Rest of India (except Assam)' },
  { value: 'zone_5', label: 'Zone 5 - Assam' },
  { value: 'zone_6', label: 'Zone 6 - North East' }
];

const DELIVERY_PARTNERS = [
  'DTDC',
  'Delhivery',
  'BlueDart',
  'FedEx',
  'DHL',
  'Ecom Express',
  'Xpressbees',
  'Shadowfax',
  'Other'
];

export default function RateCardsPage() {
  const { isMasterAdmin, isAdmin } = useAuth();
  const toast = useToast();
  const [rateCards, setRateCards] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filters, setFilters] = useState({
    user_id: '',
    delivery_partner: '',
    service_type: '',
    is_active: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rateCardsRes, usersRes] = await Promise.all([
        rateCardsAPI.list(),
        authAPI.listUsers(0, 1000)
      ]);
      setRateCards(rateCardsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load rate cards');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.delivery_partner) params.delivery_partner = filters.delivery_partner;
      if (filters.service_type) params.service_type = filters.service_type;
      if (filters.is_active !== '') params.is_active = filters.is_active === 'true';
      
      const response = await rateCardsAPI.list(params);
      setRateCards(response.data);
    } catch (error) {
      console.error('Failed to filter:', error);
      toast.error('Failed to filter rate cards');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      user_id: '',
      delivery_partner: '',
      service_type: '',
      is_active: ''
    });
    loadData();
  };

  const handleEdit = (card) => {
    setEditingCard(card);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await rateCardsAPI.delete(id);
      setRateCards(rateCards.filter(r => r._id !== id));
      setDeleteConfirm(null);
      toast.success('Rate card deleted successfully');
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete rate card');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const response = await rateCardsAPI.toggleStatus(id);
      setRateCards(rateCards.map(r => r._id === id ? response.data : r));
      toast.success('Status updated successfully');
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('Failed to update status');
    }
  };

  const getServiceLabel = (value) => {
    const found = SERVICE_TYPES.find(s => s.value === value);
    return found ? found.label : value;
  };

  const getModeLabel = (value) => {
    const found = TRANSPORT_MODES.find(m => m.value === value);
    return found ? found.label : value;
  };

  const getRegionLabel = (value) => {
    const found = CARGO_REGIONS.find(r => r.value === value);
    return found ? found.label : value;
  };

  const getZoneLabel = (value) => {
    const found = COURIER_ZONES.find(z => z.value === value);
    return found ? found.label : value;
  };

  return (
    <div className="rate-cards-page">
      <div className="page-header">
        <h1>User Rate Cards</h1>
        <div className="page-header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          {isAdmin() && (
            <button 
              className="btn btn-primary" 
              onClick={() => { setEditingCard(null); setShowModal(true); }}
            >
              <Plus size={18} />
              Add Rate Card
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="data-card" style={{ marginBottom: '1.5rem' }}>
          <div className="data-card-header">
            <h2>Filters</h2>
          </div>
          <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>User/Client</label>
              <select
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>
                    {user.full_name} ({user.company_name || 'Individual'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Delivery Partner</label>
              <select
                value={filters.delivery_partner}
                onChange={(e) => setFilters({ ...filters, delivery_partner: e.target.value })}
              >
                <option value="">All Partners</option>
                {DELIVERY_PARTNERS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Service Type</label>
              <select
                value={filters.service_type}
                onChange={(e) => setFilters({ ...filters, service_type: e.target.value })}
              >
                <option value="">All Types</option>
                {SERVICE_TYPES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={filters.is_active}
                onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={handleFilter}>Apply</button>
              <button className="btn btn-secondary" onClick={handleClearFilters}>Clear</button>
            </div>
          </div>
        </div>
      )}

      <div className="data-card">
        <div className="data-card-header">
          <h2>All Rate Cards ({rateCards.length})</h2>
        </div>
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : rateCards.length === 0 ? (
          <div className="empty-state">
            <CreditCard size={48} />
            <h3>No rate cards found</h3>
            <p>Create rate cards to enable personalized pricing for clients.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User/Client</th>
                  <th>Delivery Partner</th>
                  <th>Service</th>
                  <th>Mode</th>
                  <th>Region/Zone</th>
                  <th>Base Rate</th>
                  <th>Docket</th>
                  <th>FOV</th>
                  <th>Fuel %</th>
                  <th>GST %</th>
                  <th>ODI</th>
                  <th>Status</th>
                  {isAdmin() && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rateCards.map((card) => (
                  <tr key={card._id}>
                    <td><strong>{card.user_name}</strong></td>
                    <td>{card.delivery_partner}</td>
                    <td>{getServiceLabel(card.service_type)}</td>
                    <td>{getModeLabel(card.mode)}</td>
                    <td>
                      {card.service_type === 'cargo' 
                        ? getRegionLabel(card.region)
                        : card.service_type === 'courier'
                          ? getZoneLabel(card.zone)
                          : '-'
                      }
                    </td>
                    <td>₹{card.base_rate}</td>
                    <td>₹{card.docket_charge}</td>
                    <td>{card.fov}</td>
                    <td>{card.fuel_charge}%</td>
                    <td>{card.gst}%</td>
                    <td>₹{card.odi}</td>
                    <td>
                      <span className={`status-badge ${card.is_active ? 'status-delivered' : 'status-cancelled'}`}>
                        {card.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin() && (
                      <td className="actions-cell">
                        <button 
                          className="action-btn" 
                          onClick={() => handleToggleStatus(card._id)} 
                          title={card.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {card.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button className="action-btn" onClick={() => handleEdit(card)} title="Edit">
                          <Edit size={16} />
                        </button>
                        <button 
                          className="action-btn" 
                          onClick={() => setDeleteConfirm(card._id)} 
                          title="Delete"
                          style={{ color: deleteConfirm === card._id ? '#dc2626' : undefined }}
                        >
                          <Trash2 size={16} />
                        </button>
                        {deleteConfirm === card._id && (
                          <div className="delete-confirm">
                            <button className="action-btn" onClick={() => handleDelete(card._id)} style={{ color: '#dc2626' }}>
                              <Check size={16} />
                            </button>
                            <button className="action-btn" onClick={() => setDeleteConfirm(null)}>
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <RateCardModal 
          card={editingCard}
          users={users}
          onClose={() => { setShowModal(false); setEditingCard(null); }} 
          onSuccess={loadData} 
        />
      )}
    </div>
  );
}

function RateCardModal({ card, users, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    user_id: card?.user_id || '',
    user_name: card?.user_name || '',
    delivery_partner: card?.delivery_partner || 'DTDC',
    service_type: card?.service_type || 'cargo',
    mode: card?.mode || 'surface',
    region: card?.region || '',
    zone: card?.zone || '',
    base_rate: card?.base_rate || 0,
    docket_charge: card?.docket_charge || 0,
    fov: card?.fov || 0,
    fuel_charge: card?.fuel_charge || 0,
    gst: card?.gst || 18,
    odi: card?.odi || 0,
    is_active: card?.is_active !== undefined ? card.is_active : true
  });

  const handleUserChange = (e) => {
    const selectedUser = users.find(u => u._id === e.target.value);
    setFormData({
      ...formData,
      user_id: e.target.value,
      user_name: selectedUser?.full_name || ''
    });
  };

  const handleServiceTypeChange = (e) => {
    const newType = e.target.value;
    setFormData({
      ...formData,
      service_type: newType,
      region: newType === 'cargo' ? (formData.region || 'north') : '',
      zone: newType === 'courier' ? (formData.zone || 'zone_1') : ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.user_id) {
      setError('Please select a user');
      setLoading(false);
      return;
    }

    if (formData.service_type === 'cargo' && !formData.region) {
      setError('Please select a region for Cargo service');
      setLoading(false);
      return;
    }

    if (formData.service_type === 'courier' && !formData.zone) {
      setError('Please select a zone for Courier service');
      setLoading(false);
      return;
    }

    if (formData.fov < 0 || formData.fov > 1) {
      setError('FOV must be between 0 and 1 (e.g., 0.1 to 0.8)');
      setLoading(false);
      return;
    }

    try {
      const data = { ...formData };
      
      // Clear irrelevant fields
      if (data.service_type !== 'cargo') {
        data.region = null;
      }
      if (data.service_type !== 'courier') {
        data.zone = null;
      }

      if (card?._id) {
        await rateCardsAPI.update(card._id, data);
        toast.success('Rate card updated successfully');
      } else {
        await rateCardsAPI.create(data);
        toast.success('Rate card created successfully');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save rate card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{card ? 'Edit Rate Card' : 'Create Rate Card'}</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}
            
            <h3 className="section-title">Client & Service Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>User/Client *</label>
                <select 
                  value={formData.user_id} 
                  onChange={handleUserChange}
                  required
                  disabled={!!card}
                >
                  <option value="">Select User</option>
                  {users.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.full_name} ({user.company_name || 'Individual'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Delivery Partner *</label>
                <select 
                  value={formData.delivery_partner} 
                  onChange={(e) => setFormData({ ...formData, delivery_partner: e.target.value })}
                  disabled={!!card}
                >
                  {DELIVERY_PARTNERS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Service Type *</label>
                <select 
                  value={formData.service_type} 
                  onChange={handleServiceTypeChange}
                  disabled={!!card}
                >
                  {SERVICE_TYPES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Transport Mode *</label>
                <select 
                  value={formData.mode} 
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                  disabled={!!card}
                >
                  {TRANSPORT_MODES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {formData.service_type === 'cargo' && (
                <div className="form-group">
                  <label>Region *</label>
                  <select 
                    value={formData.region} 
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    disabled={!!card}
                  >
                    <option value="">Select Region</option>
                    {CARGO_REGIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.service_type === 'courier' && (
                <div className="form-group">
                  <label>Zone *</label>
                  <select 
                    value={formData.zone} 
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    disabled={!!card}
                  >
                    <option value="">Select Zone</option>
                    {COURIER_ZONES.map(z => (
                      <option key={z.value} value={z.value}>{z.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <h3 className="section-title">Charges</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Base Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.base_rate}
                  onChange={(e) => setFormData({ ...formData, base_rate: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Docket Charge (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.docket_charge}
                  onChange={(e) => setFormData({ ...formData, docket_charge: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="form-group">
                <label>FOV (0.1 - 0.8)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.fov}
                  onChange={(e) => setFormData({ ...formData, fov: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 0.5"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Fuel Charge (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.fuel_charge}
                  onChange={(e) => setFormData({ ...formData, fuel_charge: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="form-group">
                <label>GST (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.gst}
                  onChange={(e) => setFormData({ ...formData, gst: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="form-group">
                <label>ODI Charge (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.odi}
                  onChange={(e) => setFormData({ ...formData, odi: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Status</label>
                <select 
                  value={formData.is_active ? 'active' : 'inactive'} 
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (card ? 'Update Rate Card' : 'Create Rate Card')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
