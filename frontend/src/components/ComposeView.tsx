import React, { useState, useRef, useEffect } from 'react';
import { Sender, SchedulePayload, User } from '../types';
import {
  ArrowLeft,
  Upload,
  X,
  Clock,
  Send,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  Image,
  List,
  AlignLeft,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface ComposeViewProps {
  currentUser: User | null;
  senders: Sender[];
  onBack: () => void;
  onSchedule: (payload: SchedulePayload) => Promise<any>;
}

export const ComposeView: React.FC<ComposeViewProps> = ({
  currentUser,
  senders,
  onBack,
  onSchedule,
}) => {
  const [senderEmail, setSenderEmail] = useState<string>(
    currentUser?.email || senders[0]?.email || 'oliver.brown@email.io'
  );

  useEffect(() => {
    if (currentUser?.email) {
      setSenderEmail(currentUser.email);
    } else if (senders[0]?.email) {
      setSenderEmail(senders[0].email);
    }
  }, [currentUser, senders]);

  const [recipientInput, setRecipientInput] = useState<string>('');
  const [recipientList, setRecipientList] = useState<string[]>([]);
  const [subject, setSubject] = useState<string>('Quick intro: scaling cold email automation with ReachInbox');
  const [body, setBody] = useState<string>(
    `Hi there,\n\nI noticed your team's rapid growth and wanted to reach out.\n\nWe built ReachInbox.ai to streamline high-volume outreach campaigns with BullMQ delayed job queues, multi-sender rate limiting, and zero-duplicate guarantees.\n\nWould you have 10 minutes for a brief chat this week?\n\nBest regards,\n${currentUser?.name || 'Oliver Brown'}\nReachInbox.ai Team`
  );

  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  // Send Later Popover state
  const [isSendLaterOpen, setIsSendLaterOpen] = useState<boolean>(false);
  const [scheduleType, setScheduleType] = useState<'immediate' | 'tomorrow_8am' | 'tomorrow_1pm' | 'tomorrow_6pm' | 'custom'>('immediate');
  const [customDateTime, setCustomDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractEmails = (text: string): string[] => {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
  };

  const handleAddRecipient = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const extracted = extractEmails(recipientInput);
      if (extracted.length > 0) {
        setRecipientList((prev) => Array.from(new Set([...prev, ...extracted])));
        setRecipientInput('');
      }
    }
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipientList((prev) => prev.filter((r) => r !== emailToRemove));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const found = extractEmails(content);
        if (found.length > 0) {
          setRecipientList((prev) => Array.from(new Set([...prev, ...found])));
          setError(null);
        }
      }
    };
    reader.readAsText(file);
  };

  const getComputedStartTimeIso = (): string | undefined => {
    const now = new Date();
    if (scheduleType === 'immediate') return undefined;

    if (scheduleType === 'tomorrow_8am') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      return d.toISOString();
    }
    if (scheduleType === 'tomorrow_1pm') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(13, 0, 0, 0);
      return d.toISOString();
    }
    if (scheduleType === 'tomorrow_6pm') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
      return d.toISOString();
    }
    if (scheduleType === 'custom') {
      return new Date(customDateTime).toISOString();
    }
    return undefined;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    let finalRecipients = [...recipientList];
    if (recipientInput.trim()) {
      const extra = extractEmails(recipientInput);
      finalRecipients = Array.from(new Set([...finalRecipients, ...extra]));
    }

    if (finalRecipients.length === 0) {
      setError('Please add or upload at least one recipient email.');
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

    const startTimeIso = getComputedStartTimeIso();

    setIsSubmitting(true);
    try {
      await onSchedule({
        senderEmail,
        subject,
        body,
        recipients: finalRecipients,
        startTime: startTimeIso,
        delayBetweenEmailsMs: delayBetweenSeconds * 1000,
        hourlyLimit,
      });

      setSuccessMessage(`Enqueued ${finalRecipients.length} email(s) for delivery!`);
      setTimeout(() => {
        onBack();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to schedule campaign');
      setIsSubmitting(false);
    }
  };

  // Combine sender options
  const allSenders = [
    ...(currentUser?.email ? [{ id: 'current_user', name: currentUser.name, email: currentUser.email, hourly_limit: 200, user_id: currentUser.id }] : []),
    ...senders.filter((s) => s.email !== currentUser?.email),
  ];

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      {/* Top Header matching Figma */}
      <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-slate-900">Compose New Email</h1>
        </div>

        {/* Right Actions: Clock/Send Later & Send button */}
        <div className="flex items-center gap-3 relative">
          {/* Send Later Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>
                {scheduleType === 'immediate'
                  ? 'Send Later'
                  : scheduleType === 'tomorrow_8am'
                  ? 'Tomorrow, 8:00 AM'
                  : scheduleType === 'tomorrow_1pm'
                  ? 'Tomorrow, 1:00 PM'
                  : scheduleType === 'tomorrow_6pm'
                  ? 'Tomorrow, 6:00 PM'
                  : 'Custom Time'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Send Later Dropdown */}
            {isSendLaterOpen && (
              <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-30 space-y-2 text-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
                  Schedule Preset
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleType('immediate');
                      setIsSendLaterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                      scheduleType === 'immediate' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Send Immediately
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScheduleType('tomorrow_8am');
                      setIsSendLaterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                      scheduleType === 'tomorrow_8am' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Tomorrow, 8:00 AM
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScheduleType('tomorrow_1pm');
                      setIsSendLaterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                      scheduleType === 'tomorrow_1pm' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Tomorrow, 1:00 PM
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScheduleType('tomorrow_6pm');
                      setIsSendLaterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                      scheduleType === 'tomorrow_6pm' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Tomorrow, 6:00 PM
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-500 px-1">Custom Date & Time</label>
                  <input
                    type="datetime-local"
                    value={customDateTime}
                    onChange={(e) => {
                      setCustomDateTime(e.target.value);
                      setScheduleType('custom');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSendLaterOpen(false)}
                    className="px-3 py-1 text-slate-500 hover:text-slate-800 text-xs font-semibold"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSendLaterOpen(false)}
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Primary Green Send Button */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            {isSubmitting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 fill-white" />
            )}
            <span>Send</span>
          </button>
        </div>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2 font-bold animate-pulse">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form Content Area */}
      <div className="p-6 space-y-4 max-w-4xl w-full mx-auto flex-1 flex flex-col">
        {/* From Row */}
        <div className="flex items-center gap-4 py-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 w-16">From</span>
          <select
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            className="text-xs font-bold text-emerald-800 bg-emerald-50/60 border border-emerald-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            {allSenders.map((s) => (
              <option key={s.email} value={s.email}>
                {s.email} {s.email === currentUser?.email ? '(Your Logged In Account)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* To Row with Recipient Chips & Upload List Button */}
        <div className="flex items-start gap-4 py-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 w-16 pt-1.5">To</span>
          <div className="flex-1 flex flex-wrap items-center gap-2">
            {recipientList.map((rec) => (
              <span
                key={rec}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                <span>{rec}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(rec)}
                  className="hover:text-emerald-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            <input
              type="text"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onKeyDown={handleAddRecipient}
              placeholder={recipientList.length === 0 ? "recipient@example.com (press Enter or comma)" : "Add more recipients..."}
              className="text-xs text-slate-800 focus:outline-none min-w-[200px] flex-1 py-1"
            />
          </div>

          {/* Upload List Button */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload List</span>
          </button>
        </div>

        {/* Subject Row */}
        <div className="flex items-center gap-4 py-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 w-16">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="text-xs text-slate-800 focus:outline-none flex-1 py-1 font-semibold"
          />
        </div>

        {/* Timing & Throttling Row */}
        <div className="flex flex-wrap items-center gap-6 py-2 border-b border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Delay between Emails</span>
            <input
              type="number"
              min="0"
              max="60"
              value={delayBetweenSeconds}
              onChange={(e) => setDelayBetweenSeconds(parseInt(e.target.value, 10) || 0)}
              className="w-12 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-400">seconds</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Hourly Limit</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
              className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-400">/hr</span>
          </div>
        </div>

        {/* Email Body & Rich Toolbar */}
        <div className="flex-1 flex flex-col pt-2 min-h-[300px]">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your Reply..."
            className="w-full flex-1 text-xs text-slate-800 focus:outline-none resize-none font-sans leading-relaxed"
          />

          <div className="flex items-center gap-2 py-3 border-t border-slate-100 text-slate-400">
            <button type="button" className="p-1 hover:text-slate-700"><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-slate-700"><Italic className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-slate-700"><Underline className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-slate-700"><Strikethrough className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button type="button" className="p-1 hover:text-slate-700"><Link className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-slate-700"><Image className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-slate-700"><List className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-slate-700"><AlignLeft className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};
