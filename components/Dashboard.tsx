
import React, { useState, useEffect } from 'react';
import { Factory, TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, ChevronRight, ChevronDown, Workflow } from 'lucide-react';
import { api } from '../services/api';
import { Client, ProductionLine, SupportTicket } from '../types';

interface DashboardProps {
  onNavigate?: (tab: 'dashboard' | 'clients' | 'logs' | 'search' | 'kb' | 'users' | 'tickets' | 'post-implementation-analytics') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [categoryAnalytics, setCategoryAnalytics] = useState<any[]>([]);
  const [avgPeriod, setAvgPeriod] = useState<string>('total');
  const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showAllExpirations, setShowAllExpirations] = useState(false);
  const [channelAnalytics, setChannelAnalytics] = useState<any[]>([]);
  const [frequencyAnalytics, setFrequencyAnalytics] = useState<any[]>([]);

  // Collapse state for major sections
  const [showExpirations, setShowExpirations] = useState(true);
  const [showActiveTickets, setShowActiveTickets] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showChannelFreq, setShowChannelFreq] = useState(true);

  const handleDrillDown = (categoryId?: number, status?: string, ticketId?: number) => {
    const params = new URLSearchParams();
    if (categoryId) params.set('category', categoryId.toString());
    if (status) params.set('status', status);
    if (ticketId) params.set('ticketId', ticketId.toString());
    const url = `/tickets?${params.toString()}`;
    window.history.pushState({ tab: 'tickets' }, '', url);
    if (onNavigate) onNavigate('tickets');
  };

  const toggleCategorySelection = (categoryId: number) => {
    setSelectedCategory(prev => prev === categoryId ? null : categoryId);
  };

  useEffect(() => {
    const load = async () => {
      setClients(await api.getClients());
      setLines(await api.getAllLines());
      setTickets(await api.getTickets());
    };
    load();
  }, []);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [catData, chanData, freqData] = await Promise.all([
            api.getTicketCategoryAnalytics(avgPeriod),
            api.getTicketChannelAnalytics(),
            api.getTicketFrequencyAnalytics()
        ]);
        setCategoryAnalytics(catData);
        setChannelAnalytics(chanData);
        setFrequencyAnalytics(freqData);
      } catch (e) {
        setCategoryAnalytics([]);
        setChannelAnalytics([]);
        setFrequencyAnalytics([]);
      }
    };
    loadAnalytics();
  }, [avgPeriod]);

  // Line statistics
  const lineSupportInfo = React.useMemo(() => {
    const now = new Date();
    return lines.map(line => {
      const paidStart = line.paid_support_start_date ? new Date(line.paid_support_start_date) : null;
      const paidEnd = line.paid_support_end_date ? new Date(line.paid_support_end_date) : null;
      const warrantyStart = line.warranty_start_date ? new Date(line.warranty_start_date) : null;
      const warrantyEnd = warrantyStart ? new Date(warrantyStart.getTime()) : null;
      if (warrantyEnd) warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);

      const onPaid = paidStart && paidEnd && now >= paidStart && now <= paidEnd;
      const onWarranty = warrantyStart && warrantyEnd && now >= warrantyStart && now <= warrantyEnd;
      const isActive = onPaid || onWarranty;

      const paidExpired = paidEnd && now > paidEnd;
      const warrantyExpired = warrantyEnd && now > warrantyEnd;
      const isExpired = (paidExpired || warrantyExpired) && !isActive;

      return { ...line, isActive, isExpired };
    });
  }, [lines]);

  const stats = React.useMemo(() => {
    const activeInfo = lineSupportInfo.filter(l => l.isActive);
    const expiredInfo = lineSupportInfo.filter(l => l.isExpired);

    const activeClientIds = new Set(activeInfo.map(l => l.client_id));
    const expiredClientIds = new Set(expiredInfo.map(l => l.client_id));

    return {
      linesOnSupportCount: activeInfo.length,
      linesExpiredCount: expiredInfo.length,
      clientsOnSupportCount: activeClientIds.size,
      clientsExpiredCount: expiredClientIds.size
    };
  }, [lineSupportInfo]);

  // Trend: tickets created this week vs last week
  const trend = React.useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const ticketsThisWeek = tickets.filter(t => new Date(t.created_at) >= oneWeekAgo).length;
    const ticketsLastWeek = tickets.filter(t => {
      const d = new Date(t.created_at);
      return d >= twoWeeksAgo && d < oneWeekAgo;
    }).length;

    return {
      ticketsThisWeek,
      ticketsLastWeek,
      ticketTrendDelta: ticketsThisWeek - ticketsLastWeek
    };
  }, [tickets]);

  // Lines expiring within 30 and 60 days
  const expiringLines = React.useMemo(() => {
    const now = new Date();
    return lineSupportInfo
      .filter(l => l.isActive)
      .map(l => {
        const paidEnd = l.paid_support_end_date ? new Date(l.paid_support_end_date) : null;
        const warrantyStart = l.warranty_start_date ? new Date(l.warranty_start_date) : null;
        const warrantyEnd = warrantyStart ? new Date(warrantyStart.getTime()) : null;
        if (warrantyEnd) warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);

        let endDate: Date | null = null;
        let supportType = '';
        if (paidEnd && now <= paidEnd) { endDate = paidEnd; supportType = 'Техподдержка'; }
        else if (warrantyEnd && now <= warrantyEnd) { endDate = warrantyEnd; supportType = 'Гарантия'; }

        if (!endDate) return null;
        const daysLeft = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...l, endDate, daysLeft, supportType };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .filter((l: any) => l.daysLeft <= 60)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [lineSupportInfo]);

  const linesExpiringSoon30 = React.useMemo(() =>
    expiringLines.filter((l: any) => l.daysLeft <= 30).length,
    [expiringLines]);

  // Find client name by client_id
  const getClientName = (clientId: number) => clients.find(c => c.id === clientId)?.name || '—';

  // Active tickets (In Progress and On Hold)
  const openTickets = tickets.filter(t => t.status === 'in_progress' || t.status === 'on_hold');
  const displayedTickets = openTickets.slice(0, 5);

  const piePaths = React.useMemo(() => {
    const pieRows = categoryAnalytics
      .map((r: any) => ({ ...r, total_tickets: Number(r.total_tickets ?? 0) }))
      .filter((r: any) => r.total_tickets > 0);

    const pieTotal = pieRows.reduce((sum: number, r: any) => sum + r.total_tickets, 0);
    const pieColors = ['#FF5B00', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#64748B'];

    const getCoordinatesForPercent = (percent: number) => {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    };

    let cumulativePercent = 0;
    const paths = pieRows.map((r: any, idx: number) => {
      const startPercent = cumulativePercent;
      const percent = r.total_tickets / pieTotal;
      cumulativePercent += percent;

      const largeArcFlag = percent > 0.5 ? 1 : 0;
      const outerR = 1;
      const innerR = 0.75;

      const startXOuter = Math.cos(2 * Math.PI * startPercent - Math.PI / 2) * outerR;
      const startYOuter = Math.sin(2 * Math.PI * startPercent - Math.PI / 2) * outerR;
      const endXOuter = Math.cos(2 * Math.PI * cumulativePercent - Math.PI / 2) * outerR;
      const endYOuter = Math.sin(2 * Math.PI * cumulativePercent - Math.PI / 2) * outerR;

      const startXInner = Math.cos(2 * Math.PI * startPercent - Math.PI / 2) * innerR;
      const startYInner = Math.sin(2 * Math.PI * startPercent - Math.PI / 2) * innerR;
      const endXInner = Math.cos(2 * Math.PI * cumulativePercent - Math.PI / 2) * innerR;
      const endYInner = Math.sin(2 * Math.PI * cumulativePercent - Math.PI / 2) * innerR;

      const pathData = [
        `M ${startXOuter} ${startYOuter}`,
        `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endXOuter} ${endYOuter}`,
        `L ${endXInner} ${endYInner}`,
        `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${startXInner} ${startYInner}`,
        'Z'
      ].join(' ');

      return {
        pathData,
        color: pieColors[idx % pieColors.length],
        category: r,
        percent: Math.round(percent * 100)
      };
    });

    return {
      paths,
      pieTotal,
      pieRows,
      pieColors
    };
  }, [categoryAnalytics]);

  const { paths, pieTotal, pieRows, pieColors } = piePaths;

  const hoveredData = hoveredCategory
    ? pieRows.find((r: any) => r.category_id === hoveredCategory)
    : null;

  const hoveredColor = hoveredData
    ? pieColors[pieRows.indexOf(hoveredData) % pieColors.length]
    : null;

  const filteredAnalytics = React.useMemo(() =>
    selectedCategory
      ? categoryAnalytics.filter((r: any) => r.category_id === selectedCategory)
      : categoryAnalytics,
    [selectedCategory, categoryAnalytics]);

  const channelLabels: Record<string, string> = {
    'phone': '📞 Телефон',
    'email': '📧 Email',
    'telegram': '✈️ Telegram',
    'max': '💬 Messenger MAX',
    'other': '❓ Другое'
  };

  const SectionHeader = ({
    title,
    subtitle,
    badge,
    isOpen,
    onToggle,
    extra
  }: {
    title: string;
    subtitle: string;
    badge?: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    extra?: React.ReactNode;
  }) => (
    <div className="p-4 sm:p-8 pb-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-black text-white">{title}</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {extra}
        {badge}
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-400 transition-all"
          title={isOpen ? 'Свернуть' : 'Развернуть'}
        >
          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'}`} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-tight">Обзор системы</h1>
          <p className="text-white/50 font-medium">Мониторинг обращений и состояния объектов в реальном времени</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <button
          onClick={() => {
            window.history.pushState({ tab: 'clients' }, '', '/clients');
            if (onNavigate) onNavigate('clients');
          }}
          className="glass-card p-4 sm:p-8 rounded-[2rem] shadow-2xl shadow-black/20 border border-white/10 text-left hover:border-[#FF5B00]/40 transition-all hover:-translate-y-1 group active:scale-95 glass-card glass-card-hover"
        >
          <div className="w-12 h-12 bg-[#FF5B00]/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Workflow className="w-6 h-6 text-[#FF5B00]" strokeWidth={2.5} />
          </div>
          <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">Всего клиентов</p>
          <p className="text-3xl sm:text-4xl font-black text-white">{clients.length}</p>
          <p className="text-xs font-bold text-slate-400 mt-2">
            <span className="text-indigo-500">{lines.length}</span> производственных линий
          </p>
        </button>

        <button
          onClick={() => {
            window.history.pushState({ tab: 'tickets' }, '', '/tickets');
            if (onNavigate) onNavigate('tickets');
          }}
          className="glass-card p-4 sm:p-8 rounded-[2rem] shadow-2xl shadow-black/20 border border-white/10 text-left hover:border-amber-300 dark:hover:border-amber-600 transition-all hover:-translate-y-1 group active:scale-95 glass-card glass-card-hover"
        >
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">Обращения за неделю</p>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400">{trend.ticketsThisWeek}</span>
            {trend.ticketTrendDelta !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-black ${trend.ticketTrendDelta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {trend.ticketTrendDelta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {Math.abs(trend.ticketTrendDelta)}
              </span>
            )}
            {trend.ticketTrendDelta === 0 && (
              <span className="flex items-center gap-0.5 text-xs font-black text-slate-400">
                <Minus className="w-3.5 h-3.5" /> 0
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-slate-400 mt-2">
            <span className="text-slate-500">{trend.ticketsLastWeek}</span> за прошлую неделю
          </p>
        </button>

        <button
          onClick={() => {
            window.history.pushState({ tab: 'clients' }, '', '/clients?support=active');
            if (onNavigate) onNavigate('clients');
          }}
          className="glass-card p-4 sm:p-8 rounded-[2rem] shadow-2xl shadow-black/20 border border-white/10 text-left hover:border-indigo-300 dark:hover:border-indigo-600 transition-all hover:-translate-y-1 group active:scale-95 glass-card glass-card-hover"
        >
          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.040A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">На техподдержке</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400">{stats.clientsOnSupportCount}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Клиентов</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-2">
            <span className="text-indigo-500">{stats.linesOnSupportCount}</span> активных линий
            {linesExpiringSoon30 > 0 && (
              <span className="ml-2 text-amber-500">⚠ {linesExpiringSoon30} истекают скоро</span>
            )}
          </p>
        </button>

        <button
          onClick={() => {
            window.history.pushState({ tab: 'clients' }, '', '/clients?support=expired');
            if (onNavigate) onNavigate('clients');
          }}
          className="glass-card p-4 sm:p-8 rounded-[2rem] shadow-2xl shadow-black/20 border border-white/10 text-left hover:border-red-300 dark:hover:border-red-600 transition-all hover:-translate-y-1 group active:scale-95 glass-card glass-card-hover"
        >
          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">Поддержка истекла</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-red-500">{stats.clientsExpiredCount}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Клиентов</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-2">
            <span className="text-red-400">{stats.linesExpiredCount}</span> без поддержки
          </p>
        </button>
      </div>

      {/* Upcoming Support Expirations Widget */}
      {expiringLines.length > 0 && (
        <div className="glass-card rounded-[2.5rem] shadow-2xl shadow-black/20 border border-white/10 overflow-hidden glass-surface">
          <SectionHeader
            title="Ближайшие истечения"
            subtitle="Поддержка истекает в ближайшие 60 дней"
            badge={
              <span className="px-3 py-1 bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase rounded-full border border-amber-500/20">
                {expiringLines.length} линий
              </span>
            }
            isOpen={showExpirations}
            onToggle={() => setShowExpirations(v => !v)}
          />
          <div className={`overflow-hidden transition-all duration-300 ${showExpirations ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {expiringLines.slice(0, showAllExpirations ? expiringLines.length : 3).map((line: any) => (
                <div
                  key={line.id}
                  onClick={() => {
                    window.history.pushState({ tab: 'clients' }, '', `/clients?client=${line.client_id}`);
                    if (onNavigate) onNavigate('clients');
                  }}
                  className="flex items-center justify-between px-4 sm:px-8 py-5 hover:bg-white/10/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${line.daysLeft <= 7 ? 'bg-red-500/10' :
                      line.daysLeft <= 30 ? 'bg-amber-500/10' :
                        'bg-blue-50 dark:bg-blue-900/20'
                      }`}>
                      {line.daysLeft <= 7 ? (
                        <AlertTriangle className={`w-5 h-5 text-red-500`} />
                      ) : (
                        <Shield className={`w-5 h-5 ${line.daysLeft <= 30 ? 'text-amber-500' : 'text-blue-500'}`} />
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-white group-hover:text-[#FF5B00] transition-colors">{getClientName(line.client_id)}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 font-medium">{line.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase bg-white/10 text-white/50">{line.supportType}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`text-sm font-black ${line.daysLeft <= 7 ? 'text-red-500' :
                        line.daysLeft <= 30 ? 'text-amber-500' :
                          'text-blue-500'
                        }`}>
                        {line.daysLeft} дн.
                      </span>
                      <div className="text-[10px] text-slate-400 font-bold">до {line.endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-[#FF5B00] transition-colors" />
                  </div>
                </div>
              ))}
            </div>
            {expiringLines.length > 3 && (
              <div className="px-4 sm:px-8 py-4 border-t border-white/5">
                <button
                  onClick={() => setShowAllExpirations(!showAllExpirations)}
                  className="text-sm font-bold text-[#FF5B00] hover:text-[#e65200] transition-colors flex items-center gap-1"
                >
                  {showAllExpirations ? 'Свернуть' : `Все клиенты (${expiringLines.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Tickets */}
      <div className="glass-card rounded-[2.5rem] shadow-2xl shadow-black/20 border border-white/10 overflow-hidden glass-surface">
        <SectionHeader
          title="Заявки в работе"
          subtitle="Очередь активных инцидентов"
          badge={
            <span className="px-3 py-1 bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase rounded-full border border-amber-500/20">
              {openTickets.length} активных
            </span>
          }
          isOpen={showActiveTickets}
          onToggle={() => setShowActiveTickets(v => !v)}
        />
        <div className={`overflow-hidden transition-all duration-300 ${showActiveTickets ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                  <th className="px-4 sm:px-8 py-4">Клиент</th>
                  <th className="px-4 sm:px-8 py-4">Проблема</th>
                  <th className="px-4 sm:px-8 py-4">Статус</th>
                  <th className="px-4 sm:px-8 py-4 hidden sm:table-cell">Инженер</th>
                  <th className="px-4 sm:px-8 py-4 hidden sm:table-cell">Обновлено</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {displayedTickets.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => handleDrillDown(undefined, undefined, t.id)}
                    className="group text-sm hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <td className="px-4 sm:px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-white group-hover:text-[#FF5B00] transition-colors">{t.client_name || '—'}</span>
                        <span className="text-[10px] text-slate-400 font-medium">#{t.id}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-8 py-5">
                      <p className="max-w-xs truncate text-slate-600 text-white/70 font-medium">{t.problem_description}</p>
                    </td>
                    <td className="px-4 sm:px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${t.status === 'on_hold'
                        ? 'bg-white/10 text-white/60'
                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800'
                        }`}>
                        {t.status === 'on_hold' ? 'В ожидании' : 'В работе'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-8 py-5 hidden sm:table-cell">
                      <span className="text-slate-600 text-white/70 font-bold">{t.engineer_name || '—'}</span>
                    </td>
                    <td className="px-4 sm:px-8 py-5 text-white/40 font-bold hidden sm:table-cell">
                      {t.reported_at ? new Date(t.reported_at).toLocaleDateString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))}
                {openTickets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-8 py-16 text-center text-slate-400 font-bold uppercase tracking-widest opacity-40">Нет активных заявок</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {openTickets.length > 5 && (
            <div className="px-4 sm:px-8 py-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Показано 5 из {openTickets.length}</span>
              <button
                onClick={() => {
                  window.history.pushState({ tab: 'tickets' }, '', '/tickets?status=in_progress');
                  if (onNavigate) onNavigate('tickets');
                }}
                className="text-sm font-bold text-[#FF5B00] hover:text-[#e65200] transition-colors flex items-center gap-1"
              >
                Все заявки <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Analytics */}
      <div className="glass-card rounded-[2.5rem] shadow-2xl shadow-black/20 border border-white/10 overflow-hidden glass-surface">
        <SectionHeader
          title="Аналитика"
          subtitle="Распределение по категориям проблем"
          isOpen={showAnalytics}
          onToggle={() => setShowAnalytics(v => !v)}
          extra={
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  window.history.pushState({ tab: 'post-implementation-analytics' }, '', '/post-implementation-analytics');
                  if (onNavigate) onNavigate('post-implementation-analytics');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#FF5B00]/10 text-[#FF5B00] text-[10px] font-black uppercase rounded-2xl border border-[#FF5B00]/20 hover:bg-[#FF5B00] hover:text-white transition-all shadow-lg shadow-orange-500/10"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                Подробно по внедрениям
              </button>
              <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
              {[
                { id: '7d', label: 'Неделя' },
                { id: '30d', label: 'Месяц' },
                { id: '90d', label: 'Квартал' },
                { id: '365d', label: 'Год' },
                { id: 'total', label: 'Все' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setAvgPeriod(p.id)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${avgPeriod === p.id
                    ? 'bg-white bg-white/10 text-[#FF5B00] shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                    : 'text-white/50 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                  {p.label}
                </button>
              ))}
              </div>
            </div>
          }
        />
        <div className={`overflow-hidden transition-all duration-300 ${showAnalytics ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-4 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-1">
                <div className="flex items-center justify-center p-4">
                  <div className="relative w-56 h-56 group">
                    {pieTotal > 0 ? (
                      <svg viewBox="-1 -1 2 2" className="w-56 h-56 transform -rotate-0 drop-shadow-2xl">
                        {paths.map((slice: any) => (
                          <path
                            key={slice.category.category_id}
                            d={slice.pathData}
                            fill={slice.color}
                            className={`transition-all duration-300 cursor-pointer ${hoveredCategory === slice.category.category_id
                              ? 'opacity-100 scale-105 origin-center'
                              : hoveredCategory !== null
                                ? 'opacity-30'
                                : 'opacity-100'
                              }`}
                            onMouseEnter={() => setHoveredCategory(slice.category.category_id)}
                            onMouseLeave={() => setHoveredCategory(null)}
                            onClick={() => handleDrillDown(slice.category.category_id)}
                            style={{ transformBox: 'fill-box' }}
                          />
                        ))}
                      </svg>
                    ) : (
                      <div className="w-full h-full rounded-full border-4 border-dashed border-white/10 flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/30">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Нет данных</span>
                      </div>
                    )}

                    {/* Center Content */}
                    <div className="absolute inset-[22%] rounded-full bg-[var(--bg-main)]/90 backdrop-blur-xl flex items-center justify-center text-center shadow-2xl border border-white/10 z-10 pointer-events-none">
                      <div className="animate-in fade-in duration-300">
                        {hoveredData ? (
                          <div className="px-2">
                            <div className="text-2xl font-black" style={{ color: hoveredColor }}>
                              {Math.round((hoveredData.total_tickets / pieTotal) * 100)}%
                            </div>
                            <div className="text-[9px] font-bold text-white/50 uppercase tracking-tight line-clamp-2 mt-0.5">
                              {hoveredData.category_name}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-4xl font-black text-white">{pieTotal}</div>
                            <div className="text-[9px] text-white/40 font-black uppercase tracking-widest">Обращений</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-2">
                  {pieRows.map((r: any, idx: number) => {
                    const color = pieColors[idx % pieColors.length];
                    const pct = pieTotal > 0 ? Math.round((r.total_tickets / pieTotal) * 100) : 0;
                    const isHovered = hoveredCategory === r.category_id;
                    const isSelected = selectedCategory === r.category_id;
                    const isActive = isHovered || isSelected;
                    const isDimmed = (hoveredCategory !== null && !isHovered) || (selectedCategory !== null && !isSelected && hoveredCategory === null);

                    return (
                      <div
                        key={r.category_id}
                        className={`flex items-center justify-between gap-3 text-xs transition-all duration-200 cursor-pointer p-3 rounded-2xl hover:bg-white/10/50 ${isDimmed ? 'opacity-30 blur-[0.5px]' : 'opacity-100'
                          } ${isSelected ? 'bg-white/10 border border-slate-200 dark:border-slate-600' : 'border border-transparent'}`}
                        onMouseEnter={() => setHoveredCategory(r.category_id)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={() => toggleCategorySelection(r.category_id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`inline-block w-3 h-3 rounded-full transition-transform ${isActive ? 'scale-[1.3]' : ''}`} style={{ backgroundColor: color }} />
                          <span className={`truncate font-bold ${isActive ? 'text-[#FF5B00] dark:text-[#FF5B00]' : 'text-white/70'}`}>{r.category_name}</span>
                        </div>
                        <div className="shrink-0 font-black text-white/40">{r.total_tickets} <span className="text-[10px] ml-1">{pct}%</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                        <th className="px-4 py-4">Категория</th>
                        <th className="px-4 py-4 text-center">Всего</th>
                        <th className="px-4 py-4 text-center">Решено</th>
                        <th className="px-4 py-4 text-center text-red-500">Не решено</th>
                        <th className="px-4 py-4 text-right hidden lg:table-cell">Ср.время</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                      {filteredAnalytics.map((row: any) => {
                        const isHovered = hoveredCategory === row.category_id;
                        const isSelected = selectedCategory === row.category_id;
                        const isOthersHovered = hoveredCategory !== null && !isHovered;

                        return (
                          <tr
                            key={row.category_id}
                            className={`transition-all duration-200 ${isHovered || isSelected
                              ? 'bg-orange-50/40 dark:bg-orange-900/10'
                              : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/50'
                              } ${isOthersHovered ? 'opacity-40 grayscale-[0.5]' : ''}`}
                            onMouseEnter={() => setHoveredCategory(row.category_id)}
                            onMouseLeave={() => setHoveredCategory(null)}
                          >
                            <td className="px-4 py-5">
                              <div className="flex flex-col">
                                <span className="font-bold text-white">{row.category_name}</span>
                                <span className="text-[10px] text-slate-400 font-medium line-clamp-1">{row.description || 'Нет описания'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <button
                                onClick={() => handleDrillDown(row.category_id)}
                                className="w-10 h-10 rounded-xl bg-white/10 text-slate-600 text-white/70 font-black text-xs hover:bg-[#FF5B00] hover:text-white transition-all mx-auto block"
                              >
                                {row.total_tickets}
                              </button>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <button
                                onClick={() => handleDrillDown(row.category_id, 'solved')}
                                className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black text-xs hover:bg-emerald-500 hover:text-white transition-all mx-auto block"
                              >
                                {row.solved_tickets}
                              </button>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <button
                                onClick={() => handleDrillDown(row.category_id, 'unsolved')}
                                className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-black text-xs hover:bg-red-500 hover:text-white transition-all mx-auto block"
                              >
                                {row.unsolved_tickets}
                              </button>
                            </td>
                            {(() => {
                              const formatHoursMinutes = (value: number | null | undefined) => {
                                if (value == null) return '—';
                                const hours = Math.floor(value);
                                const minutes = Math.round((value - hours) * 60);
                                return `${hours}ч ${minutes}м`;
                              };
                              return (
                                <td className="px-4 py-5 text-right hidden lg:table-cell">
                                  <div className="flex flex-col items-end">
                                    <span className="font-black text-[#FF5B00]">
                                      {formatHoursMinutes(row[`avg_${avgPeriod}`])}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">В среднем</span>
                                  </div>
                                </td>
                              );
                            })()}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Channels & Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:p-8">
        {/* Channel Distribution */}
        <div className="glass-card rounded-[2.5rem] shadow-2xl shadow-black/20 border border-white/10 overflow-hidden glass-surface">
          <SectionHeader
            title="Каналы связи"
            subtitle="Распределение по способам обращения"
            isOpen={showChannelFreq}
            onToggle={() => setShowChannelFreq(v => !v)}
          />
          <div className={`overflow-hidden transition-all duration-300 ${showChannelFreq ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-4 sm:p-8">
              <div className="space-y-4">
                {channelAnalytics.length > 0 ? channelAnalytics.map((item, idx) => {
                  const total = channelAnalytics.reduce((sum, i) => sum + Number(i.count), 0);
                  const percent = total > 0 ? Math.round((Number(item.count) / total) * 100) : 0;
                  return (
                    <div key={item.contact_channel} className="space-y-1">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-white/70">{channelLabels[item.contact_channel] || item.contact_channel}</span>
                        <span className="text-xs font-black text-[#FF5B00]">{item.count} ({percent}%)</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#FF5B00] rounded-full transition-all duration-1000"
                          style={{ width: `${percent}%`, opacity: 1 - (idx * 0.15) }}
                        />
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest opacity-40">Нет данных</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Client Frequency */}
        <div className="glass-card rounded-[2.5rem] shadow-2xl shadow-black/20 border border-white/10 overflow-hidden glass-surface">
          <SectionHeader
            title="Интенсивность запросов"
            subtitle="Среднее кол-во обращений в месяц после внедрения"
            isOpen={showChannelFreq}
            onToggle={() => setShowChannelFreq(v => !v)}
          />
          <div className={`overflow-hidden transition-all duration-300 ${showChannelFreq ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-4 sm:p-8">
              <div className="space-y-4">
                {frequencyAnalytics.length > 0 ? frequencyAnalytics.map((item) => (
                  <div key={item.client_id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-50 border-white/10 hover:bg-white/10/50 transition-all">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{item.client_name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">С {new Date(item.warranty_start_date).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-[#FF5B00]">{item.tickets_per_month}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">заявок/мес</div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest opacity-40">Нет данных о гарантии</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

