import React from 'react';
import { EmailJob } from '../types';
import {
  Clock,
  Send,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Inbox,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface EmailListProps {
  type: 'scheduled' | 'sent';
  emails: EmailJob[];
  loading: boolean;
  onCancel?: (id: string) => void;
  onOpenCompose: () => void;
}

export const EmailList: React.FC<EmailListProps> = ({
  type,
  emails,
  loading,
  onCancel,
  onOpenCompose,
}) => {
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="p-4 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100" />
              <div className="space-y-1.5">
                <div className="w-36 h-3.5 bg-slate-100 rounded" />
                <div className="w-64 h-3 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="w-24 h-6 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 mb-3 shadow-sm">
          <Inbox className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">
          No {type === 'scheduled' ? 'scheduled outreach jobs' : 'sent emails'}
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          {type === 'scheduled'
            ? 'Compose and schedule emails with BullMQ delayed job queue.'
            : 'Emails dispatched through Ethereal SMTP will appear here.'}
        </p>
        {type === 'scheduled' && (
          <button
            onClick={onOpenCompose}
            className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            Compose New Email
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-2.5">
      {emails.map((email) => {
        const scheduledDate = new Date(email.scheduled_at);
        const sentDate = email.sent_at ? new Date(email.sent_at) : new Date(email.updated_at);
        const isFuture = scheduledDate.getTime() > Date.now();

        // Extract a clean name from email
        const displayName = email.recipient_email.split('@')[0].replace(/[._]/g, ' ');

        return (
          <div
            key={email.id}
            className="p-3.5 bg-white hover:bg-slate-50/80 border border-slate-200/90 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm group"
          >
            {/* Left: Contact Info & Snippet */}
            <div className="flex items-center gap-3.5 overflow-hidden">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 capitalize">
                {email.recipient_email[0]}
              </div>

              <div className="min-w-0">
                {/* Name & Recipient */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 capitalize truncate">
                    {displayName}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 truncate">
                    &lt;{email.recipient_email}&gt;
                  </span>
                </div>

                {/* Subject & Preview */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 shrink-0 truncate max-w-[160px]">
                    {email.subject}
                  </span>
                  <span className="text-xs text-slate-500 truncate">
                    {email.body.replace(/<[^>]*>?/gm, '').slice(0, 70)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Timing & Actions */}
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              {type === 'scheduled' ? (
                <>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3 h-3" />
                      <span>{format(scheduledDate, 'h:mm a')}</span>
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {isFuture ? `in ${formatDistanceToNow(scheduledDate)}` : 'Ready to send'}
                    </div>
                  </div>

                  {onCancel && (
                    <button
                      onClick={() => onCancel(email.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Cancel Email"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="text-right">
                    {email.status === 'SENT' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Sent</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    )}
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {format(sentDate, 'MMM d, h:mm a')}
                    </div>
                  </div>

                  {email.ethereal_preview_url && (
                    <a
                      href={email.ethereal_preview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors"
                      title="Inspect Ethereal SMTP Message"
                    >
                      <span>Preview</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
