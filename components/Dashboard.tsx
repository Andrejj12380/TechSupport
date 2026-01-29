
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Client, ProductionLine, SupportTicket } from '../types';

const Dashboard: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    const load = async () => {
      setClients(await api.getClients());
      setLines(await api.getAllLines());
      setTickets(await api.getTickets());
    };
    load();
  }, []);

  // Line statistics
  const now = new Date();
  const linesOnSupport = lines.filter(line => {
    const paidStart = line.paid_support_start_date ? new Date(line.paid_support_start_date) : null;
    const paidEnd = line.paid_support_end_date ? new Date(line.paid_support_end_date) : null;
    const warrantyStart = line.warranty_start_date ? new Date(line.warranty_start_date) : null;
    const warrantyEnd = warrantyStart ? new Date(warrantyStart.getTime()) : null;
    if (warrantyEnd) warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);

    const onPaid = paidStart && paidEnd && now >= paidStart && now <= paidEnd;
    const onWarranty = warrantyStart && warrantyEnd && now >= warrantyStart && now <= warrantyEnd;
    return onPaid || onWarranty;
  }).length;

  const linesWithProblems = lines.filter(line => {
    const paidStart = line.paid_support_start_date ? new Date(line.paid_support_start_date) : null;
    const paidEnd = line.paid_support_end_date ? new Date(line.paid_support_end_date) : null;
    const warrantyStart = line.warranty_start_date ? new Date(line.warranty_start_date) : null;
    const warrantyEnd = warrantyStart ? new Date(warrantyStart.getTime()) : null;
    if (warrantyEnd) warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);

    const paidExpired = paidEnd && now > paidEnd;
    const warrantyExpired = warrantyEnd && now > warrantyEnd;
    return (paidExpired || warrantyExpired) && !(paidStart && paidEnd && now >= paidStart && now <= paidEnd) && !(warrantyStart && warrantyEnd && now >= warrantyStart && now <= warrantyEnd);
  }).length;

  // Open tickets (status: open or in_progress)
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');

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
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">На техподдержке</p>
          <p className="text-3xl font-bold text-indigo-600">{linesOnSupport}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Поддержка истекла</p>
          <p className="text-3xl font-bold text-red-500">{linesWithProblems}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Нерешённые заявки</h2>
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
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.status === 'open'
                        ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      }`}>
                      {t.status === 'open' ? 'Открыта' : 'В работе'}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400">{t.reported_at ? new Date(t.reported_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {openTickets.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">Нет открытых заявок</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
