import {
  BarChart3,
  BookOpen,
  Calculator,
  Cloud,
  CloudOff,
  FileSpreadsheet,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sun,
  TrendingUp,
} from 'lucide-react';
import type { CloudConnectionInfo } from '../types/marks';

export type ActiveTab = 'overview' | 'exams' | 'subjects' | 'predictor';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  examCount: number;
  cloud: CloudConnectionInfo;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenAddExam: () => void;
  onOpenCloud: () => void;
  onOpenSettings: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  examCount,
  cloud,
  theme,
  onToggleTheme,
  onOpenAddExam,
  onOpenCloud,
  onOpenSettings,
}: HeaderProps) {
  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof BarChart3;
    badge?: number;
  }> = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'exams', label: 'Exams', icon: FileSpreadsheet, badge: examCount },
    { id: 'subjects', label: 'Subjects & Matrix', icon: BookOpen },
    { id: 'predictor', label: 'Predictor', icon: Calculator },
  ];

  const renderCloudBadge = () => {
    let dotClass = 'bg-emerald-500';
    let pillStyle =
      'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
    let label =
      cloud.mode === 'account' && cloud.userEmail
        ? cloud.userEmail.split('@')[0]
        : cloud.vaultKey;
    let Icon = Cloud;

    if (cloud.status === 'syncing' || cloud.status === 'connecting') {
      dotClass = 'bg-indigo-500 animate-pulse';
      Icon = RefreshCw;
      label = cloud.status === 'connecting' ? 'Connecting...' : 'Syncing...';
    } else if (cloud.status === 'permission-denied') {
      dotClass = 'bg-amber-500';
      pillStyle =
        'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300';
      Icon = ShieldAlert;
      label = 'Cloud Setup';
    } else if (cloud.status === 'offline' || cloud.status === 'error') {
      dotClass = 'bg-rose-500';
      pillStyle =
        'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';
      Icon = CloudOff;
      label = cloud.status === 'offline' ? 'Offline (Saved)' : 'Sync Error';
    }

    return (
      <button
        type="button"
        onClick={onOpenCloud}
        title="Manage Cloud Sync & Anywhere Access"
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${pillStyle}`}
      >
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <Icon
          className={`h-3.5 w-3.5 ${
            cloud.status === 'syncing' ? 'animate-spin' : ''
          }`}
        />
        <span className="max-w-[120px] truncate font-mono-num">{label}</span>
      </button>
    );
  };

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                MarkPulse
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Personal Mark Analyser
              </p>
            </div>
          </div>

          {/* Desktop Tabs */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl bg-slate-100/90 p-1 dark:bg-slate-900">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                          : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {renderCloudBadge()}

            <button
              type="button"
              onClick={onOpenSettings}
              title="Target, Passing & Grading Settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenAddExam}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-500 active:scale-[0.99] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Exam</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <nav className="flex md:hidden items-center gap-1 overflow-x-auto pb-2.5 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-slate-800">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

