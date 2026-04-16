import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SupportTicket, Client, ProductionLine, User, TicketCategory } from '../types';
import {
    Search,
    Plus,
    Filter,
    MessageSquare,
    Layout,
    BarChart3,
    Trash2,
    Settings
} from 'lucide-react';
import { useToast } from './Toast';

// Imported Sub-components
import TicketTrendChart from './TicketTrendChart';
import SupportTicketModal from './SupportTicketModal';
import KanbanBoard from './KanbanBoard';
import TicketsTable from './TicketsTable';
import TicketCategoryModal from './TicketCategoryModal';

const getLineStatus = (line: ProductionLine) => {
    const now = new Date();
    const warrantyStart = line.warranty_start_date ? new Date(line.warranty_start_date) : null;
    const isPost2026 = warrantyStart && warrantyStart.getFullYear() >= 2026;

    const supportEnd = warrantyStart ? new Date(warrantyStart) : null;
    if (supportEnd) supportEnd.setMonth(supportEnd.getMonth() + (isPost2026 ? 2 : 12));

    const warrantyEnd = warrantyStart ? new Date(warrantyStart) : null;
    if (warrantyEnd) warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);

    const paidStart = line.paid_support_start_date ? new Date(line.paid_support_start_date) : null;
    const paidEnd = line.paid_support_end_date ? new Date(line.paid_support_end_date) : null;

    const formatRemaining = (endDate: Date) => {
        const diff = endDate.getTime() - now.getTime();
        if (diff < 0) return 'Истекла';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);
        if (days < 30) return `Осталось ${days} дн.`;
        if (months < 12) return `Осталось ${months} мес. ${days % 30} дн.`;
        return `Осталось ${years} г. ${months % 12} мес.`;
    };

    if (paidStart && paidEnd && now >= paidStart && now <= paidEnd) {
        return { status: 'paid', label: 'Техподдержка', color: 'bg-indigo-100 text-indigo-700', remaining: formatRemaining(paidEnd) };
    }
    if (warrantyStart && supportEnd && now >= warrantyStart && now <= supportEnd) {
        return { status: 'warranty', label: isPost2026 ? 'Гарантия + Подд.' : 'Гарантия', color: 'bg-emerald-100 text-emerald-700', remaining: formatRemaining(supportEnd) };
    }
    if (isPost2026 && warrantyEnd && now > supportEnd && now <= warrantyEnd) {
        return { status: 'warranty_only', label: 'Гарантия', color: 'bg-amber-100 text-amber-700', remaining: formatRemaining(warrantyEnd) };
    }
    if ((paidEnd && now > paidEnd) || (warrantyEnd && now > warrantyEnd)) {
        return { status: 'expired', label: 'Истекла', color: 'bg-red-50 text-red-500' };
    }
    return { status: 'none', label: 'Нет', color: 'bg-slate-50 text-slate-400' };
};

const formatSmartDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function SupportTicketManager({ user }: { user: User | null }) {
    const { showToast } = useToast();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null);

    const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
    const [engineers, setEngineers] = useState<User[]>([]);

    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterClient, setFilterClient] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterReportedFrom, setFilterReportedFrom] = useState<string>('');
    const [filterReportedTo, setFilterReportedTo] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [sortDateMode, setSortDateMode] = useState<'reported_at' | 'created_at'>('reported_at');
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isKanbanView, setIsKanbanView] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isChartOpen, setIsChartOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

    const activeFilterCount = [filterClient, filterStatus, filterCategory, filterReportedFrom, filterReportedTo].filter(Boolean).length;

    useEffect(() => {
        fetchData();
        fetchMetadata();
        fetchTicketCategories();
    }, []);

    // Restore Deep Linking logic
    useEffect(() => {
        if (!isLoading) {
            const params = new URLSearchParams(window.location.search);
            const ticketId = params.get('ticketId');
            const newTicket = params.get('newTicket');

            if (newTicket === 'true') {
                setSelectedTicket(null);
                setIsModalOpen(true);
                // Clean up URL
                const url = new URL(window.location.href);
                url.searchParams.delete('newTicket');
                window.history.replaceState({ tab: 'tickets' }, '', url.toString());
            } else if (ticketId && tickets.length > 0) {
                const ticket = tickets.find(t => t.id === parseInt(ticketId));
                if (ticket) {
                    setSelectedTicket(ticket);
                    setIsModalOpen(true);
                    // Clear param to avoid re-opening
                    const url = new URL(window.location.href);
                    url.searchParams.delete('ticketId');
                    window.history.replaceState({ tab: 'tickets' }, '', url.toString());
                }
            }
        }
    }, [isLoading, tickets.length]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const data = await api.getTickets();
            setTickets(data);
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMetadata = async () => {
        try {
            const [clientsData, usersData] = await Promise.all([
                api.getClients(),
                api.getUsers()
            ]);
            setClients(clientsData);
            setEngineers(usersData.filter(u => u.role === 'admin' || u.role === 'engineer'));
        } catch (err) {
            console.error('Error fetching metadata:', err);
        }
    };

    const fetchTicketCategories = async () => {
        try {
            const categories = await api.getTicketCategories();
            setTicketCategories(categories);
        } catch (err) {
            console.error('Error fetching ticket categories:', err);
        }
    };

    const handleSummarize = async (ticketId: number) => {
        setIsAiLoading(true);
        try {
            await api.summarizeTicket(ticketId);
            showToast('Сводка создана (см. консоль)');
        } catch (err) {
            showToast('Ошибка AI', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingTicketId) return;
        try {
            await api.deleteTicket(deletingTicketId);
            setIsDeleteModalOpen(false);
            setDeletingTicketId(null);
            fetchData();
            showToast('Обращение удалено');
        } catch (err) {
            showToast('Ошибка удаления', 'error');
        }
    };

    const handleStatusChange = async (ticketId: number, status: string) => {
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) return;
        try {
            await api.updateTicket(ticketId, { ...ticket, status: status as any });
            await fetchData();
            showToast('Статус обновлен');
        } catch (err) {
            showToast('Ошибка обновления статуса', 'error');
        }
    };

    const handleStartWork = async (ticketId: number) => {
        try {
            const updated = await api.startTicketWork(ticketId);
            setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
        } catch (err) {}
    };

    const handleStopWork = async (ticketId: number) => {
        try {
            const updated = await api.stopTicketWork(ticketId);
            setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
        } catch (err) {}
    };

    const handlePauseWork = async (ticketId: number) => {
        try {
            const updated = await api.pauseTicketWork(ticketId);
            setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
        } catch (err) {}
    };

    const filteredTickets = React.useMemo(() => tickets.filter(t => {
        const matchesStatus = filterStatus ? t.status === filterStatus : true;
        const matchesClient = filterClient ? t.client_id.toString() === filterClient : true;
        const matchesCategory = filterCategory ? t.category_id?.toString() === filterCategory : true;
        const matchesSearch = t.problem_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

        const reportedDate = new Date((t.reported_at as any) || t.created_at);
        const fromOk = filterReportedFrom ? reportedDate >= new Date(filterReportedFrom) : true;
        const toOk = filterReportedTo ? reportedDate <= new Date(filterReportedTo) : true;

        return matchesStatus && matchesClient && matchesCategory && matchesSearch && fromOk && toOk;
    }), [tickets, filterStatus, filterClient, filterCategory, searchQuery, filterReportedFrom, filterReportedTo]);

    const sortedTickets = React.useMemo(() => [...filteredTickets].sort((a, b) => {
        const aKey = new Date(sortDateMode === 'created_at' ? a.created_at : (a.reported_at || a.created_at)).getTime();
        const bKey = new Date(sortDateMode === 'created_at' ? b.created_at : (b.reported_at || b.created_at)).getTime();
        return bKey - aKey;
    }), [filteredTickets, sortDateMode]);

    const ticketStatusMap = React.useMemo(() => {
        const map = new Map<number, any>();
        sortedTickets.forEach(t => {
            const dummyLine: ProductionLine = {
                id: t.line_id || 0,
                site_id: 0,
                name: t.line_name || '',
                description: '',
                mounting_features: '',
                operational_specifics: '',
                warranty_start_date: t.line_warranty_start || t.client_warranty_start,
                paid_support_start_date: t.line_paid_support_start || t.client_paid_support_start,
                paid_support_end_date: t.line_paid_support_end || t.client_paid_support_end
            };
            map.set(t.id, getLineStatus(dummyLine));
        });
        return map;
    }, [sortedTickets]);

    const isAuthorized = user?.role === 'admin' || user?.role === 'engineer';

    return (
        <div className="p-4 md:p-6 max-w-[1600px] 2xl:max-w-full mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <MessageSquare className="w-8 h-8 text-primary" />
                        Журнал обращений
                    </h1>
                    <p className="text-white/50 font-medium mt-1">Фиксация и контроль техподдержки клиентов</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button onClick={() => setIsChartOpen(!isChartOpen)} className={`px-4 py-2 rounded-2xl font-bold transition-all text-sm border flex items-center gap-2 ${isChartOpen ? 'bg-primary/20 border-primary/40 text-primary glass-card' : 'glass-card border-white/10 text-white/70 hover:bg-white/10'}`}>
                        <BarChart3 className="w-4 h-4" /> Аналитика
                    </button>
                    
                    {isAuthorized && (
                        <button onClick={() => setIsCategoryModalOpen(true)} className="p-2.5 rounded-2xl glass-card border-white/10 text-white/70 hover:bg-white/10 transition-all" title="Управление категориями">
                            <Settings className="w-5 h-5" />
                        </button>
                    )}
                    
                    <div className="flex bg-white/10 p-1 rounded-2xl border border-white/10">
                        <button onClick={() => setIsKanbanView(false)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!isKanbanView ? 'bg-white/10 text-primary shadow-sm' : 'text-slate-400'}`}> Список </button>
                        <button onClick={() => setIsKanbanView(true)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isKanbanView ? 'bg-white/10 text-primary shadow-sm' : 'text-slate-400'}`}> Канбан </button>
                    </div>

                    {isAuthorized && (
                        <button onClick={() => { setSelectedTicket(null); setIsModalOpen(true); }} className="bg-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg active:scale-95">
                            <Plus className="w-5 h-5" /> Новое обращение
                        </button>
                    )}
                </div>
            </div>

            {isChartOpen && <TicketTrendChart tickets={filteredTickets} />}

            <div className="glass-card rounded-2xl p-3 md:p-4 border border-white/10 mb-4 glass-surface">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-900/40 border-none rounded-xl text-sm text-white focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <button onClick={() => setIsFiltersOpen(!isFiltersOpen)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${isFiltersOpen || activeFilterCount > 0 ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-900/40 text-white/50'}`}>
                        <Filter className="w-4 h-4" /> Фильтры {activeFilterCount > 0 && <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">{activeFilterCount}</span>}
                    </button>
                </div>

                <div className={`expand-grid ${isFiltersOpen ? 'is-open' : ''}`}>
                    <div className="expand-inner">
                        <div className="flex flex-wrap items-center gap-3 pt-3 mt-3 border-t border-white/10">
                            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="bg-white/5 border-none rounded-xl py-2 px-4 text-sm text-white/70">
                                <option value="">Все клиенты</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white/5 border-none rounded-xl py-2 px-4 text-sm text-white/70">
                                <option value="">Все статусы</option>
                                <option value="in_progress">В работе</option>
                                <option value="solved">Решено</option>
                            </select>
                            {activeFilterCount > 0 && <button onClick={() => { setFilterClient(''); setFilterStatus(''); setFilterCategory(''); setFilterReportedFrom(''); setFilterReportedTo(''); }} className="text-xs font-bold text-primary ml-auto">Сброс</button>}
                        </div>
                    </div>
                </div>
            </div>

            {isKanbanView ? (
                <KanbanBoard tickets={sortedTickets} onTicketClick={(t) => { setSelectedTicket(t); setIsModalOpen(true); }} onStatusChange={handleStatusChange} onSummarize={handleSummarize} isAiLoading={isAiLoading} formatSmartDate={formatSmartDate} ticketStatusMap={ticketStatusMap} />
            ) : (
                <TicketsTable tickets={sortedTickets} isLoading={isLoading} searchQuery={searchQuery} currentUser={user} ticketStatusMap={ticketStatusMap} onTicketClick={(t) => { setSelectedTicket(t); setIsModalOpen(true); }} onDeleteClick={(id) => { setDeletingTicketId(id); setIsDeleteModalOpen(true); }} onStartWork={handleStartWork} onStopWork={handleStopWork} onPauseWork={handlePauseWork} formatSmartDate={formatSmartDate} />
            )}

            <SupportTicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSaved={fetchData} ticket={selectedTicket} clients={clients} engineers={engineers} categories={ticketCategories} currentUser={user} />

            <TicketCategoryModal 
                isOpen={isCategoryModalOpen} 
                onClose={() => setIsCategoryModalOpen(false)} 
                onChanged={fetchTicketCategories} 
                currentUser={user} 
            />

            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="glass-card rounded-[2rem] p-8 max-w-sm w-full text-center border border-white/10">
                        <h3 className="text-xl font-bold text-white mb-6">Удалить обращение?</h3>
                        <div className="flex gap-3">
                            <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-white/10 text-white rounded-2xl">Отмена</button>
                            <button onClick={handleDelete} className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl">Удалить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
