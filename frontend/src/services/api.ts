import axios from 'axios';
import {
  EmailJob,
  SchedulePayload,
  DashboardStats,
  Sender,
  SlackConnectionInfo,
  User,
} from '../types';

function resolveApiBase(): string {
  let envUrl = (import.meta.env.VITE_API_URL || '').trim();

  // If in browser on *.onrender.com and envUrl is empty or points to localhost
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.onrender.com')) {
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      const backendHost = window.location.hostname.replace('frontend', 'backend');
      return `https://${backendHost}/api`;
    }
  }

  if (!envUrl) {
    return 'http://localhost:5000/api';
  }

  // Remove trailing slashes
  envUrl = envUrl.replace(/\/+$/, '');

  // Strip protocol to inspect domain
  const hasHttp = envUrl.startsWith('http://');
  let stripped = envUrl.replace(/^https?:\/\//, '');

  // Extract host and path
  const slashIdx = stripped.indexOf('/');
  let host = slashIdx === -1 ? stripped : stripped.slice(0, slashIdx);
  let path = slashIdx === -1 ? '' : stripped.slice(slashIdx);

  // If host is a Render private service name (e.g. reachinbox-backend-9le9 without any dot)
  if (host && !host.includes('.') && !host.includes('localhost')) {
    host = `${host}.onrender.com`;
  }

  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const protocol = hasHttp && isLocal ? 'http://' : 'https://';

  if (!path.endsWith('/api') && !path.includes('/api')) {
    path = `${path.replace(/\/$/, '')}/api`;
  }

  return `${protocol}${host}${path}`;
}

export const API_BASE = resolveApiBase();


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
  testNotification: async () => {
    const res = await api.post('/slack/test-notification');
    return res.data;
  },
};
