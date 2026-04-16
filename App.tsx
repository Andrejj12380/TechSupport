import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ClientManager from './components/ClientManager';
import Login from './components/Login';
import UserManager from './components/UserManager';
import KnowledgeBase from './components/KnowledgeBase';
import SupportTicketManager from './components/SupportTicketManager';
import PpmCalculator from './components/PpmCalculator';
import UserAvatar from './components/UserAvatar';
import { ToastProvider } from './components/Toast';
import { IconDashboard, IconUsers, IconSearch, IconLogs, IconBook, IconUserSettings } from './components/Icons';
import { MessageSquare, Moon, Sun, Menu, X, ChevronRight, Calculator, Workflow, Command, BarChart3 } from 'lucide-react';
import { AuditLog, User } from './types';
import { api } from './services/api';
import CommandPalette from './components/CommandPalette';
import PostImplementationAnalytics from './components/PostImplementationAnalytics';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'logs' | 'search' | 'kb' | 'users' | 'tickets' | 'ppm-calculator' | 'post-implementation-analytics'>('dashboard');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [routeVersion, setRouteVersion] = useState(0);

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', String(newState));
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsAuthChecking(false);
      }
    };

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }

    // Initialize active tab from URL path or hash
    const getTabFromLocation = () => {
      // Prefer pathname (e.g., /clients), fallback to hash (#clients)
      const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const hash = (window.location.hash || '').replace(/^#/, '');
      const src = path || hash || 'dashboard';
      switch (src.split('?')[0]) {
        case 'clients': return 'clients';
        case 'kb': return 'kb';
        case 'tickets': return 'tickets';
        case 'users': return 'users';
        case 'logs': return 'logs';
        case 'search': return 'search';
        case 'ppm-calculator': return 'ppm-calculator';
        case 'post-implementation-analytics': return 'post-implementation-analytics';
        default: return 'dashboard';
      }
    };

    const initTab = getTabFromLocation();
    if (initTab === 'logs' && user && user.role !== 'admin') {
      setActiveTab('dashboard');
    } else {
      setActiveTab(initTab);
    }

    // If pathname is /search and q param exists, set searchQuery and run search
    if (window.location.pathname.replace(/^\/+|\/+$/g, '') === 'search') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q') || '';
      if (q) {
        setSearchQuery(q);
        api.search(q).then(res => setSearchResults(res)).catch(() => { });
      }
    }

    // Listen to back/forward navigation
    const onPop = () => {
      const tab = getTabFromLocation();
      setActiveTab(tab);
      setRouteVersion(v => v + 1);
    };
    window.addEventListener('popstate', onPop);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'q' || e.key === 'й' || e.code === 'KeyQ')) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }

      // Alt+N for New Ticket (independent of layout)
      if (e.altKey && (e.key === 'n' || e.key === 'т' || e.code === 'KeyN')) {
        if (user && (user.role === 'admin' || user.role === 'engineer')) {
          e.preventDefault();
          handleNavigate('tickets', { newTicket: 'true' });
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    checkAuth();

    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Cleanup large state objects when not in use to save memory
  useEffect(() => {
    if (activeTab !== 'logs') {
      setLogs([]);
    }
    if (activeTab !== 'search') {
      setSearchResults([]);
      setSearchQuery('');
    }
  }, [activeTab]);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  const toggleTheme = () => {
    // Suppress all CSS transitions during theme switch to prevent jank
    document.documentElement.classList.add('theme-switching');
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    // Re-enable transitions after the browser has painted the new theme
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-switching');
      });
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const results = await api.search(searchQuery);
    setSearchResults(results);
    // Update URL to /search?q=... so refresh keeps us here
    const url = `/search?q=${encodeURIComponent(searchQuery)}`;
    window.history.pushState({ tab: 'search' }, '', url);
    setActiveTab('search');
  };

  const handleNavigate = (tab: any, params: Record<string, string> = {}) => {
    const urlParams = new URLSearchParams(params);
    const queryString = urlParams.toString();
    const url = `/${tab}${queryString ? '?' + queryString : ''}`;

    window.history.pushState({ tab }, '', url);
    setActiveTab(tab);
    setRouteVersion(v => v + 1);
    setIsMobileMenuOpen(false);
  };

  const handleSearchNavigate = (result: any) => {
    // Navigate to clients tab - the ClientManager will use URL params to auto-select
    if (result.type === 'Клиент') {
      handleNavigate('clients', { client: result.id.toString() });
    } else if (result.type === 'Линия') {
      handleNavigate('clients', {
        client: result.raw.client_id.toString(),
        site: result.raw.site_id.toString(),
        line: result.id.toString()
      });
    } else if (result.type === 'Контакт' && result.raw) {
      handleNavigate('clients', {
        client: result.raw.client_id.toString(),
        site: result.raw.site_id.toString()
      });
    } else if (result.type === 'Оборудование' && result.raw) {
      handleNavigate('clients', {
        line: result.raw.line_id.toString(),
        equipment: result.id.toString()
      });
    } else if (result.type === 'Контакт') {
      handleNavigate('clients', {
        client: result.raw.client_id.toString(),
        site: result.raw.site_id.toString()
      });
    } else {
      handleNavigate('clients');
    }
  };

  const loadLogs = async () => {
    setLogs(await api.getLogs());
    setActiveTab('logs');
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-transparent flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5B00]"></div>
      </div>
    );
  }

  if (!user) {
    return <ToastProvider><Login onLoginSuccess={() => api.getCurrentUser().then(setUser)} /></ToastProvider>;
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-transparent relative p-0 sm:p-2 md:p-4 gap-0 sm:gap-2 md:gap-4" style={{ maxWidth: '100vw', width: '100%' }}>
        {/* Mobile Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
        fixed md:static inset-y-4 md:inset-y-0 left-4 md:left-0 h-[calc(100vh-2rem)] md:h-full 
        ${isSidebarCollapsed ? 'w-20' : 'w-64'} 
        bg-black/5 dark:bg-slate-900/40 glass-surface rounded-3xl border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-300 flex flex-col z-50 
        transition-all duration-300 ease-in-out md:translate-x-0 shadow-2xl backdrop-blur-3xl
        ${isMobileMenuOpen ? 'translate-x-0 visible' : '-translate-x-[120%] invisible md:visible'}
      `}>
          <div className="p-6 flex items-center relative">
            <div className="w-10 h-10 bg-[#FF5B00] rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-[#FF5B00]/40 text-lg shrink-0 border border-white/20">TS</div>
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-xl font-bold text-slate-900 dark:text-white tracking-tight ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
              Support <span className="text-[#FF5B00]">Motrum</span>
            </span>

            {/* Toggle Sidebar Button (Desktop only, floating overlay) */}
            <button
              onClick={toggleSidebar}
              className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full items-center justify-center text-slate-500 dark:text-slate-400 hover:text-white dark:hover:text-white hover:bg-[#FF5B00] dark:hover:bg-[#FF5B00] transition-all shadow-md z-50"
              title={isSidebarCollapsed ? "Развернуть" : "Свернуть"}
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} />
            </button>
          </div>

          <nav className="flex-1 mt-6 px-4 space-y-1">
            <button
              onClick={() => {
                window.history.pushState({ tab: 'dashboard' }, '', '/');
                setActiveTab('dashboard');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all relative group ${activeTab === 'dashboard' ? 'bg-white/10 text-white font-bold shadow-inner border border-white/10' : 'text-white/50 hover:bg-white/5 hover:text-white text-medium border border-transparent'}`}
            >
              <IconDashboard className={`w-5 h-5 shrink-0 ${activeTab === 'dashboard' ? 'text-[#FF5B00]' : ''}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                Дашборд
              </span>
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-white/95 dark:bg-slate-800 backdrop-blur-sm text-slate-800 dark:text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-200 dark:border-slate-700 shadow-xl">
                  Дашборд
                </div>
              )}
            </button>
            <button
              onClick={() => {
                window.history.pushState({ tab: 'clients' }, '', '/clients');
                setActiveTab('clients');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all relative group ${activeTab === 'clients' ? 'bg-white/10 text-white font-bold shadow-inner border border-white/10' : 'text-white/50 hover:bg-white/5 hover:text-white text-medium border border-transparent'}`}
            >
              <IconUsers className={`w-5 h-5 shrink-0 ${activeTab === 'clients' ? 'text-[#FF5B00]' : ''}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                Клиенты и Объекты
              </span>
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-white/95 dark:bg-slate-800 backdrop-blur-sm text-slate-800 dark:text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-200 dark:border-slate-700 shadow-xl">
                  Клиенты и Объекты
                </div>
              )}
            </button>
            <button
              onClick={() => {
                window.history.pushState({ tab: 'kb' }, '', '/kb');
                setActiveTab('kb');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-4 py-3 rounded-lg transition-all relative group ${activeTab === 'kb' ? 'bg-white/10 text-white font-bold shadow-inner border border-white/10' : 'text-white/50 hover:bg-white/5 hover:text-white text-medium border border-transparent'}`}
            >
              <IconBook className={`w-5 h-5 shrink-0 ${activeTab === 'kb' ? 'text-[#FF5B00]' : ''}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                База Знаний
              </span>
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-white/95 dark:bg-slate-800 backdrop-blur-sm text-slate-800 dark:text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-200 dark:border-slate-700 shadow-xl">
                  База Знаний
                </div>
              )}
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => {
                  loadLogs();
                  window.history.pushState({ tab: 'logs' }, '', '/logs');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-lg transition-all relative group ${activeTab === 'logs' ? 'bg-white/10 text-white font-bold shadow-inner border border-white/10' : 'text-white/50 hover:bg-white/5 hover:text-white text-medium border border-transparent'}`}
              >
                <IconLogs className={`w-5 h-5 shrink-0 ${activeTab === 'logs' ? 'text-[#FF5B00]' : ''}`} />
                <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                  Журнал действий
                </span>
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-white/95 dark:bg-slate-800 backdrop-blur-sm text-slate-800 dark:text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-200 dark:border-slate-700 shadow-xl">
                    Журнал действий
                  </div>
                )}
              </button>
            )}
            <button
              onClick={() => {
                window.history.pushState({ tab: 'tickets' }, '', '/tickets');
                setActiveTab('tickets');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-4 py-3 rounded-lg transition-all relative group ${activeTab === 'tickets' ? 'bg-white/10 text-white font-bold shadow-inner border border-white/10' : 'text-white/50 hover:bg-white/5 hover:text-white text-medium border border-transparent'}`}
            >
              <MessageSquare className={`w-5 h-5 shrink-0 ${activeTab === 'tickets' ? 'text-[#FF5B00]' : ''}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                Журнал обращений
              </span>
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-white/95 dark:bg-slate-800 backdrop-blur-sm text-slate-800 dark:text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-200 dark:border-slate-700 shadow-xl">
                  Журнал обращений
                </div>
              )}
            </button>
            {(user.role === 'admin' || user.role === 'engineer') && (
              <button
                onClick={() => {
                  window.history.pushState({ tab: 'ppm-calculator' }, '', '/ppm-calculator');
                  setActiveTab('ppm-calculator');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-lg transition-all relative group ${activeTab === 'ppm-calculator' ? 'bg-white/10 text-white font-bold shadow-inner border border-white/10' : 'text-white/50 hover:bg-white/5 hover:text-white text-medium border border-transparent'}`}
              >
                <Calculator className={`w-5 h-5 shrink-0 ${activeTab === 'ppm-calculator' ? 'text-[#FF5B00]' : ''}`} />
                <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                  PPM Калькулятор
                </span>
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-white/95 dark:bg-slate-800 backdrop-blur-sm text-slate-800 dark:text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-200 dark:border-slate-700 shadow-xl">
                    PPM Калькулятор
                  </div>
                )}
              </button>
            )}
            {user.role === 'admin' && (
              <button
                onClick={() => {
                  window.history.pushState({ tab: 'users' }, '', '/users');
                  setActiveTab('users');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-lg transition-all relative group ${activeTab === 'users' ? 'bg-white/10 text-white font-bold shadow-inner border border-white/10' : 'text-white/50 hover:bg-white/5 hover:text-white text-medium border border-transparent'}`}
              >
                <IconUserSettings className={`w-5 h-5 shrink-0 ${activeTab === 'users' ? 'text-[#FF5B00]' : ''}`} />
                <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                  Пользователи
                </span>
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-white/95 dark:bg-slate-800 backdrop-blur-sm text-slate-800 dark:text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-200 dark:border-slate-700 shadow-xl">
                    Пользователи
                  </div>
                )}
              </button>
            )}
            <button
              onClick={() => {
                window.history.pushState({ tab: 'post-implementation-analytics' }, '', '/post-implementation-analytics');
                setActiveTab('post-implementation-analytics');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-4 py-3 rounded-lg transition-all relative group ${activeTab === 'post-implementation-analytics' ? 'bg-white/10 text-white font-bold shadow-inner border border-white/10' : 'text-white/50 hover:bg-white/5 hover:text-white text-medium border border-transparent'}`}
            >
              <BarChart3 className={`w-5 h-5 shrink-0 ${activeTab === 'post-implementation-analytics' ? 'text-[#FF5B00]' : ''}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                Аналитика за период
              </span>
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-white/95 dark:bg-slate-800 backdrop-blur-sm text-slate-800 dark:text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-200 dark:border-slate-700 shadow-xl">
                  Аналитика за период
                </div>
              )}
            </button>
          </nav>

          <div className="mt-auto p-4 border-t border-white/20 dark:border-slate-800/50 space-y-4">
            {/* User Block (Toggle + Info + Avatar) */}
            <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-4' : 'items-center justify-between gap-2'} px-2 overflow-hidden min-h-[48px] transition-all duration-300`}>
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-white/40 dark:bg-slate-800 hover:bg-white/60 dark:hover:bg-slate-700 transition-colors shrink-0 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none"
                title={isDarkMode ? 'Светлая тема' : 'Темная тема'}
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-600" />}
              </button>

              {/* User Info (Smooth collapse) */}
              <div className={`flex-1 transition-all duration-300 overflow-hidden whitespace-nowrap flex flex-col ${isSidebarCollapsed ? 'max-w-0 opacity-0 h-0' : 'max-w-[200px] opacity-100'}`}>
                <div className="text-sm font-bold text-slate-800 dark:text-white truncate px-1">{user.username}</div>
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Роль: {user.role}</div>
              </div>

              {/* Avatar */}
              <div className={`shrink-0 transition-transform duration-300 ${isSidebarCollapsed ? 'scale-90' : ''}`}>
                <UserAvatar username={user.username} size="md" />
              </div>
            </div>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center px-4 py-2 rounded-lg text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-all text-sm font-medium`}
              title={isSidebarCollapsed ? "Выход" : ""}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                Выход
              </span>
            </button>

          </div>
        </aside>

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          <header className="h-auto py-2 bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 flex items-center gap-2 md:gap-4 px-3 md:px-6 sticky top-0 z-10 transition-colors glass-surface rounded-none sm:rounded-3xl m-0 sm:m-2 shadow-sm">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-1 sm:-ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors"
            >
              <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>

            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex-1 max-w-lg md:ml-4 flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-2.5 glass-surface border-none text-white/50 hover:text-white transition-all group rounded-full sm:rounded-[2rem]"
            >
              <IconSearch className="w-4 h-4 text-white/40 group-hover:text-[#FF5B00] transition-colors" />
              <span className="text-sm font-medium flex-1 text-left">Поиск...</span>
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded-lg shadow-sm border border-white/10">
                <Command className="w-3 h-3 text-white/50" />
                <span className="text-[10px] font-black text-white/50">Q</span>
              </div>
            </button>

            <div className="flex items-center gap-4 ml-4">
              {/* Header is now clean - only search and maybe some global actions here if needed */}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 overflow-x-hidden">
            <div key={`${activeTab}-${routeVersion}`} className="animate-fadeIn">
              {activeTab === 'dashboard' && <Dashboard onNavigate={(tab) => setActiveTab(tab)} />}
              {activeTab === 'clients' && <ClientManager user={user} />}
              {activeTab === 'kb' && <KnowledgeBase user={user} />}
              {activeTab === 'tickets' && <SupportTicketManager user={user} />}
              {activeTab === 'ppm-calculator' && (user.role === 'admin' || user.role === 'engineer') && <PpmCalculator />}
              {activeTab === 'users' && user.role === 'admin' && <UserManager currentUser={user} />}
              {activeTab === 'post-implementation-analytics' && <PostImplementationAnalytics onBack={() => handleNavigate('dashboard')} />}
              {activeTab === 'logs' && user.role === 'admin' && (
                <div className="space-y-4">
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Логи аудита</h1>
                  <div className="rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden glass-surface">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                        <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">
                          <th className="px-6 py-4">Дата/Время</th>
                          <th className="px-6 py-4">Пользователь</th>
                          <th className="px-6 py-4">Действие</th>
                          <th className="px-6 py-4">Сущность</th>
                          <th className="px-6 py-4">Детали</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {logs.map(log => (
                          <tr key={log.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{log.timestamp}</td>
                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{log.user}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${log.action === 'CREATE' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-900/20 text-[#FF5B00]'
                                } `}>{log.action}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{log.entity}</td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeTab === 'search' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 italic uppercase">Результаты поиска</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Найдено для запроса: <span className="text-[#FF5B00] font-bold">"{searchQuery}"</span></p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchResults.length > 0 ? searchResults.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => handleSearchNavigate(res)}
                        className="group p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700 hover:border-[#FF5B00]/40 hover:shadow-2xl shadow-slate-200/50 dark:shadow-none transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden active:scale-95 glass-card glass-card-hover"
                      >
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${res.type === 'Клиент' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' :
                              res.type === 'Линия' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' :
                                res.type === 'Контакт' ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-600' :
                                  'bg-amber-50 dark:bg-amber-900/30 text-amber-600'
                              }`}>
                              {res.type === 'Линия' && <Workflow className="w-3 h-3" />}
                              {res.type}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronRight className="w-4 h-4 text-[#FF5B00]" />
                            </div>
                          </div>
                          <p className="text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-[#FF5B00] transition-colors line-clamp-2">{res.name}</p>
                          {res.raw?.address && (
                            <p className="text-xs text-slate-400 mt-2 line-clamp-1 font-medium italic">{res.raw.address}</p>
                          )}
                        </div>
                        {/* Decorative background element */}
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#FF5B00]/5 rounded-full blur-2xl group-hover:bg-[#FF5B00]/10 transition-colors" />
                      </div>
                    )) : (
                      <div className="col-span-full py-24 text-center">
                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 opacity-40">
                          <IconSearch className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="text-xl font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Ничего не найдено</p>
                        <p className="text-slate-400 dark:text-slate-500 mt-2">Попробуйте изменить параметры поиска</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigate={handleNavigate}
        />
      </div>
    </ToastProvider>
  );
};

export default App;
