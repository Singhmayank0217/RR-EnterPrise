import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Download, Trash2, Save, X, Search, Eye, Edit2, AlertCircle, Box, Scale, IndianRupee } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'; 
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { consignmentsAPI, authAPI, invoicesAPI, rateCardsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './Consignments.css';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

const ZONES = ['LOCAL', 'ZONAL', 'METRO', 'ROI', 'WEST', 'NORTH', 'SOUTH', 'EAST'];
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

// Empty consignment template
const getEmptyConsignment = () => ({
  date: new Date().toISOString().split('T')[0],
  name: '',
  user_id: '',
  destination: '',
  destination_city: '',
  destination_state: '',
  destination_pincode: '',
  pieces: 1,
  weight: 0,
  product_name: '',
  invoice_no: '',
  invoice_id: '',
  delivery_partner: '',
  service_type: '',
  mode: '',
  region: '',
  courier_zone: '',
  zone: 'LOCAL',
  base_rate: 0,
  docket_charges: 0,
  oda_charge: 0,
  fov: 0,
  fuel_charge: 0,
  gst: 0,
  value: 0,
  rate_card_id: '',
  box1_dimensions: '',
  box2_dimensions: '',
  box3_dimensions: '',
  remarks: '',
});

function Consignments() {
  const [consignments, setConsignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [editingConsignment, setEditingConsignment] = useState(null);
  const [viewingConsignment, setViewingConsignment] = useState(null);
  const [searchText, setSearchText] = useState('');
  const toast = useToast();
  const [editingRowIds, setEditingRowIds] = useState([]);
  const [originalRowMap, setOriginalRowMap] = useState({});
  
  // Form states
  const [formData, setFormData] = useState(getEmptyConsignment());
  const [rateCardLoading, setRateCardLoading] = useState(false);
  const [rateCardError, setRateCardError] = useState('');
  const [rateCardFetched, setRateCardFetched] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [consRes, usersRes, invRes] = await Promise.all([
          consignmentsAPI.list(),
          authAPI.listUsers(),
          invoicesAPI.list(),
        ]);
        setConsignments(consRes.data);
        setUsers(usersRes.data || []);
        setInvoices(invRes.data || []);
        setError('');
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Fetch rate card
  const fetchRateCard = useCallback(async (consignmentData) => {
    if (!consignmentData.delivery_partner || !consignmentData.service_type || !consignmentData.mode) {
      return;
    }

    setRateCardLoading(true);
    setRateCardError('');
    try {
      const params = {
        delivery_partner: consignmentData.delivery_partner,
        service_type: consignmentData.service_type,
        mode: consignmentData.mode,
      };

      if (consignmentData.service_type === 'cargo' && consignmentData.region) {
        params.region = consignmentData.region;
      }
      if (consignmentData.service_type === 'courier' && consignmentData.courier_zone) {
        params.courier_zone = consignmentData.courier_zone;
      }

      const response = await rateCardsAPI.fetch(params);
      const rateCard = response.data;

      if (rateCard) {
        setFormData(prev => ({
          ...prev,
          base_rate: rateCard.base_rate || 0,
          docket_charges: rateCard.docket_charges || 0,
          oda_charge: rateCard.oda_charge || 0,
          fov: rateCard.fov || 0,
          fuel_charge: rateCard.fuel_charge || 0,
          gst: rateCard.gst || 0,
          rate_card_id: rateCard._id || rateCard.id || '',
        }));
        setRateCardFetched(true);
      }
    } catch (err) {
      console.error('Failed to fetch rate card:', err);
      setRateCardError('Failed to fetch rate card. Please try again.');
      setRateCardFetched(false);
    } finally {
      setRateCardLoading(false);
    }
  }, []);

  // Validate form
  const validateForm = useCallback(() => {
    const errors = {};
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.destination) errors.destination = 'Destination is required';
    if (!formData.weight || formData.weight <= 0) errors.weight = 'Weight must be greater than 0';
    if (!formData.product_name) errors.product_name = 'Product name is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle add entry
  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await consignmentsAPI.create(formData);
      setShowAddModal(false);
      setFormData(getEmptyConsignment());
      setRateCardFetched(false);
      setFormErrors({});
      
      const response = await consignmentsAPI.list();
      setConsignments(response.data);
      toast.success('Consignment added successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create entry');
      console.error(err);
    }
  };

  // Handle edit entry
  const handleEditEntry = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const id = editingConsignment._id || editingConsignment.id;
      
      // Prepare update data
      const updateData = { ...formData };
      delete updateData._id;
      delete updateData.id;
      delete updateData.sr_no;
      delete updateData.consignment_no;

      await consignmentsAPI.update(id, updateData);
      setShowEditModal(false);
      setEditingConsignment(null);
      setFormData(getEmptyConsignment());
      setRateCardFetched(false);
      setFormErrors({});
      
      const response = await consignmentsAPI.list();
      setConsignments(response.data);
      toast.success('Consignment updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update entry');
      console.error(err);
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this consignment?')) return;
    try {
      await consignmentsAPI.delete(id);
      const response = await consignmentsAPI.list();
      setConsignments(response.data);
      toast.success('Consignment deleted successfully!');
    } catch (err) {
      toast.error('Failed to delete consignment');
      console.error(err);
    }
  };

  // Handle view
  const handleView = (consignment) => {
    setViewingConsignment(consignment);
    setShowViewModal(true);
  };

  // Handle edit button click
  const handleEdit = (consignment) => {
    setEditingConsignment(consignment);
    setFormData({ ...consignment });
    setShowEditModal(true);
    setRateCardFetched(true);
    setRateCardError('');
    setFormErrors({});
  };

  const startInlineEdit = (consignment) => {
    const id = consignment._id || consignment.id;
    if (!id) return;
    if (!editingRowIds.includes(id)) {
      setEditingRowIds(prev => [...prev, id]);
      setOriginalRowMap(prev => ({ ...prev, [id]: { ...consignment } }));
    }
  };

  const cancelInlineEdit = (id) => {
    setEditingRowIds(prev => prev.filter(x => x !== id));
    setConsignments(prev => prev.map(r => ((r._id || r.id) === id ? (originalRowMap[id] || r) : r)));
    setOriginalRowMap(prev => { const c = { ...prev }; delete c[id]; return c; });
  };

  const saveInlineEdit = async (id) => {
    try {
      const current = consignments.find(r => (r._id || r.id) === id);
      const original = originalRowMap[id] || {};
      if (!current) return;

      const updateData = {};
      Object.keys(current).forEach((k) => {
        if (['_id', 'id', 'sr_no', 'consignment_no', 'created_at', 'created_by'].includes(k)) return;
        const cur = current[k] === undefined ? null : current[k];
        const orig = original[k] === undefined ? null : original[k];
        // Treat numbers and strings carefully
        if (JSON.stringify(cur) !== JSON.stringify(orig)) {
          updateData[k] = cur;
        }
      });

      if (Object.keys(updateData).length === 0) {
        toast.info('No changes to save');
        cancelInlineEdit(id);
        return;
      }

      // Use PUT update endpoint (server accepts partial updates via ConsignmentUpdate)
      // PATCH returned 405 in some environments; PUT is supported by backend router.
      await consignmentsAPI.update(id, updateData);
      // refresh list
      const res = await consignmentsAPI.list();
      setConsignments(res.data);
      toast.success('Changes saved');
      setEditingRowIds(prev => prev.filter(x => x !== id));
      setOriginalRowMap(prev => { const c = { ...prev }; delete c[id]; return c; });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to save changes');
    }
  };

  const onCellValueChanged = (event) => {
    const updated = event.data;
    setConsignments(prev => prev.map(r => ((r._id || r.id) === (updated._id || updated.id) ? updated : r)));
  };

  // Handle add button click
  const handleAddNew = () => {
    setEditingConsignment(null);
    setFormData(getEmptyConsignment());
    setRateCardFetched(false);
    setRateCardError('');
    setFormErrors({});
    setShowAddModal(true);
  };

  // Calculate total
  const calculateTotal = (consignment) => {
    const baseAmount = 
      parseFloat(consignment.base_rate || 0) +
      parseFloat(consignment.docket_charges || 0) +
      parseFloat(consignment.oda_charge || 0);
    
    const fovValue = parseFloat(consignment.fov || 0);
    const fuelChargeAmount = baseAmount * (parseFloat(consignment.fuel_charge || 0) / 100);
    const subtotal = baseAmount + fovValue + fuelChargeAmount;
    const gstAmount = subtotal * (parseFloat(consignment.gst || 0) / 100);
    
    return subtotal + gstAmount;
  };

  // Export Excel
  const handleExportExcel = async (options = {}) => {
    try {
      let params = {};
      
      if (options.type === 'selected') {
        const ids = selectedRows.map(row => row._id || row.id).join(',');
        params = { ids };
      } else if (options.type === 'dateRange') {
        params = { start_date: options.dateFrom, end_date: options.dateTo };
      } else if (options.type === 'zone') {
        params = { zone: options.zone };
      }

      const response = await consignmentsAPI.exportExcel(params);
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consignments_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      setShowExportModal(false);
      toast.success('Export successful!');
    } catch (err) {
      setError('Failed to export Excel');
      console.error(err);
      toast.error('Export failed');
    }
  };

  // AG Grid Column Definitions
  const columnDefs = useMemo(() => [
    { field: 'sr_no', headerName: 'SR NO', width: 80, sortable: true, filter: true, pinned: 'left' },
    { field: 'date', headerName: 'DATE', width: 120, sortable: true, filter: 'agDateColumnFilter', editable: (params) => editingRowIds.includes(params.data._id || params.data.id) },
    { field: 'consignment_no', headerName: 'CONSIGNMENT NO', width: 160, sortable: true, filter: true },
    { field: 'name', headerName: 'NAME', width: 180, sortable: true, filter: true, editable: (params) => editingRowIds.includes(params.data._id || params.data.id) },
    { field: 'destination', headerName: 'DESTINATION', width: 150, sortable: true, filter: true },
    { field: 'pieces', headerName: 'PC', width: 80, sortable: true, editable: (params) => editingRowIds.includes(params.data._id || params.data.id) },
    { field: 'weight', headerName: 'WT(kg)', width: 90, sortable: true, editable: (params) => editingRowIds.includes(params.data._id || params.data.id) },
    { field: 'product_name', headerName: 'PRODUCT', width: 150, sortable: true },
    { field: 'invoice_no', headerName: 'INVOICE', width: 120, sortable: true },
    { field: 'zone', headerName: 'ZONE', width: 100, sortable: true, filter: true },
    { 
      field: 'base_rate', 
      headerName: 'BASE RATE', 
      width: 110,
      valueFormatter: params => `₹${(params.value || 0).toFixed(2)}`,
      editable: (params) => editingRowIds.includes(params.data._id || params.data.id)
    },
    { field: 'docket_charges', headerName: 'DOCKET', width: 100, valueFormatter: params => `₹${(params.value || 0).toFixed(2)}`, editable: (params) => editingRowIds.includes(params.data._id || params.data.id) },
    { field: 'oda_charge', headerName: 'ODA', width: 90, valueFormatter: params => `₹${(params.value || 0).toFixed(2)}`, editable: (params) => editingRowIds.includes(params.data._id || params.data.id) },
    { field: 'fov', headerName: 'FOV', width: 90 },
    { field: 'value', headerName: 'VALUE', width: 100, valueFormatter: params => `₹${(params.value || 0).toFixed(2)}` },
    { 
      field: 'total', 
      headerName: 'TOTAL', 
      width: 110, 
      cellStyle: { fontWeight: 'bold', color: '#059669' },
      valueFormatter: params => `₹${(params.value || 0).toFixed(2)}`
    },
    {
      headerName: 'ACTIONS',
      field: 'actions',
      pinned: 'right',
      width: 150,
      sortable: false,
      filter: false,
      cellRenderer: (params) => {
        const id = params.data?._id || params.data?.id;
        const isEditing = editingRowIds.includes(id);
        return (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', height: '100%' }}>
            {!isEditing && (
              <>
                <button
                  className="btn-icon btn-view"
                  onClick={() => handleView(params.data)}
                  title="View Details"
                  style={{ padding: '0.4rem', background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <Eye size={16} />
                </button>
                <button
                  className="btn-icon btn-edit"
                  onClick={() => startInlineEdit(params.data)}
                  title="Inline Edit"
                  style={{ padding: '0.4rem', background: '#fef3c7', color: '#b45309', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  className="btn-icon btn-delete"
                  onClick={() => handleDelete(id)}
                  title="Delete Consignment"
                  style={{ padding: '0.4rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button
                  className="btn-icon btn-save"
                  onClick={() => saveInlineEdit(id)}
                  title="Save Changes"
                  style={{ padding: '0.4rem', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <Save size={16} />
                </button>
                <button
                  className="btn-icon btn-cancel"
                  onClick={() => cancelInlineEdit(id)}
                  title="Cancel"
                  style={{ padding: '0.4rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        );
      }
    }
  ], [editingRowIds]);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    filterable: true,
    sortable: true,
  }), []);

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading consignments...</div>;
  }

  return (
    <div className="consignments-container">
      <div className="page-header">
        <div>
          <h1>Consignments</h1>
          <p>Manage shipping consignments and track shipments</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddNew}>
            <Plus size={18} /> Add New Consignment
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowExportModal(true)}
            disabled={consignments.length === 0}
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <Box size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Shipments</span>
            <span className="stat-value">{consignments.length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#166534' }}>
            <Scale size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Weight</span>
            <span className="stat-value">
              {consignments.reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0).toFixed(2)} <span style={{fontSize: '0.8em'}}>kg</span>
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
            <IndianRupee size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-value">
              ₹{consignments.reduce((sum, c) => sum + calculateTotal(c), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="table-header-controls">
        <div className="search-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search consignments..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="grid-container">
        <AgGridReact
          rowData={consignments}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination={true}
          paginationPageSize={50}
          theme="ag-theme-quartz"
          rowSelection="multiple"
          onSelectionChanged={(event) => setSelectedRows(event.api.getSelectedRows())}
          onCellValueChanged={onCellValueChanged}
          quickFilterText={searchText}
          domLayout="autoHeight"
        />
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <FormModal
          isEditMode={showEditModal}
          consignment={formData}
          setConsignment={setFormData}
          onSubmit={showEditModal ? handleEditEntry : handleAddEntry}
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setEditingConsignment(null);
            setFormData(getEmptyConsignment());
            setRateCardFetched(false);
            setFormErrors({});
          }}
          users={users}
          invoices={invoices}
          rateCardLoading={rateCardLoading}
          rateCardError={rateCardError}
          rateCardFetched={rateCardFetched}
          calculateTotal={calculateTotal}
          fetchRateCard={fetchRateCard}
          formErrors={formErrors}
        />
      )}

      {/* View Modal */}
      {showViewModal && (
        <ViewModal
          consignment={viewingConsignment}
          onClose={() => {
            setShowViewModal(false);
            setViewingConsignment(null);
          }}
          calculateTotal={calculateTotal}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExport={handleExportExcel}
          totalConsignments={consignments.length}
          selectedCount={selectedRows.length}
        />
      )}
    </div>
  );
}

function FormModal({
  isEditMode,
  consignment,
  setConsignment,
  onSubmit,
  onClose,
  users,
  invoices,
  rateCardLoading,
  rateCardError,
  rateCardFetched,
  calculateTotal,
  fetchRateCard,
  formErrors,
}) {
  const handleFieldChange = (field, value) => {
    setConsignment(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRateCardFieldChange = (field, value) => {
    const updated = { ...consignment, [field]: value };
    setConsignment(updated);
    if (field === 'delivery_partner' || field === 'service_type' || field === 'mode' || field === 'region' || field === 'courier_zone') {
      fetchRateCard(updated);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Consignment' : 'Add New Consignment'}</h2>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {/* Basic Information Section */}
            <h3 className="section-title">Basic Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={consignment.date}
                  onChange={(e) => handleFieldChange('date', e.target.value)}
                  required
                />
                {formErrors.date && <span className="error-text">{formErrors.date}</span>}
              </div>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={consignment.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="Customer/Sender Name"
                  required
                />
                {formErrors.name && <span className="error-text">{formErrors.name}</span>}
              </div>
              <div className="form-group">
                <label>User</label>
                <select
                  value={consignment.user_id}
                  onChange={(e) => handleFieldChange('user_id', e.target.value)}
                  style={{ color: '#000000' }}
                >
                  <option value="">Select User (Optional)</option>
                  {users.map((user) => (
                    <option key={user._id || user.id} value={user._id || user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Destination Section */}
            <h3 className="section-title">Destination Details</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Destination *</label>
                <input
                  type="text"
                  value={consignment.destination}
                  onChange={(e) => handleFieldChange('destination', e.target.value)}
                  placeholder="Full Destination Address"
                  required
                />
                {formErrors.destination && <span className="error-text">{formErrors.destination}</span>}
              </div>
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  value={consignment.destination_city}
                  onChange={(e) => handleFieldChange('destination_city', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <input
                  type="text"
                  value={consignment.destination_state}
                  onChange={(e) => handleFieldChange('destination_state', e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input
                  type="text"
                  value={consignment.destination_pincode}
                  onChange={(e) => handleFieldChange('destination_pincode', e.target.value)}
                  placeholder="Pincode"
                />
              </div>
            </div>

            {/* Product & Package Section */}
            <h3 className="section-title">Product & Package Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  value={consignment.product_name}
                  onChange={(e) => handleFieldChange('product_name', e.target.value)}
                  placeholder="What is being shipped?"
                  required
                />
                {formErrors.product_name && <span className="error-text">{formErrors.product_name}</span>}
              </div>
              <div className="form-group">
                <label>Pieces</label>
                <input
                  type="number"
                  value={consignment.pieces}
                  onChange={(e) => handleFieldChange('pieces', parseInt(e.target.value) || 1)}
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Weight (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={consignment.weight}
                  onChange={(e) => handleFieldChange('weight', parseFloat(e.target.value) || 0)}
                  required
                />
                {formErrors.weight && <span className="error-text">{formErrors.weight}</span>}
              </div>
              <div className="form-group">
                <label>Declared Value (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={consignment.value}
                  onChange={(e) => handleFieldChange('value', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Invoice Section */}
            <h3 className="section-title">Invoice Information</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Invoice No</label>
                <select
                  value={consignment.invoice_id}
                  onChange={(e) => {
                    const selectedInvoice = invoices.find(i => (i._id || i.id) === e.target.value);
                    handleFieldChange('invoice_id', e.target.value);
                    handleFieldChange('invoice_no', selectedInvoice?.invoice_number || '');
                  }}
                  style={{ color: '#000000' }}
                >
                  <option value="">Select Invoice (Optional)</option>
                  {invoices.map((invoice) => (
                    <option key={invoice._id || invoice.id} value={invoice._id || invoice.id}>
                      {invoice.invoice_number} - {invoice.customer_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rate Card Section */}
            <h3 className="section-title">Rate Card Selection</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Delivery Partner *</label>
                <select
                  value={consignment.delivery_partner}
                  onChange={(e) => handleRateCardFieldChange('delivery_partner', e.target.value)}
                  required
                  style={{ color: '#000000' }}
                >
                  <option value="">Select Partner</option>
                  {DELIVERY_PARTNERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Service Type *</label>
                <select
                  value={consignment.service_type}
                  onChange={(e) => {
                    handleFieldChange('region', '');
                    handleFieldChange('courier_zone', '');
                    handleRateCardFieldChange('service_type', e.target.value);
                  }}
                  required
                  style={{ color: '#000000' }}
                >
                  <option value="">Select Type</option>
                  {SERVICE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Mode *</label>
                <select
                  value={consignment.mode}
                  onChange={(e) => handleRateCardFieldChange('mode', e.target.value)}
                  required
                  style={{ color: '#000000' }}
                >
                  <option value="">Select Mode</option>
                  {TRANSPORT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              
              {consignment.service_type === 'cargo' && (
                <div className="form-group">
                  <label>Region *</label>
                  <select
                    value={consignment.region}
                    onChange={(e) => handleRateCardFieldChange('region', e.target.value)}
                    required
                    style={{ color: '#000000' }}
                  >
                    <option value="">Select Region</option>
                    {CARGO_REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {consignment.service_type === 'courier' && (
                <div className="form-group">
                  <label>Zone *</label>
                  <select
                    value={consignment.courier_zone}
                    onChange={(e) => handleRateCardFieldChange('courier_zone', e.target.value)}
                    required
                    style={{ color: '#000000' }}
                  >
                    <option value="">Select Zone</option>
                    {COURIER_ZONES.map((z) => (
                      <option key={z.value} value={z.value}>{z.label}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-group">
                <label>Legacy Zone</label>
                <select
                  value={consignment.zone}
                  onChange={(e) => handleFieldChange('zone', e.target.value)}
                  style={{ color: '#000000' }}
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rate Card Status */}
            {rateCardLoading && (
              <div className="alert" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', marginTop: '1rem' }}>
                Loading rate card...
              </div>
            )}
            {rateCardError && (
              <div className="alert alert-error" style={{ marginTop: '1rem' }}>
                {rateCardError}
              </div>
            )}
            {rateCardFetched && !rateCardError && (
              <div className="alert" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', marginTop: '1rem' }}>
                ✓ Rate card applied successfully
              </div>
            )}

            {/* Pricing Section */}
            <h3 className="section-title">Pricing Details {rateCardFetched && <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 'normal' }}>(Auto-filled from rate card)</span>}</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Base Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={consignment.base_rate}
                  onChange={(e) => handleFieldChange('base_rate', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label>Docket Charges (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={consignment.docket_charges}
                  onChange={(e) => handleFieldChange('docket_charges', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label>ODI/ODA Charge (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={consignment.oda_charge}
                  onChange={(e) => handleFieldChange('oda_charge', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label>FOV (Multiplier)</label>
                <input
                  type="number"
                  step="0.01"
                  value={consignment.fov}
                  onChange={(e) => handleFieldChange('fov', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label>Fuel Charge (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={consignment.fuel_charge}
                  onChange={(e) => handleFieldChange('fuel_charge', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label>GST (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={consignment.gst}
                  onChange={(e) => handleFieldChange('gst', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 'bold' }}>Total Amount (₹)</label>
                <input
                  type="text"
                  value={calculateTotal(consignment).toFixed(2)}
                  disabled
                  className="total-field"
                  style={{ background: '#f3f4f6', fontWeight: 'bold', color: '#059669', fontSize: '1.1rem' }}
                />
              </div>
            </div>

            {/* Box Dimensions Section */}
            <h3 className="section-title">Box Dimensions (L×B×H)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Box 1</label>
                <input
                  type="text"
                  value={consignment.box1_dimensions}
                  onChange={(e) => handleFieldChange('box1_dimensions', e.target.value)}
                  placeholder="e.g., 30*20*10"
                />
              </div>
              <div className="form-group">
                <label>Box 2</label>
                <input
                  type="text"
                  value={consignment.box2_dimensions}
                  onChange={(e) => handleFieldChange('box2_dimensions', e.target.value)}
                  placeholder="e.g., 30*20*10"
                />
              </div>
              <div className="form-group">
                <label>Box 3</label>
                <input
                  type="text"
                  value={consignment.box3_dimensions}
                  onChange={(e) => handleFieldChange('box3_dimensions', e.target.value)}
                  placeholder="e.g., 30*20*10"
                />
              </div>
            </div>

            {/* Remarks Section */}
            <h3 className="section-title">Additional Information</h3>
            <div className="form-group full-width">
              <label>Remarks</label>
              <textarea
                value={consignment.remarks || ''}
                onChange={(e) => handleFieldChange('remarks', e.target.value)}
                placeholder="Additional remarks or notes..."
                rows="3"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={18} /> {isEditMode ? 'Update Consignment' : 'Create Consignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewModal({ consignment, onClose, calculateTotal }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Consignment Details - {consignment.consignment_no}</h2>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body view-modal-body">
          <div className="view-grid">
            <div className="view-group">
              <label>SR NO</label>
              <p>{consignment.sr_no}</p>
            </div>
            <div className="view-group">
              <label>Consignment No</label>
              <p>{consignment.consignment_no}</p>
            </div>
            <div className="view-group">
              <label>Date</label>
              <p>{consignment.date}</p>
            </div>
            <div className="view-group">
              <label>Customer/Sender</label>
              <p>{consignment.name}</p>
            </div>
            <div className="view-group">
              <label>Destination</label>
              <p>{consignment.destination}</p>
            </div>
            <div className="view-group">
              <label>City</label>
              <p>{consignment.destination_city || 'N/A'}</p>
            </div>
            <div className="view-group">
              <label>State</label>
              <p>{consignment.destination_state || 'N/A'}</p>
            </div>
            <div className="view-group">
              <label>Pincode</label>
              <p>{consignment.destination_pincode || 'N/A'}</p>
            </div>
            <div className="view-group">
              <label>Product</label>
              <p>{consignment.product_name}</p>
            </div>
            <div className="view-group">
              <label>Pieces</label>
              <p>{consignment.pieces}</p>
            </div>
            <div className="view-group">
              <label>Weight</label>
              <p>{consignment.weight} kg</p>
            </div>
            <div className="view-group">
              <label>Declared Value</label>
              <p>₹{consignment.value}</p>
            </div>
            <div className="view-group">
              <label>Delivery Partner</label>
              <p>{consignment.delivery_partner || 'N/A'}</p>
            </div>
            <div className="view-group">
              <label>Service Type</label>
              <p>{consignment.service_type || 'N/A'}</p>
            </div>
            <div className="view-group">
              <label>Mode</label>
              <p>{consignment.mode || 'N/A'}</p>
            </div>
            <div className="view-group">
              <label>Zone</label>
              <p>{consignment.zone}</p>
            </div>
            <div className="view-group">
              <label>Base Rate</label>
              <p>₹{consignment.base_rate}</p>
            </div>
            <div className="view-group">
              <label>Docket Charges</label>
              <p>₹{consignment.docket_charges}</p>
            </div>
            <div className="view-group">
              <label>ODA Charge</label>
              <p>₹{consignment.oda_charge}</p>
            </div>
            <div className="view-group">
              <label>FOV</label>
              <p>{consignment.fov}</p>
            </div>
            <div className="view-group">
              <label>Fuel Charge</label>
              <p>{consignment.fuel_charge}%</p>
            </div>
            <div className="view-group">
              <label>GST</label>
              <p>{consignment.gst}%</p>
            </div>
            <div className="view-group">
              <label>Invoice No</label>
              <p>{consignment.invoice_no || 'N/A'}</p>
            </div>
            <div className="view-group full-width" style={{ borderTop: '2px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
              <label style={{ fontSize: '1.1rem', fontWeight: '700' }}>Total Amount</label>
              <p style={{ fontSize: '1.5rem', color: '#059669', fontWeight: '700' }}>₹{calculateTotal(consignment).toFixed(2)}</p>
            </div>
            <div className="view-group">
              <label>Box 1 Dimensions</label>
              <p>{consignment.box1_dimensions || 'N/A'}</p>
            </div>
            <div className="view-group">
              <label>Box 2 Dimensions</label>
              <p>{consignment.box2_dimensions || 'N/A'}</p>
            </div>
            <div className="view-group">
              <label>Box 3 Dimensions</label>
              <p>{consignment.box3_dimensions || 'N/A'}</p>
            </div>
            <div className="view-group full-width">
              <label>Remarks</label>
              <p>{consignment.remarks || 'N/A'}</p>
            </div>
            <div className="view-group full-width" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
              <label>Created At</label>
              <p>{new Date(consignment.created_at).toLocaleString()}</p>
            </div>
            {consignment.updated_at && (
              <div className="view-group full-width">
                <label>Last Updated</label>
                <p>{new Date(consignment.updated_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportModal({ onClose, onExport, totalConsignments, selectedCount }) {
  const [exportType, setExportType] = useState(selectedCount > 0 ? 'selected' : 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedZone, setSelectedZone] = useState('LOCAL');

  const handleExport = () => {
    onExport({ type: exportType, dateFrom, dateTo, zone: selectedZone });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>Export Consignments</h2>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>What would you like to export?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="exportType"
                  value="all"
                  checked={exportType === 'all'}
                  onChange={(e) => setExportType(e.target.value)}
                />
                <span>All Consignments <strong>({totalConsignments} records)</strong></span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: selectedCount > 0 ? 'pointer' : 'not-allowed', opacity: selectedCount > 0 ? 1 : 0.6 }}>
                <input
                  type="radio"
                  name="exportType"
                  value="selected"
                  checked={exportType === 'selected'}
                  onChange={(e) => setExportType(e.target.value)}
                  disabled={selectedCount === 0}
                />
                <span>Selected Records <strong>({selectedCount} records)</strong></span>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="exportType"
                  value="dateRange"
                  checked={exportType === 'dateRange'}
                  onChange={(e) => setExportType(e.target.value)}
                />
                <span>Custom Date Range</span>
              </label>

              {exportType === 'dateRange' && (
                <div style={{ marginLeft: '1.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.85rem' }}>From Date</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.85rem' }}>To Date</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="exportType"
                  value="zone"
                  checked={exportType === 'zone'}
                  onChange={(e) => setExportType(e.target.value)}
                />
                <span>Specific Zone</span>
              </label>

              {exportType === 'zone' && (
                <div style={{ marginLeft: '1.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.85rem' }}>Select Zone</label>
                    <select
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value)}
                      style={{ color: '#000000' }}
                    >
                      {['LOCAL', 'ZONAL', 'METRO', 'ROI', 'WEST', 'NORTH', 'SOUTH', 'EAST'].map((zone) => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="alert" style={{ 
            marginTop: '1.5rem',
            padding: '0.75rem',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: '#0369a1'
          }}>
            <strong>Note:</strong> The exported Excel file will contain all columns including consignment details, pricing, and box dimensions.
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleExport}
          >
            <Download size={18} />
            Export Excel
          </button>
        </div>
      </div>
    </div>
  );
}

export default Consignments;
