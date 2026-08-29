import React, { useState } from 'react';
import { SlackConnectionInfo } from '../types';
import {
  X,
  Slack,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackInfo: SlackConnectionInfo | null;
  onConnectSlack: () => void;
  onDisconnectSlack: () => Promise<void>;
  onTestNotification: () => Promise<{ success: boolean; message: string }>;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackInfo,
  onConnectSlack,
  onDisconnectSlack,
  onTestNotification,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTestNotification();
      setTestResult(res.message || 'Notification dispatched.');
    } catch (err: any) {
      setTestResult(err.message || 'Failed to dispatch notification');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnectSlack();
      onClose();
    } catch (err: any) {
      console.error(err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Slack className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Slack Integration</h3>
              <p className="text-xs text-slate-400">Real-time Rate Limit Alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {slackInfo?.connected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Slack Connected & Active</span>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div>
                    <span className="text-slate-400">Workspace: </span>
                    <span className="font-semibold">{slackInfo.connection?.teamName || 'ReachInbox'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Target Channel: </span>
                    <span className="font-mono text-purple-300 font-semibold">
                      {slackInfo.connection?.channel || '#general'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Automatic Throttling Notification</span>
                </div>
                <p>
                  When any sender account hits its configured hourly send cap, ReachInbox will make a
                  real Slack API call alerting your channel while safely rescheduling remaining jobs.
                </p>
              </div>

              {testResult && (
                <div className="p-3 bg-slate-800 rounded-lg text-xs text-slate-200 border border-slate-700">
                  {testResult}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
                >
                  <Send className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Dispatching...' : 'Send Test Alert'}</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg transition-colors border border-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                <Slack className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">Connect Slack for Instant Alerts</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Receive instant alerts in your team's Slack channel whenever an hourly limit is
                  triggered and emails are automatically rescheduled.
                </p>
              </div>

              <button
                onClick={onConnectSlack}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#4A154B] hover:bg-[#611f69] text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95"
              >
                <Slack className="w-4 h-4" />
                <span>Connect with Slack OAuth</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
