import React, { useState, useRef } from 'react';
import { Sender, SchedulePayload } from '../types';
import {
  X,
  Upload,
  Clock,
  Gauge,
  Sliders,
  Send,
  AlertCircle,
  CheckCircle2,
  Users,
  Sparkles,
} from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onScheduleSuccess: () => void;
  onSchedule: (payload: SchedulePayload) => Promise<any>;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders,
  onScheduleSuccess,
  onSchedule,
}) => {
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<string>(
    senders[0]?.email || 'sarah@reachinbox.ai'
  );
  const [subject, setSubject] = useState<string>('Quick intro: scaling cold email automation with ReachInbox');
  const [body, setBody] = useState<string>(
    `Hi {{firstName}},\n\nI noticed your team's rapid growth and wanted to reach out.\n\nWe built ReachInbox.ai to streamline high-volume outreach campaigns with BullMQ delayed job queues, multi-sender rate limiting, and zero-duplicate guarantees.\n\nWould you have 10 minutes for a brief chat this week?\n\nBest regards,\nSarah Outreach\nGrowth Specialist @ ReachInbox.ai`
  );

  const [leadMethod, setLeadMethod] = useState<'upload' | 'manual'>('upload');
  const [manualEmails, setManualEmails] = useState<string>(
    'alex.smith@techcorp.io\njohn.doe@startup.ai\nsarah.connor@cyberdyne.org\nmichael.scott@dundermifflin.com'
  );
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');

  const [sendImmediately, setSendImmediately] = useState<boolean>(true);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractEmails = (text: string): string[] => {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const found = extractEmails(content);
        setParsedEmails(found);
        setError(null);
      }
    };

    reader.readAsText(file);
  };

  const activeRecipients =
    leadMethod === 'upload' ? parsedEmails : extractEmails(manualEmails);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeRecipients.length === 0) {
      setError('Please provide or upload at least one valid recipient email address.');
      return;
    }

    if (!subject.trim()) {
      setError('Subject line is required.');
      return;
    }

    if (!body.trim()) {
      setError('Email body is required.');
      return;
    }

    const startTimeIso = sendImmediately ? undefined : new Date(scheduledDateTime).toISOString();

    setIsSubmitting(true);
    try {
      await onSchedule({
        senderEmail: selectedSenderEmail,
        subject,
        body,
        recipients: activeRecipients,
        startTime: startTimeIso,
        delayBetweenEmailsMs: delayBetweenSeconds * 1000,
        hourlyLimit,
      });

      onScheduleSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl glass-modal rounded-2xl shadow-2xl overflow-hidden my-8 border border-slate-700/80">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-bold">
              <Send className="w-4 h-4 fill-slate-950" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Compose New Outreach Campaign</span>
                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  BullMQ Queue
                </span>
              </h2>
              <p className="text-xs text-slate-400">Zero Cron &bull; Redis Delayed Jobs &bull; Ethereal SMTP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">From Account</label>
              <select
                value={selectedSenderEmail}
                onChange={(e) => setSelectedSenderEmail(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.email}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter compelling subject line..."
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 transition-colors"
                required
              />
            </div>
          </div>

          {/* Email Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300">Email Body</label>
              <span className="text-[11px] text-slate-400">Supports HTML formatting and line spacing</span>
            </div>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 font-sans focus:outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          {/* Lead Upload & Parser */}
          <div className="space-y-3 p-4 bg-slate-950/70 rounded-xl border border-slate-800/90">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">Recipient Leads</span>
              </div>
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLeadMethod('upload')}
                  className={`px-3 py-1 rounded-md transition-all font-semibold ${
                    leadMethod === 'upload'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Upload File (.csv, .txt)
                </button>
                <button
                  type="button"
                  onClick={() => setLeadMethod('manual')}
                  className={`px-3 py-1 rounded-md transition-all font-semibold ${
                    leadMethod === 'manual'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Paste Text
                </button>
              </div>
            </div>

            {leadMethod === 'upload' ? (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 bg-slate-900/50 hover:bg-slate-900/80 p-4 rounded-xl text-center cursor-pointer transition-all"
                >
                  <Upload className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-200">
                    {fileName ? fileName : 'Choose CSV or Text file with lead emails'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Auto-detects email addresses from columns, comma lists, or line-separated text
                  </p>
                </div>
              </div>
            ) : (
              <textarea
                rows={3}
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
                placeholder="Paste recipient email addresses..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            )}

            {/* Email Count Detection Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">
                  {activeRecipients.length} valid email address{activeRecipients.length === 1 ? '' : 'es'} detected
                </span>
              </div>
              {activeRecipients.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">First recipient:</span>
                  <span className="text-[11px] text-slate-300 font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                    {activeRecipients[0]}
                  </span>
                  {activeRecipients.length > 1 && (
                    <span className="text-[11px] text-slate-400 font-semibold">
                      +{activeRecipients.length - 1} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Timing, Delay & Hourly Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {/* Start Time */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Schedule Time
                </label>
                <button
                  type="button"
                  onClick={() => setSendImmediately(!sendImmediately)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    sendImmediately
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {sendImmediately ? 'Send Now' : 'Future Time'}
                </button>
              </div>
              {!sendImmediately && (
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              )}
            </div>

            {/* Delay Between Sends */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  Delay Between Sends
                </label>
                <span className="text-xs font-bold text-blue-400">{delayBetweenSeconds}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={delayBetweenSeconds}
                onChange={(e) => setDelayBetweenSeconds(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">Spaces out sends to protect sender reputation</p>
            </div>

            {/* Hourly Rate Limit */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-purple-400" />
                  Hourly Limit
                </label>
                <span className="text-xs font-bold text-purple-400">{hourlyLimit}/hr</span>
              </div>
              <input
                type="number"
                min="1"
                max="1000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[10px] text-slate-400">Remaining automatically moved to next hour</p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || activeRecipients.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Scheduling Campaign...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 fill-slate-950" />
                  <span>Schedule {activeRecipients.length} Email{activeRecipients.length === 1 ? '' : 's'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
