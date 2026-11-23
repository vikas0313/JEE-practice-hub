import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getAttempts, getSettings, hasCompletedOnboarding, getUserPreferences, getPendingStudents } from '../lib/db';
import { InstallBanner } from './InstallBanner';
import { ArchiveBanner } from './ArchiveBanner';
import { OnboardingModal } from './OnboardingModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { OfflineBanner } from './StateViews';
import { ThemeToggle } from './ThemeToggle';
import { applyThemePreferences } from '../lib/theme';
import {
  LogOut, BookOpen, BarChart3, Settings, Upload, List, AlertCircle,
  FileSpreadsheet, Sliders, RotateCcw, FileText, Target, Map,
  Bell, CheckSquare, Zap, Activity, TrendingUp, Link2, HeartPulse, Award,
  HelpCircle, Keyboard, Download, Layers, FolderTree, UserCheck, Users,
} from 'lucide-react';
import { StudentSelector } from './StudentSelector';

export function ProtectedRoute({ allowedRole }: { allowedRole?: 'student' | 'monitor' }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>;
  }

  if (!user) return <Navigate to="/login" replace />;

  // Lifecycle status check for student
  if (user.role === 'student') {
    if (user.status === 'pending_email') {
      return <Navigate to="/verify-email" replace />;
    }
    if (user.status === 'pending_approval') {
      return <Navigate to="/waiting-approval" replace />;
    }
    if (user.status === 'rejected') {
      return <Navigate to="/rejected" replace />;
    }
    if (user.status === 'suspended') {
      return <Navigate to="/suspended" replace />;
    }
  }

  // First-login notice for student
  if (user.role === 'student' && !user.time_tracking_acknowledged) {
    return <Navigate to="/welcome" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'student' ? '/practice' : '/monitor'} replace />;
  }

  return <Outlet />;
}

