
import React, { useState, useEffect } from 'react';
import { Factory, TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, ChevronRight, Workflow } from 'lucide-react';
import { api } from '../services/api';
import { Client, ProductionLine, SupportTicket } from '../types';

interface DashboardProps {
  onNavigate?: (tab: 'dashboard' | 'clients' | 'logs' | 'search' | 'kb' | 'users' | 'tickets') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [categoryAnalytics, setCategoryAnalytics] = useState<any[]>([]);
  const [avgPeriod, setAvgPeriod] = useState<string>('total');
  const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

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
        setCategoryAnalytics(await api.getTicketCategoryAnalytics(avgPeriod));
      } catch (e) {
        setCategoryAnalytics([]);
      }
    };
    loadAnalytics();
  }, [avgPeriod]);

  // Line statistics
  const now = new Date();

  const lineSupportInfo = lines.map(line => {
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

  const linesOnSupportCount = lineSupportInfo.filter(l => l.isActive).length;
  const linesExpiredCount = lineSupportInfo.filter(l => l.isExpired).length;

  const clientsOnSupportCount = new Set(
    lineSupportInfo.filter(l => l.isActive).map(l => l.client_id)
  ).size;

  const clientsExpiredCount = new Set(
    lineSupportInfo.filter(l => l.isExpired).map(l => l.client_id)
  ).size;

  // Trend: tickets created this week vs last week
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const ticketsThisWeek = tickets.filter(t => new Date(t.created_at) >= oneWeekAgo).length;
  const ticketsLastWeek = tickets.filter(t => {
    const d = new Date(t.created_at);
    return d >= twoWeeksAgo && d < oneWeekAgo;
  }).length;
  const ticketTrendDelta = ticketsThisWeek - ticketsLastWeek;

  // Lines expiring within 30 and 60 days
  const expiringLines = lineSupportInfo
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
    .filter(Boolean)
    .filter((l: any) => l.daysLeft <= 60)
    .sort((a: any, b: any) => a.daysLeft - b.daysLeft) as any[];

  const linesExpiringSoon30 = expiringLines.filter((l: any) => l.daysLeft <= 30).length;

  // Find client name by client_id
  const getClientName = (clientId: number) => clients.find(c => c.id === clientId)?.name || '—';

  // Active tickets (In Progress and On Hold)
  const openTickets = tickets.filter(t => t.status === 'in_progress' || t.status === 'on_hold');
  const displayedTickets = openTickets.slice(0, 5);

  const pieRows = categoryAnalytics
    .map((r: any) => ({ ...r, total_tickets: Number(r.total_tickets ?? 0) }))
    .filter((r: any) => r.total_tickets > 0);

  const pieTotal = pieRows.reduce((sum: number, r: any) => sum + r.total_tickets, 0);
  const pieColors = ['#FF5B00', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#64748B'];

  // Helper to create SVG paths
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  let cumulativePercent = 0;
  const piePaths = pieRows.map((r: any, idx: number) => {
    const startPercent = cumulativePercent;
    const percent = r.total_tickets / pieTotal;
    cumulativePercent += percent;

    const [startX, startY] = getCoordinatesForPercent(startPercent);
    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);

    const largeArcFlag = percent > 0.5 ? 1 : 0;

    // Create donut slice path (outer radius 1, inner radius 0.7)
    // Note: SVG coordinates are usually (x,y), we'll center at 0,0 and scale up
    // We start from -PI/2 (top) so we rotate -90deg in SVG transform or here

    // Let's use simple logic: move to outer start, arc to outer end, line to inner end, arc to inner start, close
    const outerR = 1;
    const innerR = 0.75; // Donut thickness

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

  const hoveredData = hoveredCategory
    ? pieRows.find((r: any) => r.category_id === hoveredCategory)
    : null;

  // If hoveredData is found, get its index to match color
  const hoveredColor = hoveredData
    ? pieColors[pieRows.indexOf(hoveredData) % pieColors.length]
    : null;

  const filteredAnalytics = selectedCategory
    ? categoryAnalytics.filter((r: any) => r.category_id === selectedCategory)
    : categoryAnalytics;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 italic uppercase tracking-tight">Обзор системы</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Мониторинг обращений и состояния объектов в реальном времени</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <button
          onClick={() => {
            window.history.pushState({ tab: 'clients' }, '', '/clients');
            if (onNavigate) onNavigate('clients');
          }}
          className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 text-left hover:border-[#FF5B00]/40 transition-all hover:-translate-y-1 group active:scale-95"
        >
          <div className="w-12 h-12 bg-[#FF5B00]/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Workflow className="w-6 h-6 text-[#FF5B00]" strokeWidth={2.5} />
          </div>
          <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Всего клиентов</p>
          <p className="text-4xl font-black text-slate-900 dark:text-slate-100">{clients.length}</p>
          <p className="text-xs font-bold text-slate-400 mt-2">
            <span className="text-indigo-500">{lines.length}</span> производственных линий
          </p>
        </button>

        <button
          onClick={() => {
            window.history.pushState({ tab: 'tickets' }, '', '/tickets');
            if (onNavigate) onNavigate('tickets');
          }}
          className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 text-left hover:border-amber-300 dark:hover:border-amber-600 transition-all hover:-translate-y-1 group active:scale-95"
        >
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Обращения за неделю</p>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black text-amber-600 dark:text-amber-400">{ticketsThisWeek}</span>
            {ticketTrendDelta !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-black ${ticketTrendDelta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {ticketTrendDelta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {Math.abs(ticketTrendDelta)}
              </span>
            )}
            {ticketTrendDelta === 0 && (
              <span className="flex items-center gap-0.5 text-xs font-black text-slate-400">
                <Minus className="w-3.5 h-3.5" /> 0
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-slate-400 mt-2">
            <span className="text-slate-500">{ticketsLastWeek}</span> за прошлую неделю
          </p>
        </button>

        <button
          onClick={() => {
            window.history.pushState({ tab: 'clients' }, '', '/clients?support=active');
            if (onNavigate) onNavigate('clients');
          }}
          className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 text-left hover:border-indigo-300 dark:hover:border-indigo-600 transition-all hover:-translate-y-1 group active:scale-95"
        >
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.040A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">На техподдержке</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{clientsOnSupportCount}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Клиентов</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-2">
            <span className="text-indigo-500">{linesOnSupportCount}</span> активных линий
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
          className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 text-left hover:border-red-300 dark:hover:border-red-600 transition-all hover:-translate-y-1 group active:scale-95"
        >
          <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Поддержка истекла</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-red-500">{clientsExpiredCount}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Клиентов</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-2">
            <span className="text-red-400">{linesExpiredCount}</span> без поддержки
          </p>
        </button>
      </div>

      {/* Upcoming Support Expirations Widget */}
      {expiringLines.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-8 pb-4 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Ближайшие истечения</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Поддержка истекает в ближайшие 60 дней</p>
            </div>
            <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-[10px] font-black uppercase rounded-full border border-amber-100 dark:border-amber-800">
              {expiringLines.length} линий
            </span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {expiringLines.slice(0, 5).map((line: any) => (
              <div
                key={line.id}
                onClick={() => {
                  window.history.pushState({ tab: 'clients' }, '', `/clients?client=${line.client_id}`);
                  if (onNavigate) onNavigate('clients');
                }}
                className="flex items-center justify-between px-8 py-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${line.daysLeft <= 7 ? 'bg-red-50 dark:bg-red-900/20' :
                    line.daysLeft <= 30 ? 'bg-amber-50 dark:bg-amber-900/20' :
                      'bg-blue-50 dark:bg-blue-900/20'
                    }`}>
                    {line.daysLeft <= 7 ? (
                      <AlertTriangle className={`w-5 h-5 text-red-500`} />
                    ) : (
                      <Shield className={`w-5 h-5 ${line.daysLeft <= 30 ? 'text-amber-500' : 'text-blue-500'}`} />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#FF5B00] transition-colors">{getClientName(line.client_id)}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400 font-medium">{line.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{line.supportType}</span>
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
          {expiringLines.length > 5 && (
            <div className="px-8 py-4 border-t border-slate-50 dark:border-slate-700/50">
              <button
                onClick={() => {
                  window.history.pushState({ tab: 'clients' }, '', '/clients?support=active');
                  if (onNavigate) onNavigate('clients');
                }}
                className="text-sm font-bold text-[#FF5B00] hover:text-[#e65200] transition-colors flex items-center gap-1"
              >
                Все клиенты <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-8 pb-4 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Заявки в работе</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Очередь активных инцидентов</p>
          </div>
          <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-[10px] font-black uppercase rounded-full border border-amber-100 dark:border-amber-800">
            {openTickets.length} активных
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                <th className="px-8 py-4">Клиент</th>
                <th className="px-8 py-4">Проблема</th>
                <th className="px-8 py-4">Статус</th>
                <th className="px-8 py-4 hidden sm:table-cell">Инженер</th>
                <th className="px-8 py-4 hidden sm:table-cell">Обновлено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {displayedTickets.map(t => (
                <tr
                  key={t.id}
                  onClick={() => handleDrillDown(undefined, undefined, t.id)}
                  className="group text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#FF5B00] transition-colors">{t.client_name || '—'}</span>
                      <span className="text-[10px] text-slate-400 font-medium">#{t.id}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="max-w-xs truncate text-slate-600 dark:text-slate-300 font-medium">{t.problem_description}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${t.status === 'on_hold'
                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800'
                      }`}>
                      {t.status === 'on_hold' ? 'В ожидании' : 'В работе'}
                    </span>
                  </td>
                  <td className="px-8 py-5 hidden sm:table-cell">
                    <span className="text-slate-600 dark:text-slate-300 font-bold">{t.engineer_name || '—'}</span>
                  </td>
                  <td className="px-8 py-5 text-slate-400 dark:text-slate-500 font-bold hidden sm:table-cell">
                    {t.reported_at ? new Date(t.reported_at).toLocaleDateString('ru-RU') : '—'}
                  </td>
                </tr>
              ))}
              {openTickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-400 font-bold uppercase tracking-widest opacity-40">Нет активных заявок</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {openTickets.length > 5 && (
          <div className="px-8 py-4 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between">
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

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-8 pb-4 border-b border-slate-50 dark:border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Аналитика</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Распределение по категориям проблем</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700 self-start">
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
                  ? 'bg-white dark:bg-slate-700 text-[#FF5B00] shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1">
              <div className="flex items-center justify-center p-4">
                <div className="relative w-56 h-56 group">
                  {pieTotal > 0 ? (
                    <svg viewBox="-1 -1 2 2" className="w-56 h-56 transform -rotate-0 drop-shadow-2xl">
                      {piePaths.map((slice) => (
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
                    <div className="w-full h-full rounded-full border-4 border-dashed border-slate-100 dark:border-slate-700 flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/30">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Нет данных</span>
                    </div>
                  )}

                  {/* Center Content */}
                  <div className="absolute inset-[25%] rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-center shadow-xl border border-slate-50 dark:border-slate-700 z-10">
                    <div className="animate-in fade-in duration-300">
                      {hoveredData ? (
                        <div className="px-2">
                          <div className="text-2xl font-black" style={{ color: hoveredColor }}>
                            {Math.round((hoveredData.total_tickets / pieTotal) * 100)}%
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight line-clamp-2 mt-0.5">
                            {hoveredData.category_name}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-4xl font-black text-slate-900 dark:text-slate-100">{pieTotal}</div>
                          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Обращений</div>
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
                      className={`flex items-center justify-between gap-3 text-xs transition-all duration-200 cursor-pointer p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isDimmed ? 'opacity-30 blur-[0.5px]' : 'opacity-100'
                        } ${isSelected ? 'bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600' : 'border border-transparent'}`}
                      onMouseEnter={() => setHoveredCategory(r.category_id)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() => toggleCategorySelection(r.category_id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`inline-block w-3 h-3 rounded-full transition-transform ${isActive ? 'scale-[1.3]' : ''}`} style={{ backgroundColor: color }} />
                        <span className={`truncate font-bold ${isActive ? 'text-[#FF5B00] dark:text-[#FF5B00]' : 'text-slate-700 dark:text-slate-300'}`}>{r.category_name}</span>
                      </div>
                      <div className="shrink-0 font-black text-slate-400 dark:text-slate-500">{r.total_tickets} <span className="text-[10px] ml-1">{pct}%</span></div>
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
                              <span className="font-bold text-slate-900 dark:text-slate-100">{row.category_name}</span>
                              <span className="text-[10px] text-slate-400 font-medium line-clamp-1">{row.description || 'Нет описания'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-5 text-center">
                            <button
                              onClick={() => handleDrillDown(row.category_id)}
                              className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs hover:bg-[#FF5B00] hover:text-white transition-all mx-auto block"
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
                              className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-black text-xs hover:bg-red-500 hover:text-white transition-all mx-auto block"
                            >
                              {row.unsolved_tickets}
                            </button>
                          </td>
                          <td className="px-4 py-5 text-right hidden lg:table-cell">
                            <div className="flex flex-col items-end">
                              <span className="font-black text-[#FF5B00]">
                                {row[`avg_${avgPeriod}`] ?? '—'} <span className="text-[10px] ml-0.5">ч</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">В среднем</span>
                            </div>
                          </td>
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
  );
};

export default Dashboard;
