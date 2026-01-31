
import React, { useState, useEffect } from 'react';
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

  const handleDrillDown = (categoryId: number, status?: string) => {
    const params = new URLSearchParams();
    if (categoryId) params.set('category', categoryId.toString());
    if (status) params.set('status', status);
    const url = `/tickets?${params.toString()}`;
    window.history.pushState({ tab: 'tickets' }, '', url);
    if (onNavigate) onNavigate('tickets');
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

  // Active tickets (In Progress and On Hold)
  const openTickets = tickets.filter(t => t.status === 'in_progress' || t.status === 'on_hold');

  const pieRows = categoryAnalytics
    .map((r: any) => ({ ...r, total_tickets: Number(r.total_tickets ?? 0) }))
    .filter((r: any) => r.total_tickets > 0);

  const pieTotal = pieRows.reduce((sum: number, r: any) => sum + r.total_tickets, 0);
  const pieColors = ['#FF5B00', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#64748B'];

  let acc = 0;
  const pieSegments = pieTotal > 0
    ? pieRows
      .map((r: any, idx: number) => {
        const pct = (r.total_tickets / pieTotal) * 100;
        const start = acc;
        acc += pct;
        const color = pieColors[idx % pieColors.length];
        return `${color} ${start}% ${acc}%`;
      })
      .join(', ')
    : '';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Обзор системы</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Всего клиентов</p>
          <p className="text-3xl font-bold text-[#FF5B00]">{clients.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Всего линий</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{lines.length}</p>
        </div>
        <button
          onClick={() => {
            window.history.pushState({ tab: 'clients' }, '', '/clients?support=active');
            if (onNavigate) onNavigate('clients');
          }}
          className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-left hover:border-indigo-300 dark:hover:border-indigo-700 transition-all hover:shadow-md group"
        >
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 transition-colors">На техподдержке</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-600">{clientsOnSupportCount}</span>
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-tighter">клиентов</span>
          </div>
          <div className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-1">
            {linesOnSupportCount} <span className="text-[10px] uppercase font-black opacity-60">линий</span>
          </div>
        </button>
        <button
          onClick={() => {
            window.history.pushState({ tab: 'clients' }, '', '/clients?support=expired');
            if (onNavigate) onNavigate('clients');
          }}
          className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-left hover:border-red-300 dark:hover:border-red-700 transition-all hover:shadow-md group"
        >
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-red-500 transition-colors">Поддержка истекла</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-red-500">{clientsExpiredCount}</span>
            <span className="text-xs font-bold text-red-400 uppercase tracking-tighter">клиентов</span>
          </div>
          <div className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-1">
            {linesExpiredCount} <span className="text-[10px] uppercase font-black opacity-60">линий</span>
          </div>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Заявки в работе</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm">
                <th className="pb-3 font-medium">Клиент</th>
                <th className="pb-3 font-medium">Проблема</th>
                <th className="pb-3 font-medium">Статус</th>
                <th className="pb-3 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {openTickets.map(t => (
                <tr key={t.id} className="text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{t.client_name || '—'}</td>
                  <td className="py-3 max-w-xs truncate">{t.problem_description}</td>
                  <td className="py-3">
                    {t.status === 'on_hold' ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        В ожидании
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                        В работе
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-slate-400">{t.reported_at ? new Date(t.reported_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {openTickets.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">Нет заявок в работе</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Аналитика по категориям проблем</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Топ категорий по количеству обращений, среднее время решения и динамика.
            </p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl self-start">
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
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${avgPeriod === p.id
                  ? 'bg-white dark:bg-slate-600 text-[#FF5B00] shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1">
            <div className="flex items-center justify-center">
              <div className="relative w-52 h-52">
                <div
                  className="w-52 h-52 rounded-full border border-slate-100 dark:border-slate-700"
                  style={{ background: pieSegments ? `conic-gradient(${pieSegments})` : undefined }}
                />
                <div className="absolute inset-7 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700" />
                <div className="absolute inset-0 flex items-center justify-center text-center">
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{pieTotal}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">обращений</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {pieRows.map((r: any, idx: number) => {
                const color = pieColors[idx % pieColors.length];
                const pct = pieTotal > 0 ? Math.round((r.total_tickets / pieTotal) * 100) : 0;
                return (
                  <div key={r.category_id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="truncate text-slate-700 dark:text-slate-200" title={r.description || ''}>{r.category_name}</span>
                    </div>
                    <div className="shrink-0 text-slate-500 dark:text-slate-400">{r.total_tickets} ({pct}%)</div>
                  </div>
                );
              })}
              {pieTotal === 0 && (
                <div className="py-2 text-center text-slate-400 dark:text-slate-500 italic">Нет данных для диаграммы</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm">
                    <th className="pb-3 font-medium">Категория</th>
                    <th className="pb-3 font-medium">Всего</th>
                    <th className="pb-3 font-medium">В работе</th>
                    <th className="pb-3 font-medium">В ожидании</th>
                    <th className="pb-3 font-medium">Решено</th>
                    <th className="pb-3 font-medium text-red-500">Не решено</th>
                    <th className="pb-3 font-medium">Среднее ({avgPeriod === 'total' ? 'все' : avgPeriod})</th>
                    <th className="pb-3 font-medium">За 7 дней</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {categoryAnalytics.map((row: any) => (
                    <tr key={row.category_id} className="text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <td className="py-3 font-medium text-slate-900 dark:text-slate-100" title={row.description || ''}>{row.category_name}</td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDrillDown(row.category_id)}
                          className="hover:text-[#FF5B00] hover:underline font-medium"
                        >
                          {row.total_tickets}
                        </button>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDrillDown(row.category_id, 'in_progress')}
                          className="hover:text-amber-600 hover:underline font-bold"
                        >
                          {row.open_tickets}
                        </button>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDrillDown(row.category_id, 'on_hold')}
                          className="hover:text-slate-600 hover:underline font-bold text-slate-500"
                        >
                          {row.on_hold_tickets}
                        </button>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDrillDown(row.category_id, 'solved')}
                          className="text-emerald-600 font-bold hover:underline"
                        >
                          {row.solved_tickets}
                        </button>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDrillDown(row.category_id, 'unsolved')}
                          className="text-red-500 font-bold hover:underline"
                        >
                          {row.unsolved_tickets}
                        </button>
                      </td>
                      <td className="py-3">
                        <span className="font-mono text-[#FF5B00] font-bold">
                          {row[`avg_${avgPeriod}`] ?? '—'} <span className="text-[10px] font-normal text-slate-400 ml-1">ч</span>
                        </span>
                      </td>
                      <td className="py-3">{row.last_7d_tickets}</td>
                    </tr>
                  ))}
                  {categoryAnalytics.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">Нет данных для аналитики</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
