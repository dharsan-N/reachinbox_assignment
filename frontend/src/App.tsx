import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { EmailList } from './components/EmailList';
import { ComposeView } from './components/ComposeView';
import { LoginView } from './components/LoginView';
import { SlackModal } from './components/SlackModal';
import {
  AuthService,
  EmailService,
  SenderService,
  SlackApi,
} from './services/api';
import {
  User,
  Sender,
  SlackConnectionInfo,
  EmailJob,
  DashboardStats,
  SchedulePayload,
} from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  const [senders, setSenders] = useState<Sender[]>([]);
  const [slackInfo, setSlackInfo] = useState<SlackConnectionInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposing, setIsComposing] = useState<boolean>(false);

  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isSlackOpen, setIsSlackOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle Google OAuth callback token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const slackStatus = params.get('slack');

    if (token) {
      localStorage.setItem('reachinbox_token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast('Logged in successfully with Google!');
    }

    if (slackStatus === 'connected') {
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast('Slack connected successfully!');
    }
  }, []);

  // Check current session
  const checkAuth = useCallback(async () => {
    try {
      const data = await AuthService.getMe();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load senders & slack status
  const loadMetadata = useCallback(async () => {
    if (!user) return;
    try {
      const [sendersRes, slackRes] = await Promise.all([
        SenderService.getSenders(),
        SlackApi.getStatus(),
      ]);
      setSenders(sendersRes.senders || []);
      setSlackInfo(slackRes);
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Load Dashboard stats & emails
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [statsRes, scheduledRes, sentRes] = await Promise.all([
        EmailService.getStats(),
        searchQuery.trim()
          ? EmailService.search(searchQuery.trim(), undefined, 1, 100)
          : EmailService.getScheduled(1, 100),
        searchQuery.trim()
          ? EmailService.search(searchQuery.trim(), undefined, 1, 100)
          : EmailService.getSent(1, 100),
      ]);

      setStats(statsRes);

      if (searchQuery.trim()) {
        setScheduledEmails(
          scheduledRes.items.filter(
            (e) => e.status === 'SCHEDULED' || e.status === 'RATE_LIMITED_RESCHEDULED' || e.status === 'PROCESSING'
          )
        );
        setSentEmails(sentRes.items.filter((e) => e.status === 'SENT' || e.status === 'FAILED'));
      } else {
        setScheduledEmails(scheduledRes.items);
        setSentEmails(sentRes.items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handlers
  const handleScheduleCampaign = async (payload: SchedulePayload) => {
    const res = await EmailService.schedule(payload);
    showToast(`Enqueued ${res.scheduledCount} email(s) into BullMQ!`);
    fetchData();
    return res;
  };

  const handleCancelEmail = async (id: string) => {
    try {
      await EmailService.cancel(id);
      showToast('Scheduled email cancelled.');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel', 'error');
    }
  };

  const handleConnectSlack = async () => {
    try {
      const url = await SlackApi.getAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      showToast(err.message || 'Failed to get Slack URL', 'error');
    }
  };

  const handleDisconnectSlack = async () => {
    await SlackApi.disconnect();
    setSlackInfo({ connected: false, connection: null });
    showToast('Slack disconnected.');
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setUser(null);
    showToast('Logged out successfully.');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If unauthenticated, display Figma Login Screen
  if (!user) {
    return (
      <LoginView
        onLoginSuccess={(usr) => {
          setUser(usr);
          loadMetadata();
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-bounce">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Left Sidebar matching Figma */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        scheduledCount={scheduledEmails.length}
        sentCount={sentEmails.length}
        slackInfo={slackInfo}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsComposing(false);
        }}
        onOpenCompose={() => setIsComposing(true)}
        onOpenSlack={() => setIsSlackOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {isComposing ? (
          <ComposeView
            currentUser={user}
            senders={senders}
            onBack={() => {
              setIsComposing(false);
              fetchData();
            }}
            onSchedule={handleScheduleCampaign}
          />
        ) : (
          <>
            <TopHeader
              user={user}
              searchQuery={searchQuery}
              loading={loading}
              onSearchChange={setSearchQuery}
              onRefresh={fetchData}
            />

            <main className="flex-1 overflow-y-auto">
              <EmailList
                type={activeTab}
                emails={activeTab === 'scheduled' ? scheduledEmails : sentEmails}
                loading={loading}
                onCancel={activeTab === 'scheduled' ? handleCancelEmail : undefined}
                onOpenCompose={() => setIsComposing(true)}
              />
            </main>
          </>
        )}
      </div>

      {/* Slack Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        slackInfo={slackInfo}
        onConnectSlack={handleConnectSlack}
        onDisconnectSlack={handleDisconnectSlack}
        onTestNotification={() => SlackApi.testNotification()}
      />
    </div>
  );
}

export default App;
