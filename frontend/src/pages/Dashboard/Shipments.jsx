import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Plus, Truck, Eye, Edit, Trash2, X, MapPin, Search, Filter, Box, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { shipmentsAPI, pricingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Consignments.css'; // Use shared styles

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { isAdmin } = useAuth();
  const toast = useToast();

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      const response = await shipmentsAPI.list();
      setShipments(response.data);
    } catch (error) {
      console.error('Failed to load shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shipment?')) return;
    try {
      await shipmentsAPI.delete(id);
      loadShipments();
      toast.success('Shipment deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete shipment');
      console.error('Failed to delete shipment:', error);
    }
  };

  const getStatusClass = (status) => `status-badge status-${status}`;

  // Filter shipments based on search and status
  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
      const matchesSearch = searchTerm === '' || 
        shipment.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.origin?.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.destination?.city?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [shipments, searchTerm, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: shipments.length,
      active: shipments.filter(s => ['pending', 'picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)).length,
      delivered: shipments.filter(s => s.status === 'delivered').length,
      exceptions: shipments.filter(s => ['cancelled', 'returned'].includes(s.status)).length
    };
  }, [shipments]);

  const statuses = ['all', 'pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];

  return (
    <div className="shipments-page">
      <div className="page-header">
        <h1>Shipments</h1>
        {isAdmin() && (
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} />
              New Shipment
            </button>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <Box size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Shipments</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Active / In Transit</span>
            <span className="stat-value">{stats.active}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Delivered</span>
            <span className="stat-value">{stats.delivered}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Exceptions</span>
            <span className="stat-value">{stats.exceptions}</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by tracking #, origin or destination city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <Filter size={18} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statuses.map(s => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Statuses' : s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <h2>
            {filteredShipments.length === shipments.length 
              ? `All Shipments (${shipments.length})`
              : `Showing ${filteredShipments.length} of ${shipments.length} shipments`
            }
          </h2>
          {(searchTerm || statusFilter !== 'all') && (
            <button 
              className="btn btn-sm btn-secondary"
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
            >
              Clear Filters
            </button>
          )}
        </div>
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : filteredShipments.length === 0 ? (
          <div className="empty-state">
            <Truck size={48} />
            <h3>{shipments.length === 0 ? 'No shipments found' : 'No matching shipments'}</h3>
            <p>{shipments.length === 0 
              ? 'Create your first shipment to get started.' 
              : 'Try adjusting your search or filter criteria.'
            }</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Docket No</th>
                <th>Type</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Created</th>
                {isAdmin() && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map((shipment) => (
                <tr key={shipment._id}>
                  <td><strong>{shipment.tracking_number}</strong></td>
                  <td>{shipment.docket_no || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{shipment.shipment_type}</td>
                  <td>{shipment.origin.city}</td>
                  <td>{shipment.destination.city}</td>
                  <td>{shipment.weight_kg} kg</td>
                  <td>
                    <span className={getStatusClass(shipment.status)}>
                      {shipment.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{new Date(shipment.created_at).toLocaleDateString()}</td>
                  {isAdmin() && (
                    <td className="actions-cell">
                      <button 
                        className="action-btn" 
                        title="Update Status"
                        onClick={() => {
                          setSelectedShipment(shipment);
                          setShowStatusModal(true);
                        }}
                      >
                        <MapPin size={18} />
                      </button>
                      <button 
                        className="action-btn" 
                        title="Delete"
                        onClick={() => handleDelete(shipment._id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Shipment Modal */}
      {showModal && (
        <CreateShipmentModal onClose={() => setShowModal(false)} onSuccess={loadShipments} />
      )}

      {/* Update Status Modal */}
      {showStatusModal && selectedShipment && (
        <UpdateStatusModal 
          shipment={selectedShipment}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedShipment(null);
          }} 
          onSuccess={loadShipments} 
        />
      )}
    </div>
  );
}

function CreateShipmentModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const [formData, setFormData] = useState({
    customer_id: '',
    shipment_type: 'parcel',
    weight_kg: '',
    declared_value: '',
    description: '',
    origin: {
      name: '', phone: '', address_line1: '', city: '', state: '', pincode: ''
    },
    destination: {
      name: '', phone: '', address_line1: '', city: '', state: '', pincode: ''
    }
  });

  const handleChange = (section, field, value) => {
    if (section) {
      setFormData({
        ...formData,
        [section]: { ...formData[section], [field]: value }
      });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await shipmentsAPI.create({
        ...formData,
        weight_kg: parseFloat(formData.weight_kg),
        declared_value: formData.declared_value ? parseFloat(formData.declared_value) : null,
      });
      toast.success('Shipment created successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create shipment');
      setError(err.response?.data?.detail || 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>Create New Shipment</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            
            <div className="form-row">
              <div className="form-group">
                <label>Customer ID <span style={{color: '#94a3b8', fontWeight: 'normal'}}>(required)</span></label>
                <input
                  type="text"
                  placeholder="e.g., CUST001 or customer email"
                  value={formData.customer_id}
                  onChange={(e) => handleChange(null, 'customer_id', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Shipment Type</label>
                <select
                  value={formData.shipment_type}
                  onChange={(e) => handleChange(null, 'shipment_type', e.target.value)}
                >
                  <option value="document">📄 Document (up to 500g)</option>
                  <option value="parcel">📦 Parcel (standard)</option>
                  <option value="freight">🚛 Freight (heavy/bulk)</option>
                  <option value="express">⚡ Express (priority)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Weight (kg) <span style={{color: '#94a3b8', fontWeight: 'normal'}}>(required)</span></label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="e.g., 2.5"
                  value={formData.weight_kg}
                  onChange={(e) => handleChange(null, 'weight_kg', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Declared Value (₹) <span style={{color: '#94a3b8', fontWeight: 'normal'}}>(optional)</span></label>
                <input
                  type="number"
                  placeholder="e.g., 5000 (for insurance)"
                  value={formData.declared_value}
                  onChange={(e) => handleChange(null, 'declared_value', e.target.value)}
                />
              </div>
            </div>

            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>📦 Origin Address</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input type="text" placeholder="e.g., Rahul Sharma" value={formData.origin.name} 
                  onChange={(e) => handleChange('origin', 'name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" placeholder="e.g., 9876543210" value={formData.origin.phone} 
                  onChange={(e) => handleChange('origin', 'phone', e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" placeholder="e.g., 123, ABC Road, Near XYZ Mall" value={formData.origin.address_line1} 
                onChange={(e) => handleChange('origin', 'address_line1', e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input type="text" placeholder="e.g., Mumbai" value={formData.origin.city} 
                  onChange={(e) => handleChange('origin', 'city', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>State</label>
                <input type="text" placeholder="e.g., Maharashtra" value={formData.origin.state} 
                  onChange={(e) => handleChange('origin', 'state', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input type="text" placeholder="e.g., 400001" value={formData.origin.pincode} 
                  onChange={(e) => handleChange('origin', 'pincode', e.target.value)} required />
              </div>
            </div>

            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>📍 Destination Address</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input type="text" placeholder="e.g., Priya Patel" value={formData.destination.name} 
                  onChange={(e) => handleChange('destination', 'name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" placeholder="e.g., 9123456789" value={formData.destination.phone} 
                  onChange={(e) => handleChange('destination', 'phone', e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" placeholder="e.g., 456, PQR Street, Sector 5" value={formData.destination.address_line1} 
                onChange={(e) => handleChange('destination', 'address_line1', e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input type="text" placeholder="e.g., Delhi" value={formData.destination.city} 
                  onChange={(e) => handleChange('destination', 'city', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>State</label>
                <input type="text" placeholder="e.g., Delhi" value={formData.destination.state} 
                  onChange={(e) => handleChange('destination', 'state', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input type="text" placeholder="e.g., 110001" value={formData.destination.pincode} 
                  onChange={(e) => handleChange('destination', 'pincode', e.target.value)} required />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UpdateStatusModal({ shipment, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(shipment.status);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const statuses = [
    'pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location.trim()) {
      setError('Location is required');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      await shipmentsAPI.updateStatus(shipment._id, status, location, description);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Update Shipment Status</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            
            <p style={{ marginBottom: '1rem' }}>
              <strong>Tracking:</strong> {shipment.tracking_number}
            </p>

            <div className="form-group">
              <label>New Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {statuses.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                placeholder="e.g., Delhi Hub"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g., Package scanned at hub"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
