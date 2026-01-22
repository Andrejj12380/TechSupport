
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Client, Equipment } from '../types';

const Dashboard: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  useEffect(() => {
    const load = async () => {
      setClients(await api.getClients());
      setEquipment(await api.getEquipment());
    };
    load();
  }, []);

  const faultyCount = equipment.filter(e => e.status === 'faulty').length;
  const maintenanceCount = equipment.filter(e => e.status === 'maintenance').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Обзор системы</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Всего клиентов</p>
          <p className="text-3xl font-bold text-[#FF5B00]">{clients.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Оборудования в работе</p>
          <p className="text-3xl font-bold text-green-600">{equipment.length - faultyCount - maintenanceCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">На обслуживании</p>
          <p className="text-3xl font-bold text-amber-500">{maintenanceCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Неисправно</p>
          <p className="text-3xl font-bold text-red-600">{faultyCount}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Последние неисправности</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm">
                <th className="pb-3 font-medium">Модель</th>
                <th className="pb-3 font-medium">Артикул</th>
                <th className="pb-3 font-medium">Статус</th>
                <th className="pb-3 font-medium">Заметки</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {equipment.filter(e => e.status !== 'active').map(e => (
                <tr key={e.id} className="text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{e.model}</td>
                  <td className="py-3">{e.article || '—'}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${e.status === 'faulty' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      }`}>
                      {e.status === 'faulty' ? 'Неисправно' : 'Обслуживание'}
                    </span>
                  </td>
                  <td className="py-3 italic">{e.notes}</td>
                </tr>
              ))}
              {equipment.filter(e => e.status !== 'active').length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">Все оборудование исправно</td>
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
