import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ClientManager from './components/ClientManager';
import Login from './components/Login';
import UserManager from './components/UserManager';
import KnowledgeBase from './components/KnowledgeBase';
import SupportTicketManager from './components/SupportTicketManager';
import UserAvatar from './components/UserAvatar';
import { IconDashboard, IconUsers, IconSearch, IconLogs, IconBook, IconUserSettings } from './components/Icons';
import { MessageSquare, Moon, Sun, Menu, X, ChevronRight } from 'lucide-react';
import { AuditLog, User } from './types';
import { api } from './services/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'logs' | 'search' | 'kb' | 'users' | 'tickets'>('dashboard');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');

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
        default: return 'dashboard';
      }
    };

    const initTab = getTabFromLocation();
    setActiveTab(initTab);

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
    window.addEventListener('popstate', onPop);

    checkAuth();

    return () => window.removeEventListener('popstate', onPop);
  }, []);

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

  const handleSearchNavigate = (result: any) => {
    // Navigate to clients tab - the ClientManager will use URL params to auto-select
    if (result.type === 'Клиент') {
      window.history.pushState({ tab: 'clients' }, '', `/clients?client=${result.id}`);
      setActiveTab('clients');
    } else if (result.type === 'Линия') {
      window.history.pushState({ tab: 'clients' }, '', `/clients?client=${result.raw.client_id}&site=${result.raw.site_id}&line=${result.id}`);
      setActiveTab('clients');
    } else if (result.type === 'Оборудование' && result.raw) {
      // For equipment, navigate with client, site, line, and equipment IDs from raw data
      const e = result.raw;
      const params = new URLSearchParams();
      if (e.line_id) params.set('line', e.line_id);
      if (e.id) params.set('equipment', e.id);
      window.history.pushState({ tab: 'clients' }, '', `/clients?${params.toString()}`);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5B00]"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => api.getCurrentUser().then(setUser)} />;
  }

  return (
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
        fixed md:static inset-y-0 left-0 ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 dark:bg-slate-800 text-slate-300 flex flex-col z-50 
        transition-all duration-300 ease-in-out md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center relative">
          <div className="w-10 h-10 bg-[#FF5B00] rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-[#FF5B00]/20 text-lg shrink-0">TS</div>
          <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-xl font-bold text-white tracking-tight ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
            Support <span className="text-[#FF5B00]">Motrum</span>
          </span>

          {/* Toggle Sidebar Button (Desktop only, floating overlay) */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800 dark:bg-slate-700 border border-slate-700 dark:border-slate-600 rounded-full items-center justify-center text-slate-400 hover:text-white hover:bg-[#FF5B00] transition-all shadow-md z-50"
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
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-800/50'}`}
            title={isSidebarCollapsed ? "Дашборд" : ""}
          >
            <IconDashboard className={`w-5 h-5 shrink-0 ${activeTab === 'dashboard' ? 'text-[#FF5B00]' : ''}`} />
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
              Дашборд
            </span>
          </button>
          <button
            onClick={() => {
              window.history.pushState({ tab: 'clients' }, '', '/clients');
              setActiveTab('clients');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${activeTab === 'clients' ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-800/50'}`}
            title={isSidebarCollapsed ? "Клиенты и Объекты" : ""}
          >
            <IconUsers className={`w-5 h-5 shrink-0 ${activeTab === 'clients' ? 'text-[#FF5B00]' : ''}`} />
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
              Клиенты и Объекты
            </span>
          </button>
          <button
            onClick={() => {
              window.history.pushState({ tab: 'kb' }, '', '/kb');
              setActiveTab('kb');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${activeTab === 'kb' ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-800/50'}`}
            title={isSidebarCollapsed ? "База Знаний" : ""}
          >
            <IconBook className={`w-5 h-5 shrink-0 ${activeTab === 'kb' ? 'text-[#FF5B00]' : ''}`} />
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
              База Знаний
            </span>
          </button>
          <button
            onClick={() => {
              loadLogs();
              window.history.pushState({ tab: 'logs' }, '', '/logs');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${activeTab === 'logs' ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-800/50'}`}
            title={isSidebarCollapsed ? "Журнал действий" : ""}
          >
            <IconLogs className={`w-5 h-5 shrink-0 ${activeTab === 'logs' ? 'text-[#FF5B00]' : ''}`} />
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
              Журнал действий
            </span>
          </button>
          <button
            onClick={() => {
              window.history.pushState({ tab: 'tickets' }, '', '/tickets');
              setActiveTab('tickets');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${activeTab === 'tickets' ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-800/50'}`}
            title={isSidebarCollapsed ? "Журнал обращений" : ""}
          >
            <MessageSquare className={`w-5 h-5 shrink-0 ${activeTab === 'tickets' ? 'text-[#FF5B00]' : ''}`} />
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
              Журнал обращений
            </span>
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => {
                window.history.pushState({ tab: 'users' }, '', '/users');
                setActiveTab('users');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${activeTab === 'users' ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-800/50'}`}
              title={isSidebarCollapsed ? "Пользователи" : ""}
            >
              <IconUserSettings className={`w-5 h-5 shrink-0 ${activeTab === 'users' ? 'text-[#FF5B00]' : ''}`} />
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                Пользователи
              </span>
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
        <header className="h-16 bg-white dark:bg-[#18181b] border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 px-4 md:px-6 sticky top-0 z-10 transition-colors">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors"
          >
            <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>

          <form onSubmit={handleSearch} className="flex-1 max-w-lg relative group">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#FF5B00] transition-colors" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-slate-900 dark:text-slate-100"
            />
          </form>

          <div className="flex items-center gap-4 ml-4">
            {/* Header is now clean - only search and maybe some global actions here if needed */}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && <Dashboard onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'clients' && <ClientManager user={user} />}
          {activeTab === 'kb' && <KnowledgeBase user={user} />}
          {activeTab === 'tickets' && <SupportTicketManager user={user} />}
          {activeTab === 'users' && user.role === 'admin' && <UserManager currentUser={user} />}
          {activeTab === 'logs' && (
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
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Результаты поиска: "{searchQuery}"</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.length > 0 ? searchResults.map((res, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-[#FF5B00] uppercase tracking-widest">{res.type}</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{res.name}</p>
                    </div>
                    <button onClick={() => handleSearchNavigate(res)} className="text-sm text-[#FF5B00] font-medium hover:underline">Перейти &rarr;</button>
                  </div>
                )) : (
                  <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500">
                    <IconSearch className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    Ничего не найдено
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
