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
import { MessageSquare, Moon, Sun, Menu, X, ChevronRight, Calculator, Workflow } from 'lucide-react';
import { AuditLog, User } from './types';
import { api } from './services/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'logs' | 'search' | 'kb' | 'users' | 'tickets' | 'ppm-calculator'>('dashboard');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem('search_history') || '[]'));


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
    };
    checkAuth();

    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', handleGlobalKey);
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
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Add to history
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('search_history', JSON.stringify(newHistory));

    const results = await api.search(searchQuery);
    setSearchResults(results);
    
    setIsSearchModalOpen(false);
    
    // Update URL to /search?q=... so refresh keeps us here
    const url = `/search?q=${encodeURIComponent(searchQuery)}`;
    window.history.pushState({ tab: 'search' }, '', url);
    setActiveTab('search');
  };

  const handleSearchNavigate = (result: any) => {
    // Navigate to clients tab - the ClientManager will use URL params to auto-select
    if (result.type === 'Клиент') {
      window.history.pushState({ tab: 'clients' }, '', `/clients?client=${result.id}`);
      setActiveTab('clients');
    } else if (result.type === 'Линия') {
      window.history.pushState({ tab: 'clients' }, '', `/clients?client=${result.raw.client_id}&site=${result.raw.site_id}&line=${result.id}`);
      setActiveTab('clients');
    } else if (result.type === 'Контакт' && result.raw) {
      const r = result.raw;
      window.history.pushState({ tab: 'clients' }, '', `/clients?client=${r.client_id}&site=${r.site_id}`);
      setActiveTab('clients');
    } else if (result.type === 'Оборудование' && result.raw) {
      // For equipment, navigate with client, site, line, and equipment IDs from raw data
      const e = result.raw;
      const params = new URLSearchParams();
      if (e.line_id) params.set('line', e.line_id);
      if (e.id) params.set('equipment', e.id);
      window.history.pushState({ tab: 'clients' }, '', `/clients?${params.toString()}`);
      setActiveTab('clients');
    } else if (result.type === 'Контакт') {
      window.history.pushState({ tab: 'clients' }, '', `/clients?client=${result.raw.client_id}&site=${result.raw.site_id}`);
      setActiveTab('clients');
    } else {
      // Fallback: just go to clients
      setActiveTab('clients');
    }
  };

  const loadLogs = async () => {
    setLogs(await api.getLogs());
    setActiveTab('logs');
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[primary]"></div>
      </div>
    );
  }

  if (!user) {
    return <ToastProvider><Login onLoginSuccess={() => api.getCurrentUser().then(setUser)} /></ToastProvider>;
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 relative">
        {/* Mobile Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
        fixed md:static inset-y-0 left-0 ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-slate-900 border-r border-slate-800 text-slate-400 flex flex-col z-50 
        transition-all duration-300 ease-in-out md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
          <div className="p-6 pb-2 flex items-center relative overflow-hidden">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center font-black text-white shadow-lg shadow-primary/20 text-lg shrink-0 z-10">TS</div>
            <span className={`transition-all duration-500 overflow-hidden whitespace-nowrap text-xl font-display font-black text-white tracking-tight z-10 ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
              Support Про
            </span>

            {/* Subtle glow effect */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

            {/* Toggle Sidebar Button (Desktop only, floating overlay) */}
            <button
              onClick={toggleSidebar}
              className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full items-center justify-center text-slate-400 hover:text-white hover:bg-primary transition-all shadow-md z-50"
              title={isSidebarCollapsed ? "Развернуть" : "Свернуть"}
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-500 ${isSidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} />
            </button>
          </div>

          <nav className="flex-1 mt-8 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
            <button
              onClick={() => {
                window.history.pushState({ tab: 'dashboard' }, '', '/');
                setActiveTab('dashboard');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-4 py-3 rounded-[14px] transition-all relative group ${activeTab === 'dashboard' ? 'bg-primary text-white font-bold shadow-lg shadow-primary/20' : 'hover:bg-slate-800/80 hover:text-slate-100'}`}
            >
              <IconDashboard className={`w-5 h-5 shrink-0 ${activeTab === 'dashboard' ? 'text-white' : 'group-hover:text-primary transition-colors'}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                Дашборд
              </span>
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-700 shadow-xl">
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
              className={`w-full flex items-center px-4 py-3 rounded-[14px] transition-all relative group ${activeTab === 'clients' ? 'bg-primary text-white font-bold shadow-lg shadow-primary/20' : 'hover:bg-slate-800/80 hover:text-slate-100'}`}
            >
              <IconUsers className={`w-5 h-5 shrink-0 ${activeTab === 'clients' ? 'text-white' : 'group-hover:text-primary transition-colors'}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                Клиенты и Объекты
              </span>
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-700 shadow-xl">
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
              className={`w-full flex items-center px-4 py-3 rounded-[14px] transition-all relative group ${activeTab === 'kb' ? 'bg-primary text-white font-bold shadow-lg shadow-primary/20' : 'hover:bg-slate-800/80 hover:text-slate-100'}`}
            >
              <IconBook className={`w-5 h-5 shrink-0 ${activeTab === 'kb' ? 'text-white' : 'group-hover:text-primary transition-colors'}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                База Знаний
              </span>
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-700 shadow-xl">
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
                className={`w-full flex items-center px-4 py-3 rounded-[14px] transition-all relative group ${activeTab === 'logs' ? 'bg-primary text-white font-bold shadow-lg shadow-primary/20' : 'hover:bg-slate-800/80 hover:text-slate-100'}`}
              >
                <IconLogs className={`w-5 h-5 shrink-0 ${activeTab === 'logs' ? 'text-white' : 'group-hover:text-primary transition-colors'}`} />
                <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                  Журнал действий
                </span>
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-700 shadow-xl">
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
              className={`w-full flex items-center px-4 py-3 rounded-[14px] transition-all relative group ${activeTab === 'tickets' ? 'bg-primary text-white font-bold shadow-lg shadow-primary/20' : 'hover:bg-slate-800/80 hover:text-slate-100'}`}
            >
              <MessageSquare className={`w-5 h-5 shrink-0 ${activeTab === 'tickets' ? 'text-white' : 'group-hover:text-primary transition-colors'}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                Журнал обращений
              </span>
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-700 shadow-xl">
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
                className={`w-full flex items-center px-4 py-3 rounded-[14px] transition-all relative group ${activeTab === 'ppm-calculator' ? 'bg-primary text-white font-bold shadow-lg shadow-primary/20' : 'hover:bg-slate-800/80 hover:text-slate-100'}`}
              >
                <Calculator className={`w-5 h-5 shrink-0 ${activeTab === 'ppm-calculator' ? 'text-white' : 'group-hover:text-primary transition-colors'}`} />
                <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                  PPM Калькулятор
                </span>
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-700 shadow-xl">
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
                className={`w-full flex items-center px-4 py-3 rounded-[14px] transition-all relative group ${activeTab === 'users' ? 'bg-primary text-white font-bold shadow-lg shadow-primary/20' : 'hover:bg-slate-800/80 hover:text-slate-100'}`}
              >
                <IconUserSettings className={`w-5 h-5 shrink-0 ${activeTab === 'users' ? 'text-white' : 'group-hover:text-primary transition-colors'}`} />
                <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                  Пользователи
                </span>
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] border border-slate-700 shadow-xl">
                    Пользователи
                  </div>
                )}
              </button>
            )}
          </nav>

          <div className="mt-auto p-4 border-t border-slate-800 space-y-4">
            {/* User Block (Toggle + Info + Avatar) */}
            <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-4' : 'items-center justify-between gap-2'} px-2 overflow-hidden min-h-[48px] transition-all duration-300`}>
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors shrink-0 border border-slate-700/50"
                title={isDarkMode ? 'Светлая тема' : 'Темная тема'}
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-400" />}
              </button>

              {/* User Info (Smooth collapse) */}
              <div className={`flex-1 transition-all duration-300 overflow-hidden whitespace-nowrap flex flex-col ${isSidebarCollapsed ? 'max-w-0 opacity-0 h-0' : 'max-w-[200px] opacity-100'}`}>
                <div className="text-sm font-bold text-white truncate px-1">{user.username}</div>
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
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 px-6 md:px-10 sticky top-0 z-40 transition-colors">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors"
            >
              <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>

            <div 
              onClick={() => setIsSearchModalOpen(true)}
              className="flex-1 max-w-lg relative group cursor-pointer"
            >
              <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-11 pr-4 text-sm flex items-center justify-between text-slate-400 hover:border-primary/40 transition-all shadow-sm">
                <div className="flex items-center gap-2">
                  <IconSearch className="w-4 h-4" />
                  <span>Поиск...</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-[10px] font-bold text-slate-400 uppercase">Ctrl</kbd>
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-[10px] font-bold text-slate-400 uppercase">K</kbd>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <div className="hidden lg:flex flex-col items-right text-right mr-2">
                 <div className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">{user.username}</div>
                 <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{user.role}</div>
              </div>
              <UserAvatar username={user.username} size="md" />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6 overflow-x-hidden">
            <div key={activeTab} className="animate-fadeIn">
              {activeTab === 'dashboard' && <Dashboard onNavigate={(tab) => setActiveTab(tab)} />}
              {activeTab === 'clients' && <ClientManager user={user} />}
              {activeTab === 'kb' && <KnowledgeBase user={user} />}
              {activeTab === 'tickets' && <SupportTicketManager user={user} />}
              {activeTab === 'ppm-calculator' && (user.role === 'admin' || user.role === 'engineer') && <PpmCalculator />}
              {activeTab === 'users' && user.role === 'admin' && <UserManager currentUser={user} />}
              {activeTab === 'logs' && user.role === 'admin' && (
                <div className="space-y-4">
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Логи аудита</h1>
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
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
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${log.action === 'CREATE' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-900/20 text-[primary]'
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
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Найдено для запроса: <span className="text-[primary] font-bold">"{searchQuery}"</span></p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchResults.length > 0 ? searchResults.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => handleSearchNavigate(res)}
                        className="group bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700 hover:border-[primary]/40 hover:shadow-2xl shadow-slate-200/50 dark:shadow-none transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden active:scale-95"
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
                              <ChevronRight className="w-4 h-4 text-[primary]" />
                            </div>
                          </div>
                          <p className="text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-[primary] transition-colors line-clamp-2">{res.name}</p>
                          {res.raw?.address && (
                            <p className="text-xs text-slate-400 mt-2 line-clamp-1 font-medium italic">{res.raw.address}</p>
                          )}
                        </div>
                        {/* Decorative background element */}
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[primary]/5 rounded-full blur-2xl group-hover:bg-[primary]/10 transition-colors" />
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
        {/* Global Search Modal */}
        {isSearchModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsSearchModalOpen(false)}></div>
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative animate-in zoom-in duration-200">
              <div className="p-6 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-4">
                <IconSearch className="w-6 h-6 text-primary" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Что вы ищете? (Клиенты, IP, Серийные номера...)"
                  className="w-full bg-transparent border-none text-xl focus:ring-0 text-slate-900 dark:text-slate-100 placeholder-slate-400 font-display font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button 
                  onClick={() => setIsSearchModalOpen(false)}
                  className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ESC
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {searchHistory.length > 0 && !searchQuery && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Недавние поиски</h4>
                    <div className="space-y-1">
                      {searchHistory.map((h, i) => (
                        <button
                          key={i}
                          onClick={() => { setSearchQuery(h); setTimeout(handleSearch, 0); }}
                          className="w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium"
                        >
                          <svg className="w-4 h-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!searchQuery && (
                   <div className="py-12 text-center space-y-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <Calculator className="w-8 h-8 text-primary opacity-40 underline" />
                      </div>
                      <p className="text-slate-400 text-sm font-medium">Введите запрос или используйте стрелки для навигации</p>
                   </div>
                )}
              </div>
              
              <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t dark:border-slate-700 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border dark:border-slate-600 inline-block shadow-sm">Enter</kbd> искать</span>
                  <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border dark:border-slate-600 inline-block shadow-sm">Tab</kbd> переход</span>
                </div>
                <span>TechSupport Pro UX</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
};

export default App;
