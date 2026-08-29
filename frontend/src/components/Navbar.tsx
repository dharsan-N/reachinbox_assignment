import React from 'react';
import { User, SlackConnectionInfo } from '../types';
import {
  Send,
  Activity,
  LogOut,
  Slack,
  Sparkles,
  ExternalLink,
  ChevronDown,
  MailCheck,
} from 'lucide-react';

interface NavbarProps {
  user: User | null;
  slackInfo: SlackConnectionInfo | null;
  onOpenCompose: () => void;
  onOpenSlack: () => void;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  slackInfo,
  onOpenCompose,
  onOpenSlack,
  onLogout,
  onOpenLogin,
}) => {
  const bullBoardUrl = import.meta.env.VITE_BULL_BOARD_URL || 'http://localhost:5000/admin/queues';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 glass-panel">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
            <MailCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                ReachInbox<span className="text-emerald-400">.ai</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                Scheduler
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Cold Email Automation Engine</p>
          </div>
        </div>

        {/* Center: Compose Quick Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCompose}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold text-sm rounded-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all active:scale-95"
          >
            <Send className="w-4 h-4 fill-slate-950" />
            <span>Compose Campaign</span>
          </button>
        </div>

        {/* Right: Tools & Profile */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Live BullMQ Dashboard Link */}
          <a
            href={bullBoardUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors"
            title="Open Live BullMQ Queue Monitor"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="hidden md:inline">BullMQ Dashboard</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* Slack Connection Pill */}
          <button
            onClick={onOpenSlack}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-all ${
              slackInfo?.connected
                ? 'bg-purple-950/40 border-purple-500/30 text-purple-300 hover:bg-purple-900/40'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Slack className={`w-3.5 h-3.5 ${slackInfo?.connected ? 'text-purple-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">
              {slackInfo?.connected
                ? slackInfo.connection?.channel || 'Slack Connected'
                : 'Connect Slack'}
            </span>
            {slackInfo?.connected && (
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            )}
          </button>

          {/* User Profile */}
          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2">
                <img
                  src={
                    user.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=059669&color=fff`
                  }
                  alt={user.name}
                  className="w-8 h-8 rounded-full ring-2 ring-emerald-500/20 object-cover"
                />
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                    {user.email}
                  </div>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
