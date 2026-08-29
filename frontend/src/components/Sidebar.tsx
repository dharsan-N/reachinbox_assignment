import React from 'react';
import { User, SlackConnectionInfo } from '../types';
import { API_BASE } from '../services/api';
import {
  Clock,
  Send,
  Plus,
  Activity,
  Slack,
  LogOut,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

interface SidebarProps {
  user: User | null;
  activeTab: 'scheduled' | 'sent';
  scheduledCount: number;
  sentCount: number;
  slackInfo: SlackConnectionInfo | null;
  onSelectTab: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  onOpenSlack: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  scheduledCount,
  sentCount,
  slackInfo,
  onSelectTab,
  onOpenCompose,
  onOpenSlack,
  onLogout,
}) => {
  const bullBoardUrl =
    import.meta.env.VITE_BULL_BOARD_URL ||
    (API_BASE ? `${API_BASE.replace(/\/api\/?$/, '')}/admin/queues` : 'http://localhost:5000/admin/queues');


  return (
    <aside className="w-64 figma-sidebar h-screen flex flex-col justify-between p-4 shrink-0 select-none">
      {/* Top Section */}
      <div className="space-y-5">
        {/* Brand Logo (ONB / ONE) */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-slate-900 font-mono">
              ONB<span className="text-emerald-500">.</span>
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Scheduler
          </span>
        </div>

        {/* User Profile Card */}
        {user && (
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src={
                  user.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=10B981&color=fff`
                }
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
              />
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Compose Button */}
        <button
          onClick={onOpenCompose}
          className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Compose</span>
        </button>

        {/* Navigation Tabs */}
        <nav className="space-y-1 pt-2">
          <button
            onClick={() => onSelectTab('scheduled')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'scheduled'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className={`w-4 h-4 ${activeTab === 'scheduled' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Scheduled</span>
            </div>
            <span
              className={`px-2 py-0.5 text-[11px] rounded-full font-mono font-bold ${
                activeTab === 'scheduled'
                  ? 'bg-emerald-200/60 text-emerald-800'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {scheduledCount}
            </span>
          </button>

          <button
            onClick={() => onSelectTab('sent')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'sent'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Send className={`w-4 h-4 ${activeTab === 'sent' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Sent</span>
            </div>
            <span
              className={`px-2 py-0.5 text-[11px] rounded-full font-mono font-bold ${
                activeTab === 'sent'
                  ? 'bg-emerald-200/60 text-emerald-800'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {sentCount}
            </span>
          </button>
        </nav>
      </div>

      {/* Bottom Integrations Section */}
      <div className="space-y-2 pt-4 border-t border-slate-100">
        {/* BullMQ Live Monitor */}
        <a
          href={bullBoardUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>BullMQ Dashboard</span>
          </div>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>

        {/* Slack Connection */}
        <button
          onClick={onOpenSlack}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Slack className={`w-3.5 h-3.5 ${slackInfo?.connected ? 'text-purple-600' : 'text-slate-400'}`} />
            <span>{slackInfo?.connected ? 'Slack Connected' : 'Connect Slack'}</span>
          </div>
          {slackInfo?.connected && (
            <span className="w-2 h-2 rounded-full bg-purple-500" />
          )}
        </button>
      </div>
    </aside>
  );
};
