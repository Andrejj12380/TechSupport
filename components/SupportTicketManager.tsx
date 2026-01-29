import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SupportTicket, Client, ProductionLine, User } from '../types';
import {
    Search,
    Plus,
    Filter,
    CheckCircle2,
    Clock,
    AlertCircle,
    Trash2,
    Edit2,
    ChevronRight,
    User as UserIcon,
    Building2,
    Settings,
    MoreVertical,
    MessageSquare,
    Check,
    X,
    Play,
    Square
} from 'lucide-react';
import UserAvatar from './UserAvatar';

interface SupportTicketManagerProps {
    user: User | null;
}

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

export default function SupportTicketManager({ user }: SupportTicketManagerProps) {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [lines, setLines] = useState<ProductionLine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null);

    // State for form data
    const [formData, setFormData] = useState<Partial<SupportTicket>>({
        client_id: 0,
        line_id: null,
        contact_name: '',
        problem_description: '',
        solution_description: '',
        status: 'open',
        support_line: 1,
        reported_at: '',
        resolved_at: ''
    });

    // Debounced search for similar tickets
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (formData.problem_description && formData.problem_description.length > 5) {
                setIsSearching(true);
                try {
                    const results = await api.analyzeTicket(formData.problem_description);
                    setSuggestions(results);
                } catch (err) {
                    console.error('Error analyzing ticket:', err);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSuggestions([]);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [formData.problem_description]);



    // UX state for saving and errors
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterClient, setFilterClient] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchData();
        fetchMetadata();
    }, []);

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
            const clientsData = await api.getClients();
            setClients(clientsData);
        } catch (err) {
            console.error('Error fetching metadata:', err);
        }
    };

    // Helper for datetime-local inputs
    const pad = (n: number) => String(n).padStart(2, '0');
    const toInputLocal = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const toISOStringFromInput = (val?: string) => {
        if (!val) return null;
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    };

    const handleClientChange = async (clientId: number) => {
        setFormData({ ...formData, client_id: clientId, line_id: null });
        if (clientId) {
            try {
                const client = clients.find(c => c.id === clientId);
                if (client) {
                    const linesData = await api.getProductionLines(clientId);
                    setLines(linesData);
                }
            } catch (err) {
                console.error('Error fetching lines:', err);
            }
        } else {
            setLines([]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        // Basic client-side validation
        if (!formData.client_id || Number(formData.client_id) <= 0) {
            setFormError('Выберите клиента');
            return;
        }
        if (!formData.contact_name || formData.contact_name.trim() === '') {
            setFormError('Укажите контактное лицо');
            return;
        }
        if (!formData.problem_description || formData.problem_description.trim() === '') {
            setFormError('Опишите проблему');
            return;
        }

        setIsSaving(true);
        try {
            // Convert local datetime-local strings to ISO before sending
            const payload: Partial<SupportTicket> = {
                ...formData,
                // ensure client_id and line_id are proper types
                client_id: typeof formData.client_id === 'string' ? Number(formData.client_id) : formData.client_id,
                line_id: formData.line_id ? (typeof formData.line_id === 'string' ? Number(formData.line_id) : formData.line_id) : null,
                reported_at: toISOStringFromInput(formData.reported_at as string) || undefined,
                resolved_at: toISOStringFromInput(formData.resolved_at as string) || undefined
            };

            if (selectedTicket) {
                await api.updateTicket(selectedTicket.id, payload);
            } else {
                await api.createTicket(payload);
            }

            setIsModalOpen(false);
            fetchData();
            resetForm();
        } catch (err: any) {
            console.error('Error saving ticket:', err);
            setFormError(err?.message || 'Ошибка при сохранении');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingTicketId) return;
        try {
            await api.deleteTicket(deletingTicketId);
            setIsDeleteModalOpen(false);
            setDeletingTicketId(null);
            fetchData();
        } catch (err) {
            console.error('Error deleting ticket:', err);
        }
    };

    const resetForm = () => {
        setFormData({
            client_id: 0,
            line_id: null,
            contact_name: '',
            problem_description: '',
            solution_description: '',
            status: 'open',
            support_line: 1,
            reported_at: '',
            resolved_at: ''
        });
        setSelectedTicket(null);
        setLines([]);
    };

    const openEditModal = async (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        setFormData({
            client_id: ticket.client_id,
            line_id: ticket.line_id,
            contact_name: ticket.contact_name,
            problem_description: ticket.problem_description,
            solution_description: ticket.solution_description || '',
            status: ticket.status,
            support_line: ticket.support_line,
            reported_at: toInputLocal(ticket.reported_at || ticket.created_at),
            resolved_at: toInputLocal(ticket.resolved_at || '')
        });

        // Fetch lines for the client
        try {
            const linesData = await api.getProductionLines(ticket.client_id);
            setLines(linesData);
        } catch (err) {
            console.error('Error fetching lines:', err);
        }

        setIsModalOpen(true);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'solved': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'in_progress': return <Clock className="w-5 h-5 text-amber-500" />;
            case 'unsolved': return <AlertCircle className="w-5 h-5 text-red-500" />;
            default: return <MessageSquare className="w-5 h-5 text-slate-400" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'solved': return 'Решено';
            case 'in_progress': return 'В работе';
            case 'unsolved': return 'Не решено';
            case 'open': return 'Открыто';
            default: return status;
        }
    };

    const getTicketSupportStatus = (t: SupportTicket) => {
        // Create a dummy ProductionLine object to use the existing status logic
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

        const status = getLineStatus(dummyLine);
        return status;
    };

    const handleStartWork = async (ticketId: number) => {
        try {
            await api.startTicketWork(ticketId);
            fetchData();
        } catch (err) {
            console.error('Error starting work:', err);
        }
    };

    const handleStopWork = async (ticketId: number) => {
        try {
            await api.stopTicketWork(ticketId);
            fetchData();
        } catch (err) {
            console.error('Error stopping work:', err);
        }
    };

    const filteredTickets = tickets.filter(t => {
        const matchesStatus = filterStatus ? t.status === filterStatus : true;
        const matchesClient = filterClient ? t.client_id.toString() === filterClient : true;
        const matchesSearch = t.problem_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesClient && matchesSearch;
    });

    const isAuthorized = user?.role === 'admin' || user?.role === 'engineer';
    const isViewer = user?.role === 'viewer';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <MessageSquare className="w-8 h-8 text-[#FF5B00]" />
                        Журнал обращений
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Фиксация и контроль техподдержки клиентов</p>
                </div>

                {isAuthorized && (
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="bg-[#FF5B00] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#e65200] transition-all shadow-lg shadow-[#FF5B00]/25 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Новое обращение
                    </button>
                )}
            </div>

            {/* Filters & Search */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-6 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Поиск по проблеме, клиенту или контакту..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-slate-900 font-medium focus:ring-2 focus:ring-[#FF5B00]/20 transition-all"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-400 ml-2" />
                    <select
                        value={filterClient}
                        onChange={(e) => setFilterClient(e.target.value)}
                        className="bg-slate-50 border-none rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-[#FF5B00]/20 min-w-[180px]"
                    >
                        <option value="">Все клиенты</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-50 border-none rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-[#FF5B00]/20 min-w-[150px]"
                    >
                        <option value="">Все статусы</option>
                        <option value="open">Открыто</option>
                        <option value="in_progress">В работе</option>
                        <option value="solved">Решено</option>
                        <option value="unsolved">Не решено</option>
                    </select>
                </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Дата / Статус</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Клиент / Линия</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Проблема</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Линия ТП / Инженер</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8 h-20 bg-slate-50/20"></td>
                                    </tr>
                                ))
                            ) : filteredTickets.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                <MessageSquare className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <p className="text-slate-400 font-bold">Обращений не найдено</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredTickets.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            {getStatusIcon(ticket.status)}
                                            <div>
                                                <div className="text-sm font-black text-slate-900">
                                                    {new Date(ticket.reported_at || ticket.created_at).toLocaleString('ru-RU')}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1.5 flex-wrap">
                                                    <span>{getStatusLabel(ticket.status)}</span>
                                                    {ticket.resolved_at && <span> • Решено: {new Date(ticket.resolved_at).toLocaleString('ru-RU')}</span>}
                                                    <span className={`px-1.5 py-0.5 rounded-md ${getTicketSupportStatus(ticket).color} border border-current opacity-70`}>
                                                        {getTicketSupportStatus(ticket).label}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-bold text-slate-900 group-hover:text-[#FF5B00] transition-colors">{ticket.client_name}</div>
                                        <div className="text-xs font-medium text-slate-500">{ticket.line_name || '—'}</div>
                                    </td>
                                    <td className="px-6 py-5 max-w-md">
                                        <div className="text-sm font-bold text-slate-700 line-clamp-1">{ticket.problem_description}</div>
                                        <div className="text-xs text-slate-400 font-medium">Контакт: {ticket.contact_name}</div>
                                    </td>
                                    <td className="px-6 py-5">
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
                                                <span className="text-xs font-bold text-slate-600">{ticket.engineer_name}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {isAuthorized && !['paid', 'warranty'].includes(getTicketSupportStatus(ticket).status) && (
                                                <div className="flex items-center gap-2 border-r border-slate-100 pr-3 mr-1">
                                                    {ticket.work_started_at ? (
                                                        <button
                                                            onClick={() => handleStopWork(ticket.id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-all animate-pulse"
                                                        >
                                                            <Square className="w-3 h-3 fill-current" />
                                                            Стоп
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartWork(ticket.id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all"
                                                        >
                                                            <Play className="w-3 h-3 fill-current" />
                                                            Начать
                                                        </button>
                                                    )}
                                                    {ticket.total_work_minutes > 0 && (
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            ⏱ {ticket.total_work_minutes} мин
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {isAuthorized && (
                                                <button
                                                    onClick={() => openEditModal(ticket)}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                    title="Редактировать"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            {user?.role === 'admin' && (
                                                <button
                                                    onClick={() => { setDeletingTicketId(ticket.id); setIsDeleteModalOpen(true); }}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Удалить"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={async () => await openEditModal(ticket)}
                                                className="p-2 text-slate-400 hover:text-[#FF5B00] hover:bg-[#FF5B00]/5 rounded-xl transition-all"
                                                title="Посмотреть детали"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="p-8 pb-4 flex justify-between items-center shrink-0 border-b border-slate-50">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                {selectedTicket ? <Edit2 className="w-6 h-6 text-[#FF5B00]" /> : <Plus className="w-6 h-6 text-[#FF5B00]" />}
                                {selectedTicket ? 'Редактировать обращение' : 'Новое обращение'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 pt-4 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Building2 className="w-3 h-3" /> Клиент
                                    </label>
                                    <select
                                        required
                                        disabled={isViewer}
                                        value={formData.client_id}
                                        onChange={(e) => handleClientChange(Number(e.target.value))}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                    >
                                        <option value="">Выберите клиента</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Settings className="w-3 h-3" /> Линия оборудования
                                    </label>
                                    <select
                                        disabled={isViewer}
                                        value={formData.line_id || ''}
                                        onChange={(e) => setFormData({ ...formData, line_id: e.target.value ? Number(e.target.value) : null })}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                    >
                                        <option value="">Не привязано</option>
                                        {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <UserIcon className="w-3 h-3" /> Контактное лицо
                                    </label>
                                    <input
                                        required
                                        disabled={isViewer}
                                        type="text"
                                        value={formData.contact_name}
                                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                        placeholder="Имя / Фамилия заявителя"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Линия техподдержки</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map(num => (
                                            <button
                                                key={num}
                                                type="button"
                                                disabled={isViewer}
                                                onClick={() => setFormData({ ...formData, support_line: num as any })}
                                                className={`
                                                        flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all
                                                        ${formData.support_line === num
                                                        ? (num === 1 ? 'bg-blue-500 text-white' : num === 2 ? 'bg-purple-500 text-white' : 'bg-red-500 text-white')
                                                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}
                                                        ${isViewer ? 'cursor-not-allowed' : ''}
                                                    `}
                                            >
                                                {num}-я
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Дата / время обращения</label>
                                    <input
                                        type="datetime-local"
                                        disabled={isViewer}
                                        value={formData.reported_at || ''}
                                        onChange={(e) => setFormData({ ...formData, reported_at: e.target.value })}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Дата / время решения</label>
                                    <input
                                        type="datetime-local"
                                        disabled={isViewer}
                                        value={formData.resolved_at || ''}
                                        onChange={(e) => setFormData({ ...formData, resolved_at: e.target.value })}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Описание проблемы</label>
                                <textarea
                                    required
                                    disabled={isViewer}
                                    value={formData.problem_description}
                                    onChange={(e) => setFormData({ ...formData, problem_description: e.target.value })}
                                    className={`w-full h-32 px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-[#FF5B00] rounded-3xl outline-none font-medium text-slate-700 transition-all resize-none ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    placeholder="Подробно опишите возникшую проблему..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Решение (если есть)</label>
                                    <textarea
                                        disabled={isViewer}
                                        value={formData.solution_description || ''}
                                        onChange={(e) => setFormData({ ...formData, solution_description: e.target.value })}
                                        className={`w-full h-48 px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-[#FF5B00] rounded-3xl outline-none font-medium text-slate-700 transition-all resize-none ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                        placeholder="Опишите принятые меры или итоговое решение..."
                                    />
                                </div>

                                {/* Smart Suggestions Sidebar */}
                                <div className={`space-y-4 border-l pl-6 border-slate-100 ${suggestions.length > 0 ? 'block' : 'hidden md:block'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-blue-50 rounded-lg">
                                            <Search className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800">Похожие решения</h3>
                                        {isSearching && <span className="text-xs text-slate-400 animate-pulse">Ищем...</span>}
                                    </div>

                                    <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                        {suggestions.length > 0 ? suggestions.map((s, i) => (
                                            <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full">{Math.round(s.relevance * 100)}% совпадение</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, solution_description: s.resolution_details })}
                                                        className="text-[10px] font-bold text-slate-400 hover:text-[#FF5B00] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        Использовать
                                                    </button>
                                                </div>
                                                <p className="text-xs font-bold text-slate-800 mb-1 line-clamp-2" title={s.problem_description}>{s.problem_description}</p>
                                                <div className="text-xs text-slate-500 bg-white p-2 rounded-xl border border-slate-100">
                                                    {s.resolution_details}
                                                </div>
                                                <div className="mt-2 text-[10px] text-slate-400 font-medium flex gap-2">
                                                    <span>{s.line_name}</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-8 text-slate-400 text-xs font-medium">
                                                {formData.problem_description?.length > 5 ? 'Похожих решений не найдено' : 'Начните описывать проблему, чтобы увидеть подсказки'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 pt-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Статус</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['open', 'in_progress', 'solved', 'unsolved'].map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                disabled={isViewer}
                                                onClick={() => setFormData({ ...formData, status: s as any })}
                                                className={`
                                                        px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all
                                                        ${formData.status === s
                                                        ? (s === 'solved' ? 'bg-emerald-500 text-white' : s === 'in_progress' ? 'bg-amber-500 text-white' : s === 'unsolved' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white')
                                                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}
                                                        ${isViewer ? 'cursor-not-allowed' : ''}
                                                    `}
                                            >
                                                {getStatusLabel(s)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-end justify-end gap-3">
                                    {formError && (
                                        <div className="text-red-500 text-sm font-bold mr-auto mb-3 sm:mb-0">{formError}</div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            disabled={isSaving}
                                            className={`px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isViewer ? 'w-full' : ''}`}
                                        >
                                            {isViewer ? 'Закрыть' : 'Отмена'}
                                        </button>
                                        {!isViewer && (
                                            <button
                                                type="submit"
                                                disabled={isSaving}
                                                className="bg-[#FF5B00] text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-[#FF5B00]/30 hover:shadow-xl hover:bg-[#e65200] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isSaving ? 'Сохранение...' : (selectedTicket ? 'Сохранить изменения' : 'Создать запись')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-sm w-full text-center border border-slate-100 dark:border-slate-800">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Удалить обращение?</h3>
                        <p className="text-slate-500 font-medium mb-6">Это действие нельзя отменить. Запись будет навсегда удалена из журнала.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 py-4 bg-slate-50 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