export function StudentLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (user) {
      const s = getSettings();
      if (s.flag_e9_performance_and_visual_polish) {
        applyThemePreferences(getUserPreferences(user.id), location.pathname);
      }
    }
  }, [user, location.pathname]);

  const settings = getSettings();
  const shouldShowOnboarding =
    Boolean(settings.flag_e10_ux_completeness) &&
    Boolean(user) &&
    !hasCompletedOnboarding(user!.id) &&
    !onboardingDismissed;

  const links = [
    { to: '/practice', label: 'Practice', icon: BookOpen },
    { to: '/syllabus', label: 'Syllabus', icon: FolderTree },
    ...(settings.flag_e3_revision_cards ? [{ to: '/revision-notes', label: 'Formula Sheets', icon: FileSpreadsheet }] : []),
    { to: '/practice/shortcut-retry', label: 'Try Shortcuts', icon: Zap },
    { to: '/exams', label: 'Exams', icon: FileText },
    { to: '/mistakes', label: 'Mistake Notebook', icon: RotateCcw },
    { to: '/results', label: 'Results', icon: BarChart3 },
    { to: '/results/download', label: 'My Downloads', icon: Download },
    { to: '/help', label: 'Help', icon: HelpCircle },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline Status */}
      {isOffline && <OfflineBanner />}

      {/* Onboarding Tour */}
      {shouldShowOnboarding && (
        <OnboardingModal
          userId={user!.id}
          role="student"
          onComplete={() => setOnboardingDismissed(true)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-blue-700 focus:font-bold focus:shadow-md focus:rounded-md focus:outline-blue-600"
      >
        Skip to main content
      </a>

      {/* Archive Mode Banner */}
      <ArchiveBanner role="student" />

      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <Link to="/practice" className="font-bold text-lg text-blue-700">JEE Practice Hub</Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 hidden sm:block">{user?.name}</span>
              <ThemeToggle />
              <button
                onClick={() => setShowShortcuts(true)}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Keyboard Shortcuts (?)"
                aria-label="Keyboard shortcuts"
              >
                <Keyboard size={18} />
              </button>
              <Link
                to="/help"
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Help & Guidelines"
                aria-label="Help and guidelines"
              >
                <HelpCircle size={18} />
              </Link>
              <button onClick={logout} className="text-gray-400 hover:text-gray-600 p-1" title="Log out" aria-label="Log out">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Bottom nav on mobile, side links on desktop */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav aria-label="Student Navigation" className="flex gap-2 mb-4 overflow-x-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                location.pathname === to || (to !== '/practice' && location.pathname.startsWith(to))
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <main id="main-content" role="main" tabIndex={-1} className="outline-none">
          <Outlet />
        </main>
      </div>
      {user?.role === 'student' && (
        <InstallBanner completedPracticesCount={getAttempts().filter(a => a.student_id === user.id && a.mode === 'practice' && a.ended_at !== null).length} />
      )}
    </div>
  );
}

export function MonitorLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingStudents().length);

  useEffect(() => {
    const updatePending = () => setPendingCount(getPendingStudents().length);
    window.addEventListener('storage', updatePending);
    window.addEventListener('active-student-changed', updatePending);
    return () => {
      window.removeEventListener('storage', updatePending);
      window.removeEventListener('active-student-changed', updatePending);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (user) {
      const s = getSettings();
      if (s.flag_e9_performance_and_visual_polish) {
        applyThemePreferences(getUserPreferences(user.id), location.pathname);
      }
    }
  }, [user, location.pathname]);

  const settings = getSettings();
  const shouldShowOnboarding =
    Boolean(settings.flag_e10_ux_completeness) &&
    Boolean(user) &&
    !hasCompletedOnboarding(user!.id) &&
    !onboardingDismissed;

  const links = [
    { to: '/monitor', exact: true, label: 'Dashboard', icon: BarChart3 },
    { to: '/monitor/requests', label: 'Requests', icon: UserCheck, badge: pendingCount > 0 ? pendingCount : undefined },
    { to: '/monitor/students', label: 'Students', icon: Users },
    { to: '/monitor/analytics', label: 'Analytics & Trajectory', icon: TrendingUp },
    { to: '/monitor/targets', label: 'Targets', icon: Target },
    { to: '/monitor/percentile-maps', label: 'Shift Maps', icon: Map },
    { to: '/monitor/weightages', label: 'Weightages', icon: Sliders },
    { to: '/monitor/assignments', label: 'Assignments', icon: CheckSquare },
    { to: '/monitor/alerts', label: 'Alerts', icon: Bell },
    { to: '/monitor/outcomes-and-calibration', label: 'After Exam', icon: Award },
    { to: '/monitor/resource-links', label: 'Resource Links', icon: Link2 },
    { to: '/monitor/syllabus', label: 'Syllabus', icon: FolderTree },
    { to: '/monitor/questions', label: 'Questions', icon: List },
    { to: '/monitor/import', label: 'Import', icon: Upload },
    { to: '/monitor/review', label: 'Review Queue', icon: AlertCircle },
    { to: '/monitor/patterns', label: 'Patterns', icon: Sliders },
    { to: '/monitor/papers', label: 'Papers', icon: FileText },
    { to: '/monitor/exams', label: 'Exams', icon: FileText },
    { to: '/monitor/system-status', label: 'System Status', icon: Activity },
    { to: '/monitor/feature-flags', label: 'Feature Flags', icon: Layers },
    { to: '/monitor/content-health', label: 'Content Health', icon: HeartPulse },
    { to: '/monitor/export', label: 'Export', icon: FileSpreadsheet },
    { to: '/monitor/help', label: 'Help & Rules', icon: HelpCircle },
    { to: '/monitor/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline Status */}
      {isOffline && <OfflineBanner />}

      {/* Onboarding Tour */}
      {shouldShowOnboarding && (
        <OnboardingModal
          userId={user!.id}
          role="monitor"
          onComplete={() => setOnboardingDismissed(true)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-indigo-700 focus:font-bold focus:shadow-md focus:rounded-md focus:outline-indigo-600"
      >
        Skip to main content
      </a>

      {/* Archive Mode Banner */}
      <ArchiveBanner role="monitor" />

      <header className="bg-indigo-700 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <Link to="/monitor" className="font-bold text-lg">JEE Practice Hub — Monitor</Link>
            <div className="flex items-center gap-3">
              <StudentSelector />
              <span className="text-sm text-indigo-200 hidden sm:block">{user?.name}</span>
              <ThemeToggle />
              <button
                onClick={() => setShowShortcuts(true)}
                className="text-indigo-200 hover:text-white p-1"
                title="Keyboard Shortcuts (?)"
                aria-label="Keyboard shortcuts"
              >
                <Keyboard size={18} />
              </button>
              <Link
                to="/monitor/help"
                className="text-indigo-200 hover:text-white p-1"
                title="Help & Rules"
                aria-label="Help and rules"
              >
                <HelpCircle size={18} />
              </Link>
              <button onClick={logout} className="text-indigo-200 hover:text-white p-1" title="Log out" aria-label="Log out">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav aria-label="Monitor Navigation" className="flex flex-wrap gap-1 mb-4 overflow-x-auto">
          {links.map(({ to, exact, label, icon: Icon, badge }: any) => {
            const active = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                {label}
                {badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <main id="main-content" role="main" tabIndex={-1} className="outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

