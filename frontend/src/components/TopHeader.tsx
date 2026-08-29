import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { User } from '../types';

interface TopHeaderProps {
  user: User | null;
  searchQuery: string;
  loading: boolean;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  user,
  searchQuery,
  loading,
  onSearchChange,
  onRefresh,
}) => {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Search Input Bar */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
          title="Refresh Data"
        >
          <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {user && (
          <img
            src={
              user.avatar_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=10B981&color=fff`
            }
            alt={user.name}
            className="w-8 h-8 rounded-full ring-1 ring-slate-200 object-cover"
          />
        )}
      </div>
    </header>
  );
};
