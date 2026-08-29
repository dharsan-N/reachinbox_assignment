import React from 'react';
import { DashboardStats } from '../types';
import { Clock, Send, AlertTriangle, Layers, Server } from 'lucide-react';

interface StatsBarProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, loading }) => {
  const cards = [
    {
      title: 'Scheduled Emails',
      value: stats?.dbStats.scheduled_count || '0',
      subtitle: `${stats?.queueStats.delayed || 0} in Redis Delay Queue`,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      title: 'Sent Emails',
      value: stats?.dbStats.sent_count || '0',
      subtitle: `${stats?.queueStats.completed || 0} completed jobs`,
      icon: Send,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      title: 'Rate-Limited & Rescheduled',
      value: stats?.dbStats.rescheduled_count || '0',
      subtitle: 'Preserved in queue without loss',
      icon: AlertTriangle,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
    {
      title: 'Active BullMQ Workers',
      value: `${stats?.queueStats.active || 0} active`,
      subtitle: `${stats?.queueStats.waiting || 0} waiting in Redis`,
      icon: Server,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-4 rounded-xl glass-card ${card.border} hover:border-slate-600/60 transition-all flex items-center justify-between`}
          >
            <div>
              <p className="text-xs font-medium text-slate-400">{card.title}</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">
                {loading ? (
                  <span className="inline-block w-12 h-6 bg-slate-700/50 rounded animate-pulse" />
                ) : (
                  card.value
                )}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{card.subtitle}</p>
            </div>
            <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
