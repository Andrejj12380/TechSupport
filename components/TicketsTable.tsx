import React from 'react';
import { 
    MessageSquare, CheckCircle2, Clock, PauseCircle, AlertCircle, 
    Trash2, Play, Square, Pause 
} from 'lucide-react';
import { SupportTicket, User } from '../types';
import UserAvatar from './UserAvatar';

interface TicketsTableProps {
    tickets: SupportTicket[];
    isLoading: boolean;
    searchQuery: string;
    currentUser: User | null;
    ticketStatusMap: Map<number, any>;
    onTicketClick: (ticket: SupportTicket) => void;
    onDeleteClick: (ticketId: number) => void;
    onStartWork: (ticketId: number) => void;
    onStopWork: (ticketId: number) => void;
    onPauseWork: (ticketId: number) => void;
    formatSmartDate: (date: string) => string;
}

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'solved': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
        case 'in_progress': return <Clock className="w-5 h-5 text-amber-500" />;
        case 'on_hold': return <PauseCircle className="w-5 h-5 text-slate-400" />;
        case 'unsolved': return <AlertCircle className="w-5 h-5 text-red-500" />;
        default: return <MessageSquare className="w-5 h-5 text-slate-400" />;
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'solved': return 'Решено';
        case 'in_progress': return 'В работе';
        case 'unsolved': return 'Не решено';
        case 'on_hold': return 'В ожидании';
        default: return status;
    }
};

