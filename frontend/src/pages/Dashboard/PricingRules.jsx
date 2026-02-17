import { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { pricingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ZONES = [
  { value: 'local', label: 'Local (Within City)' },
  { value: 'zonal', label: 'Zonal (Within State)' },
  { value: 'metro', label: 'Metro (Metro to Metro)' },
  { value: 'roi', label: 'Rest of India' },
  { value: 'special', label: 'Special (NE, J&K, etc.)' }
];

const SERVICE_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'overnight', label: 'Overnight' },
  { value: 'same_day', label: 'Same Day' }
];

const SHIPMENT_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'parcel', label: 'Parcel' },
  { value: 'freight', label: 'Freight' }
];

export default function PricingRulesPage() {
  const { isMasterAdmin } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const response = await pricingAPI.listRules();
      setRules(response.data);
    } catch (error) {
      console.error('Failed to load pricing rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await pricingAPI.deleteRule(id);
      setRules(rules.filter(r => r._id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const getZoneLabel = (zone) => {
    const found = ZONES.find(z => z.value === zone);
    return found ? found.label : zone;
  };

  const getServiceLabel = (service) => {
    const found = SERVICE_TYPES.find(s => s.value === service);
    return found ? found.label : service;
  };

  return (
    <div className="pricing-rules-page">
      <div className="page-header">
        <h1>Pricing Rules</h1>
        {isMasterAdmin() && (
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={() => { setEditingRule(null); setShowModal(true); }}>
              <Plus size={18} />
              Add Rule
            </button>
          </div>
        )}
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <h2>All Pricing Rules</h2>
        </div>
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : rules.length === 0 ? (
          <div className="empty-state">
            <DollarSign size={48} />
            <h3>No pricing rules configured</h3>
            <p>Add pricing rules to enable automatic price calculation.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Zone</th>
                <th>Service</th>
                <th>Type</th>
                <th>Base Rate</th>
                <th>Per Kg</th>
                <th>Fuel %</th>
                <th>GST %</th>
                <th>Status</th>
                {isMasterAdmin() && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule._id}>
                  <td><strong>{rule.name}</strong></td>
                  <td>{getZoneLabel(rule.zone)}</td>
                  <td>{getServiceLabel(rule.service_type)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{rule.shipment_type}</td>
                  <td>₹{rule.base_rate}</td>
                  <td>₹{rule.per_kg_rate}</td>
                  <td>{rule.fuel_surcharge_percent}%</td>
                  <td>{rule.gst_percent}%</td>
                  <td>
                    <span className={`status-badge ${rule.is_active ? 'status-delivered' : 'status-cancelled'}`}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isMasterAdmin() && (
                    <td className="actions-cell">
                      <button className="action-btn" onClick={() => handleEdit(rule)} title="Edit">
                        <Edit size={16} />
                      </button>
                      <button 
                        className="action-btn" 
                        onClick={() => setDeleteConfirm(rule._id)} 
                        title="Delete"
                        style={{ color: deleteConfirm === rule._id ? '#dc2626' : undefined }}
                      >
                        <Trash2 size={16} />
                      </button>
                      {deleteConfirm === rule._id && (
                        <div className="delete-confirm">
                          <button className="action-btn" onClick={() => handleDelete(rule._id)} style={{ color: '#dc2626' }}>
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
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <PricingRuleModal 
          rule={editingRule}
          onClose={() => { setShowModal(false); setEditingRule(null); }} 
          onSuccess={loadRules} 
        />
      )}
    </div>
  );
}

function PricingRuleModal({ rule, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    zone: rule?.zone || 'local',
    shipment_type: rule?.shipment_type || 'parcel',
    service_type: rule?.service_type || 'standard',
    base_rate: rule?.base_rate || 50,
    per_kg_rate: rule?.per_kg_rate || 30,
    min_weight_kg: rule?.min_weight_kg || 0.5,
    max_weight_kg: rule?.max_weight_kg || '',
    fuel_surcharge_percent: rule?.fuel_surcharge_percent || 15,
    gst_percent: rule?.gst_percent || 18,
    is_active: rule?.is_active !== undefined ? rule.is_active : true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = {
        ...formData,
        max_weight_kg: formData.max_weight_kg || null
      };

      if (rule?._id) {
        await pricingAPI.updateRule(rule._id, {
          name: data.name,
          base_rate: data.base_rate,
          per_kg_rate: data.per_kg_rate,
          fuel_surcharge_percent: data.fuel_surcharge_percent,
          is_active: data.is_active
        });
      } else {
        await pricingAPI.createRule(data);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save pricing rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <h2>{rule ? 'Edit Pricing Rule' : 'Create Pricing Rule'}</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}
            
            <div className="form-group">
              <label>Rule Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Local Parcel"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Zone</label>
                <select 
                  value={formData.zone} 
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  disabled={!!rule}
                >
                  {ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Service Type</label>
                <select 
                  value={formData.service_type} 
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  disabled={!!rule}
                >
                  {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Shipment Type</label>
                <select 
                  value={formData.shipment_type} 
                  onChange={(e) => setFormData({ ...formData, shipment_type: e.target.value })}
                  disabled={!!rule}
                >
                  {SHIPMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Base Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.base_rate}
                  onChange={(e) => setFormData({ ...formData, base_rate: parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Per Kg Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.per_kg_rate}
                  onChange={(e) => setFormData({ ...formData, per_kg_rate: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Min Weight (Kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.min_weight_kg}
                  onChange={(e) => setFormData({ ...formData, min_weight_kg: parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Max Weight (Kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.max_weight_kg}
                  onChange={(e) => setFormData({ ...formData, max_weight_kg: e.target.value ? parseFloat(e.target.value) : '' })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Fuel Surcharge (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.fuel_surcharge_percent}
                  onChange={(e) => setFormData({ ...formData, fuel_surcharge_percent: parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="form-group">
                <label>GST (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.gst_percent}
                  onChange={(e) => setFormData({ ...formData, gst_percent: parseFloat(e.target.value) })}
                  required
                />
              </div>

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
              {loading ? 'Saving...' : (rule ? 'Update Rule' : 'Create Rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
