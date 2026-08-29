import axios from 'axios';
import {
  EmailJob,
  SchedulePayload,
  DashboardStats,
  Sender,
  SlackConnectionInfo,
  User,
} from '../types';

let rawBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Ensure protocol is attached if host was provided without https://
if (rawBase && !rawBase.startsWith('http://') && !rawBase.startsWith('https://') && !rawBase.startsWith('/')) {
  rawBase = `https://${rawBase}`;
}

// Ensure /api suffix exists
if (rawBase && !rawBase.endsWith('/api') && !rawBase.includes('/api')) {
  rawBase = `${rawBase.replace(/\/$/, '')}/api`;
}

export const API_BASE = rawBase;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const AuthService = {
  getMe: async (): Promise<{ user: User }> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  loginWithEmail: async (email: string, name?: string): Promise<{ user: User; token: string }> => {
    const res = await api.post('/auth/login', { email, name });
    if (res.data.token) {
      localStorage.setItem('reachinbox_token', res.data.token);
    }
    return res.data;
  },
  demoLogin: async (): Promise<{ user: User; token: string }> => {
    const res = await api.post('/auth/demo-login');
    if (res.data.token) {
      localStorage.setItem('reachinbox_token', res.data.token);
    }
    return res.data;
  },
  getGoogleAuthUrl: async (): Promise<string> => {
    const res = await api.get('/auth/google');
    return res.data.url;
  },
  logout: async () => {
    localStorage.removeItem('reachinbox_token');
    await api.post('/auth/logout');
  },
};

export const EmailService = {
  schedule: async (payload: SchedulePayload) => {
    const res = await api.post('/emails/schedule', payload);
    return res.data;
  },
  getScheduled: async (page = 1, limit = 50): Promise<{ items: EmailJob[]; total: number }> => {
    const res = await api.get('/emails/scheduled', { params: { page, limit } });
    return res.data;
  },
  getSent: async (page = 1, limit = 50): Promise<{ items: EmailJob[]; total: number }> => {
    const res = await api.get('/emails/sent', { params: { page, limit } });
    return res.data;
  },
  search: async (
    q: string,
    status?: string,
    page = 1,
    limit = 50
  ): Promise<{ items: EmailJob[]; total: number; source: 'elasticsearch' | 'database' }> => {
    const res = await api.get('/emails/search', { params: { q, status, page, limit } });
    return res.data;
  },
  cancel: async (id: string) => {
    const res = await api.delete(`/emails/${id}`);
    return res.data;
  },
  getStats: async (): Promise<DashboardStats> => {
    const res = await api.get('/emails/stats');
    return res.data;
  },
};

export const SenderService = {
  getSenders: async (): Promise<{ senders: Sender[] }> => {
    const res = await api.get('/senders');
    return res.data;
  },
  createSender: async (data: { name: string; email: string; hourly_limit: number }) => {
    const res = await api.post('/senders', data);
    return res.data;
  },
};

export const SlackApi = {
  getStatus: async (): Promise<SlackConnectionInfo> => {
    const res = await api.get('/slack/status');
    return res.data;
  },
  getAuthUrl: async (): Promise<string> => {
    const res = await api.get('/slack/auth');
    return res.data.url;
  },
  disconnect: async () => {
    const res = await api.delete('/slack/disconnect');
    return res.data;
  },
  sendTestAlert: async () => {
    const res = await api.post('/slack/test-notification');
    return res.data;
  },
};