const TicketsTable = ({
    tickets,
    isLoading,
    searchQuery,
    currentUser,
    ticketStatusMap,
    onTicketClick,
    onDeleteClick,
    onStartWork,
    onStopWork,
    onPauseWork,
    formatSmartDate
}: TicketsTableProps) => {
    const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'engineer';

    return (
        <div className="glass-card rounded-2xl shadow-sm border border-white/10 overflow-hidden glass-surface md:bg-transparent md:border-none p-0">
            <div className="overflow-x-hidden md:overflow-x-auto relative custom-scrollbar">
                <table className="w-full border-collapse block md:table min-w-full md:min-w-[1200px]">
                    <thead className="hidden md:table-header-group">
                        <tr className="bg-slate-50/50 bg-white/10/50 border-b border-white/10">
                            <th className="px-6 py-4 text-left text-xs font-black text-white/40 uppercase tracking-wider w-[150px]">Дата / Статус</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-white/40 uppercase tracking-wider w-[200px]">Клиент / Линия</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-white/40 uppercase tracking-wider min-w-[300px]">Проблема</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-white/40 uppercase tracking-wider w-[350px]">Инженер / Работа</th>
                            <th className="px-6 py-4 text-right text-xs font-black text-white/40 uppercase tracking-wider w-[80px]">&nbsp;</th>
                        </tr>
                    </thead>
                    <tbody className="block md:table-row-group divide-y divide-white/5 md:divide-slate-50 space-y-4 md:space-y-0 p-4 md:p-0">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i}>
                                <td className="px-6 py-5">
                                    <div className="space-y-2">
                                        <div className="skeleton skeleton-line w-32" />
                                        <div className="skeleton skeleton-line w-24" />
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="space-y-2">
                                        <div className="skeleton skeleton-line w-28" />
                                        <div className="skeleton skeleton-line w-20" />
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="space-y-2">
                                        <div className="skeleton skeleton-line w-full max-w-md" />
                                        <div className="skeleton skeleton-line w-40" />
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="space-y-2">
                                        <div className="skeleton skeleton-line w-24" />
                                        <div className="skeleton skeleton-line w-28" />
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <div className="skeleton skeleton-line w-20 ml-auto" />
                                </td>
                            </tr>
                        ))
                    ) : tickets.length === 0 ? (
                        <tr key="empty">
                            <td colSpan={5} className="px-6 py-24">
                                <div className="flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="w-20 h-20 bg-white/5/50 rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-2xl shadow-black/20 transition-all">
                                        <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 text-white mb-2">Обращений не найдено</h3>
                                    <p className="text-white/50 max-w-sm mx-auto">
                                        {searchQuery ? `По запросу "${searchQuery}" ничего не найдено. Попробуйте изменить параметры фильтрации.` : 'В этом разделе пока нет обращений. Новые появятся здесь автоматически.'}
                                    </p>
                                </div>
                            </td>
                        </tr>
                    ) : tickets.map((ticket) => (
                        <tr
                            key={ticket.id}
                            onClick={() => onTicketClick(ticket)}
                            className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors group cursor-pointer block md:table-row border border-white/10 md:border-none p-4 md:p-0 mb-4 md:mb-0 bg-white/5 md:bg-transparent rounded-3xl md:rounded-none shadow-sm md:shadow-none relative"
                        >
                            <td className="block md:table-cell px-0 py-2 md:px-6 md:py-5">
                                <div className="flex items-center gap-3">
                                    {getStatusIcon(ticket.status)}
                                    <div>
                                        <div className="text-sm font-black text-white">
                                            {formatSmartDate(ticket.reported_at || ticket.created_at)}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                            {getStatusLabel(ticket.status)}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="block md:table-cell px-0 py-2 md:px-6 md:py-5">
                                <div className="flex items-center gap-2">
                                    <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">{ticket.client_name}</div>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase ${ticketStatusMap.get(ticket.id)?.color} border border-current opacity-60`}>
                                        {ticketStatusMap.get(ticket.id)?.label}
                                    </span>
                                </div>
                                <div className="text-xs font-medium text-white/50">{ticket.line_name || '—'}</div>
                            </td>
                            <td className="block md:table-cell px-0 py-2 md:px-6 md:py-5 max-w-md">
                                <div className="text-sm font-bold text-slate-800 dark:text-white line-clamp-1">{ticket.problem_description}</div>
                                <div className="text-xs text-white/40 font-medium">
                                    Контакт: {ticket.contact_name}
                                    <span className="ml-2 px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-bold text-slate-500 uppercase">
                                        {ticket.contact_channel === 'phone' ? '📞 Тел' :
                                         ticket.contact_channel === 'email' ? '📧 Email' :
                                         ticket.contact_channel === 'telegram' ? '✈️ TG' :
                                         ticket.contact_channel === 'max' ? '💬 MAX' : '❓ Другое'}
                                    </span>
                                </div>
                            </td>
                            <td className="block md:table-cell px-0 pt-3 pb-1 mt-2 border-t border-white/10 md:border-none md:mt-0 md:px-6 md:py-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`
                                            w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black
                                            ${ticket.support_line === 1 ? 'bg-blue-100 text-blue-600' :
                                                ticket.support_line === 2 ? 'bg-purple-100 text-purple-600' :
                                                    'bg-red-100 text-red-600'}
                                        `}>
                                            L{ticket.support_line}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <UserAvatar username={ticket.engineer_name || ''} size="sm" />
                                            <span className="text-xs font-bold text-slate-600 text-white/70">{ticket.engineer_name}</span>
                                        </div>
                                    </div>

                                    {isAuthorized && (
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            {ticket.work_started_at ? (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onStopWork(ticket.id); }}
                                                        className="flex items-center gap-1 px-2 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-500/20 transition-all animate-pulse"
                                                    >
                                                        <Square className="w-3 h-3 fill-current" />
                                                        Стоп
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onPauseWork(ticket.id); }}
                                                        className="flex items-center gap-1 px-2 py-1.5 bg-slate-500/10 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-500/20 transition-all"
                                                        title="Пауза"
                                                    >
                                                        <Pause className="w-3 h-3 fill-current" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onStartWork(ticket.id); }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
                                                >
                                                    <Play className="w-3 h-3 fill-current" />
                                                    {ticket.status === 'on_hold' ? 'Продолжить' : 'Начать'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="absolute top-2 right-2 md:static block md:table-cell px-0 py-0 md:px-4 md:py-5 text-center border-none">
                                <div className="flex items-center justify-center gap-2">
                                    {currentUser?.role === 'admin' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteClick(ticket.id); }}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                            title="Удалить"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default React.memo(TicketsTable);
