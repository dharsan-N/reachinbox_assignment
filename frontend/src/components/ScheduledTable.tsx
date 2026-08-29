import React from 'react';
import { EmailJob } from '../types';
import {
  Clock,
  Search,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Inbox,
  Send,
  Calendar,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ScheduledTableProps {
  emails: EmailJob[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCancel: (id: string) => void;
  onRefresh: () => void;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  searchQuery,
  onSearchChange,
  onCancel,
  onRefresh,
  onOpenCompose,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '4s' }} />
            Scheduled
          </span>
        );
      case 'RATE_LIMITED_RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/25">
            <AlertTriangle className="w-3 h-3" />
            Rate Limit Rescheduled
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            Dispatching...
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search recipient, subject, body via Elasticsearch..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/90 border border-slate-700/80 hover:bg-slate-850 rounded-xl transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/95 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-4 px-5">Recipient</th>
                <th className="py-4 px-5">Subject</th>
                <th className="py-4 px-5">Scheduled Execution</th>
                <th className="py-4 px-5">Sender Details</th>
                <th className="py-4 px-5">Queue Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5"><div className="w-36 h-4 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-5"><div className="w-48 h-4 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-5"><div className="w-28 h-4 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-5"><div className="w-24 h-4 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-5"><div className="w-20 h-4 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-5 text-right"><div className="w-8 h-4 bg-slate-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
                        <Inbox className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-200">No scheduled outreach jobs</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          {searchQuery
                            ? `No scheduled emails found matching "${searchQuery}"`
                            : 'Create and schedule your first cold email campaign with BullMQ persistent delayed queue.'}
                        </p>
                      </div>
                      {!searchQuery && (
                        <button
                          onClick={onOpenCompose}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                        >
                          <Send className="w-3.5 h-3.5 fill-slate-950" />
                          <span>Compose Campaign</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                emails.map((email) => {
                  const scheduledDate = new Date(email.scheduled_at);
                  const isFuture = scheduledDate.getTime() > Date.now();

                  return (
                    <tr
                      key={email.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Recipient */}
                      <td className="py-4 px-5 font-mono font-medium text-slate-200">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center text-[11px] uppercase font-sans font-bold border border-slate-700">
                            {email.recipient_email[0]}
                          </div>
                          <span className="font-semibold">{email.recipient_email}</span>
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="py-4 px-5 text-slate-300 max-w-xs truncate">
                        <div className="font-semibold text-slate-200 truncate">{email.subject}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                          {email.body.replace(/<[^>]*>?/gm, '').slice(0, 65)}...
                        </div>
                      </td>

                      {/* Scheduled Time */}
                      <td className="py-4 px-5">
                        <div className="font-mono text-slate-200 font-semibold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{format(scheduledDate, 'MMM d, h:mm:ss a')}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {isFuture
                            ? `Executes in ${formatDistanceToNow(scheduledDate)}`
                            : 'Ready for worker dispatch'}
                        </div>
                      </td>

                      {/* Sender Details */}
                      <td className="py-4 px-5 text-slate-400">
                        <div className="text-xs text-slate-300 font-mono font-medium truncate max-w-[160px]">
                          {email.sender_email}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          Delay: {email.delay_between_emails_ms / 1000}s &bull; Limit: {email.hourly_limit}/hr
                        </div>
                      </td>

                      {/* Queue Status */}
                      <td className="py-4 px-5">{getStatusBadge(email.status)}</td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => onCancel(email.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                          title="Cancel Scheduled Email"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
