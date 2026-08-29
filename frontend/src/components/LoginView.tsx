import React, { useState } from 'react';
import { AuthService, API_BASE } from '../services/api';
import { User } from '../types';
import { AlertCircle } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      const url = await AuthService.getGoogleAuthUrl();
      if (url) {
        window.location.href = url;
      } else {
        window.location.href = `${API_BASE}/auth/google`;
      }
    } catch {
      window.location.href = `${API_BASE}/auth/google`;
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }

    setLoading(true);
    try {
      const { user } = await AuthService.loginWithEmail(email);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-[340px] bg-white border border-[#E5E7EB] rounded-2xl p-7 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-4">
        {/* Title */}
        <h1 className="text-xl font-bold text-center text-[#111827] tracking-tight">Login</h1>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
            <span className="text-[11px] leading-tight">{error}</span>
          </div>
        )}

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full flex items-center justify-center gap-2.5 py-2 px-3 bg-[#E8F5E9] hover:bg-[#DCEDC8] border border-[#C8E6C9] text-[#1F2937] font-medium text-xs rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span className="text-[11px] font-medium text-slate-700">Login with Google</span>
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center py-1">
          <div className="w-full border-t border-[#E5E7EB]" />
          <span className="absolute bg-white px-2 text-[10px] text-[#9CA3AF]">
            or sign up through email
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-3">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              className="w-full bg-[#F3F4F6] border-0 rounded-lg px-3 py-2.5 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#00A34D] transition-all"
              required
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-[#F3F4F6] border-0 rounded-lg px-3 py-2.5 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#00A34D] transition-all"
            />
          </div>

          {/* Solid Green Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#00A34D] hover:bg-[#008F43] active:bg-[#007A39] text-white font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 mt-1"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
