import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  login: (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  listUsers: (skip = 0, limit = 50) => api.get(`/auth/admin/users?skip=${skip}&limit=${limit}`),
  createUser: (userData) => api.post('/auth/admin/create-user', userData),
};

// Shipments endpoints
export const shipmentsAPI = {
  create: (shipmentData) => api.post('/shipments/', shipmentData),
  list: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/shipments/?${queryParams}`);
  },
  get: (id) => api.get(`/shipments/${id}`),
  track: (trackingNumber) => api.get(`/shipments/track/${trackingNumber}`),
  updateStatus: (id, status, location, description = '') =>
    api.put(`/shipments/${id}/status?new_status=${status}&location=${location}&description=${description}`),
  delete: (id) => api.delete(`/shipments/${id}`),
};

// Pricing endpoints
export const pricingAPI = {
  calculate: (data) => api.post('/pricing/calculate', data),
  listRules: () => api.get('/pricing/rules'),
  createRule: (ruleData) => api.post('/pricing/rules', ruleData),
  updateRule: (id, data) => api.put(`/pricing/rules/${id}`, data),
  deleteRule: (id) => api.delete(`/pricing/rules/${id}`),
};

// Invoices endpoints
export const invoicesAPI = {
  create: (invoiceData) => api.post('/invoices/', invoiceData),
  list: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/invoices/?${queryParams}`);
  },
  get: (id) => api.get(`/invoices/${id}`),
  addPayment: (id, paymentData) => api.post(`/invoices/${id}/payment`, paymentData),
  downloadPDF: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  downloadExcel: (id) => api.get(`/invoices/${id}/excel`, { responseType: 'blob' }),
};

// Consignments endpoints
export const consignmentsAPI = {
  create: (data) => api.post('/consignments/', data),
  list: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/consignments/?${queryParams}`);
  },
  get: (id) => api.get(`/consignments/${id}`),
  getByUser: (userId) => api.get(`/consignments/by-user/${userId}`),
  getByInvoice: (invoiceId) => api.get(`/consignments/by-invoice/${invoiceId}`),
  update: (id, data) => api.put(`/consignments/${id}`, data),
  patch: (id, data) => api.patch(`/consignments/${id}`, data),
  delete: (id) => api.delete(`/consignments/${id}`),
  exportExcel: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/consignments/export/excel?${queryParams}`, { responseType: 'blob' });
  },
};

// Rate Cards endpoints
export const rateCardsAPI = {
  create: (data) => api.post('/rate-cards/', data),
  list: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/rate-cards/?${queryParams}`);
  },
  get: (id) => api.get(`/rate-cards/${id}`),
  getByUser: (userId) => api.get(`/rate-cards/user/${userId}`),
  fetch: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/rate-cards/fetch?${queryParams}`);
  },
  update: (id, data) => api.put(`/rate-cards/${id}`, data),
  delete: (id) => api.delete(`/rate-cards/${id}`),
  toggleStatus: (id) => api.patch(`/rate-cards/${id}/toggle-status`),
  getConfig: () => api.get('/rate-cards/config'),
};

export default api;

