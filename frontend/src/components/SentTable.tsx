import React from 'react';
import { EmailJob } from '../types';
import {
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  RotateCcw,
  Inbox,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

interface SentTableProps {
  emails: EmailJob[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
  searchQuery,
  onSearchChange,
  onRefresh,
}) => {
  const getStatusBadge = (status: string, errorMessage?: string) => {
    if (status === 'SENT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Delivered
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/25 cursor-help"
        title={errorMessage || 'Sending failed'}
      >
        <XCircle className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Refresh */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search sent emails via Elasticsearch..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 transition-colors"
          />
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/90 border border-slate-700/80 hover:bg-slate-850 rounded-xl transition-colors self-end"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/95 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-4 px-5">Recipient</th>
                <th className="py-4 px-5">Subject</th>
                <th className="py-4 px-5">Delivered At</th>
                <th className="py-4 px-5">Sender</th>
                <th className="py-4 px-5">Delivery Status</th>
                <th className="py-4 px-5 text-right">Ethereal SMTP Preview</th>
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
                    <td className="py-4 px-5 text-right"><div className="w-20 h-4 bg-slate-800 rounded ml-auto" /></td>
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
                        <h4 className="text-sm font-bold text-slate-200">No delivered emails yet</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          {searchQuery
                            ? `No sent emails matching "${searchQuery}"`
                            : 'When BullMQ workers dispatch jobs through Ethereal SMTP, they will appear here with live preview links.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                emails.map((email) => {
                  const sentDate = email.sent_at ? new Date(email.sent_at) : new Date(email.updated_at);

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

                      {/* Sent Time */}
                      <td className="py-4 px-5 font-mono text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-semibold">{format(sentDate, 'MMM d, h:mm:ss a')}</span>
                        </div>
                      </td>

                      {/* Sender */}
                      <td className="py-4 px-5 font-mono text-xs text-slate-300">
                        {email.sender_email}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        {getStatusBadge(email.status, email.error_message)}
                      </td>

                      {/* Ethereal Preview Link */}
                      <td className="py-4 px-5 text-right">
                        {email.ethereal_preview_url ? (
                          <a
                            href={email.ethereal_preview_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all shadow-sm active:scale-95"
                          >
                            <span>Inspect SMTP</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-500 text-xs font-mono">Delivered</span>
                        )}
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
