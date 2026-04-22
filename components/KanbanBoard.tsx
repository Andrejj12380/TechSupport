import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SupportTicket } from '../types';
import UserAvatar from './UserAvatar';

interface KanbanBoardProps {
    tickets: SupportTicket[];
    onTicketClick: (ticket: SupportTicket) => void;
    onStatusChange: (ticketId: number, status: string) => Promise<void>;
    onSummarize: (ticketId: number) => void;
    isAiLoading: boolean;
    formatSmartDate: (date: string) => string;
    ticketStatusMap: Map<number, any>;
}

const statusColors: { [key: string]: string } = {
    'in_progress': 'bg-amber-500',
    'on_hold': 'bg-slate-400',
    'solved': 'bg-emerald-500',
    'unsolved': 'bg-red-500'
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

const KanbanBoard = ({ 
    tickets, 
    onTicketClick, 
    onStatusChange, 
    onSummarize, 
    isAiLoading, 
    formatSmartDate,
    ticketStatusMap 
}: KanbanBoardProps) => {
    const [draggedTicket, setDraggedTicket] = useState<SupportTicket | null>(null);
    const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, ticket: SupportTicket) => {
        e.dataTransfer.setData('text/plain', ticket.id.toString());
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => setDraggedTicket(ticket), 0);
    };

    const handleDragOver = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        setDragOverStatus(status);
    };

    const handleDrop = async (e: React.DragEvent, status: string) => {
        e.preventDefault();
        setDragOverStatus(null);
        
        if (draggedTicket && draggedTicket.status !== status) {
            await onStatusChange(draggedTicket.id, status);
        }
        setDraggedTicket(null);
    };

    const handleDragLeave = () => {
        setDragOverStatus(null);
    };

    const KanbanColumn = ({ status, title, columnTickets }: { status: string; title: string; columnTickets: SupportTicket[] }) => (
        <div 
            className={`flex flex-col h-full min-w-[260px] flex-1 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border border-white/10 shrink-0 transition-colors ${dragOverStatus === status ? 'bg-slate-100/80 bg-white/5/80 border-primary/50 ring-2 ring-primary/20' : ''}`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDrop={(e) => handleDrop(e, status)}
            onDragLeave={handleDragLeave}
        >
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/40 bg-white/5/40 rounded-t-3xl backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                    <h3 className="text-xs font-black uppercase tracking-widest text-white/50">{title}</h3>
                    <span className="px-2 py-0.5 glass-card rounded-full text-[10px] font-black text-white/50 shadow-sm">{columnTickets.length}</span>
                </div>
            </div>
            <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                {columnTickets.length === 0 ? (
                    <div className="text-center py-10 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600/50">Нет обращений</div>
                ) : (
                    columnTickets.map(t => (
                        <div 
                            key={t.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, t)}
                            onDragEnd={() => setDraggedTicket(null)}
                            onClick={() => onTicketClick(t)}
                            className={`glass-card p-4 rounded-2xl border border-white/10 shadow-sm hover:shadow-md hover:border-primary/40 dark:hover:border-primary/40 transition-all cursor-grab active:cursor-grabbing group select-none ${t.id === draggedTicket?.id ? 'opacity-50 scale-95 border-primary shadow-inner' : ''}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase text-white/40 tracking-wider">#{t.id} • {t.client_name}</span>
                                <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onSummarize(t.id); }}
                                        className="p-1 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                                        title="AI Summary"
                                        disabled={isAiLoading}
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm font-bold text-slate-800 dark:text-white line-clamp-3 mb-3 leading-snug">{t.problem_description}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-white/70">
                                    {ticketStatusMap.get(t.id)?.label}
                                </span>
                                {(t.attachments?.length ?? 0) > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF5B00]/10 text-[#FF5B00] flex items-center gap-0.5" title={`${t.attachments!.length} вложени${t.attachments!.length === 1 ? 'е' : 'й'}`}>
                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                        {t.attachments!.length}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50 border-white/10/50">
                                <div className="flex items-center gap-2">
                                    <UserAvatar username={t.engineer_name || 'System'} size="sm" />
                                    <span className="text-xs font-semibold text-white/60">{t.engineer_name || 'Не назначен'}</span>
                                </div>
                                <span className="text-[10px] font-medium text-slate-400">{formatSmartDate(t.reported_at || t.created_at)}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="bg-transparent h-[calc(100vh-270px)] min-h-[500px]">
            <div className="flex gap-4 overflow-x-auto h-full pb-4 items-start custom-scrollbar">
                <KanbanColumn status="in_progress" title="В работе" columnTickets={tickets.filter(t => t.status === 'in_progress')} />
                <KanbanColumn status="on_hold" title="В ожидании" columnTickets={tickets.filter(t => t.status === 'on_hold')} />
                <KanbanColumn status="solved" title="Решено" columnTickets={tickets.filter(t => t.status === 'solved')} />
                <KanbanColumn status="unsolved" title="Не решено" columnTickets={tickets.filter(t => t.status === 'unsolved')} />
            </div>
        </div>
    );
};

export default React.memo(KanbanBoard);
