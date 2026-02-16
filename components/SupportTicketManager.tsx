import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SupportTicket, Client, ProductionLine, User, TicketCategory, SiteContact } from '../types';
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
    Square,
    Pause,
    PauseCircle
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import { useToast } from './Toast';

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

export default function SupportTicketManager({ user }: SupportTicketManagerProps) {
    const { showToast } = useToast();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [lines, setLines] = useState<ProductionLine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null);
    const [availableContacts, setAvailableContacts] = useState<SiteContact[]>([]);

    const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<TicketCategory | null>(null);
    const [categoryForm, setCategoryForm] = useState<{ name: string; description: string; sort_order: number; is_active: boolean }>({
        name: '',
        description: '',
        sort_order: 0,
        is_active: true
    });

    // State for form data
    const [formData, setFormData] = useState<Partial<SupportTicket>>({
        client_id: 0,
        line_id: null,
        contact_name: '',
        problem_description: '',
        solution_description: '',
        status: 'in_progress',
        support_line: 1,
        category_id: null,
        reported_at: '',
        resolved_at: ''
    });



    // UX state for saving and errors
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterClient, setFilterClient] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterReportedFrom, setFilterReportedFrom] = useState<string>('');
    const [filterReportedTo, setFilterReportedTo] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [engineers, setEngineers] = useState<User[]>([]);
    const [sortDateMode, setSortDateMode] = useState<'reported_at' | 'created_at'>('reported_at');

    useEffect(() => {
        fetchData();
        fetchMetadata();
        fetchTicketCategories();

        // Handle deep linking for filters
        const params = new URLSearchParams(window.location.search);
        const catId = params.get('category');
        const status = params.get('status');
        if (catId) setFilterCategory(catId);
        if (status) setFilterStatus(status);
    }, []);

    // Effect to handle deep linking to a specific ticket
    useEffect(() => {
        if (!isLoading && tickets.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const ticketId = params.get('ticketId');
            if (ticketId) {
                const ticket = tickets.find(t => t.id === parseInt(ticketId));
                if (ticket) {
                    openEditModal(ticket);
                    // Clear param to avoid re-opening on manual refresh or back navigation
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

                    // Fetch sites to get contacts for this client
                    const sitesData = await api.getSites(clientId);
                    const contacts = sitesData.flatMap(s => s.contacts || []);
                    setAvailableContacts(contacts);
                }
            } catch (err) {
                console.error('Error fetching lines/contacts:', err);
            }
        } else {
            setLines([]);
            setAvailableContacts([]);
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
        if (!formData.category_id) {
            setFormError('Выберите категорию проблемы');
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
                resolved_at: toISOStringFromInput(formData.resolved_at as string) || undefined,
                category_id: formData.category_id ? (typeof formData.category_id === 'string' ? Number(formData.category_id) : formData.category_id) : null
            };

            if (selectedTicket) {
                await api.updateTicket(selectedTicket.id, payload);
            } else {
                await api.createTicket(payload);
            }

            setIsModalOpen(false);
            fetchData();
            resetForm();
            showToast(selectedTicket ? 'Обращение обновлено' : 'Обращение создано');
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
            showToast('Обращение удалено', 'info');
        } catch (err) {
            console.error('Error deleting ticket:', err);
        }
    };

    const resetForm = () => {
        const unknownCategoryId = ticketCategories.find(c => c.name.toLowerCase() === 'не известно')?.id || null;
        setFormData({
            client_id: 0,
            line_id: null,
            contact_name: '',
            problem_description: '',
            solution_description: '',
            status: 'in_progress',
            support_line: 1,
            category_id: unknownCategoryId,
            reported_at: '',
            resolved_at: ''
        });
        setSelectedTicket(null);
        setLines([]);
        setAvailableContacts([]);
    };

    const openEditModal = async (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        setFormData({
            client_id: ticket.client_id,
            line_id: ticket.line_id,
            user_id: ticket.user_id,
            contact_name: ticket.contact_name,
            problem_description: ticket.problem_description,
            solution_description: ticket.solution_description || '',
            status: ticket.status,
            support_line: ticket.support_line,
            category_id: ticket.category_id,
            reported_at: ticket.reported_at || '',
            resolved_at: ticket.resolved_at || ''
        });

        // Fetch lines and contacts for the client
        try {
            const linesData = await api.getProductionLines(ticket.client_id);
            setLines(linesData);

            const sitesData = await api.getSites(ticket.client_id);
            const contacts = sitesData.flatMap(s => s.contacts || []);
            setAvailableContacts(contacts);
        } catch (err) {
            console.error('Error fetching lines/contacts:', err);
        }

        setIsModalOpen(true);
    };

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

    const handlePauseWork = async (ticketId: number) => {
        try {
            await api.pauseTicketWork(ticketId);
            fetchData();
        } catch (err) {
            console.error('Error pausing work:', err);
        }
    };

    const filteredTickets = tickets.filter(t => {
        const matchesStatus = filterStatus ? t.status === filterStatus : true;
        const matchesClient = filterClient ? t.client_id.toString() === filterClient : true;
        const matchesCategory = filterCategory ? t.category_id?.toString() === filterCategory : true;
        const matchesSearch = t.problem_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.client_name?.toLowerCase().includes(searchQuery.toLowerCase());

        const reportedDate = new Date((t.reported_at as any) || t.created_at);
        const fromOk = filterReportedFrom
            ? reportedDate.getTime() >= new Date(`${filterReportedFrom}T00:00:00`).getTime()
            : true;
        const toOk = filterReportedTo
            ? reportedDate.getTime() <= new Date(`${filterReportedTo}T23:59:59.999`).getTime()
            : true;

        return matchesStatus && matchesClient && matchesCategory && matchesSearch && fromOk && toOk;
    });

    const sortedTickets = filteredTickets
        .slice()
        .sort((a, b) => {
            const aKey = sortDateMode === 'created_at'
                ? new Date(a.created_at as any).getTime()
                : new Date((a.reported_at as any) || a.created_at).getTime();
            const bKey = sortDateMode === 'created_at'
                ? new Date(b.created_at as any).getTime()
                : new Date((b.reported_at as any) || b.created_at).getTime();
            return bKey - aKey;
        });

    const isAuthorized = user?.role === 'admin' || user?.role === 'engineer';
    const isViewer = user?.role === 'viewer';

    const openCategoryModal = () => {
        setEditingCategory(null);
        setCategoryForm({ name: '', description: '', sort_order: 0, is_active: true });
        setIsCategoryModalOpen(true);
    };

    const openEditCategoryModal = (cat: TicketCategory) => {
        setEditingCategory(cat);
        setCategoryForm({
            name: cat.name,
            description: cat.description || '',
            sort_order: cat.sort_order,
            is_active: cat.is_active
        });
        setIsCategoryModalOpen(true);
    };

    const saveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCategory) {
                await api.updateTicketCategory(editingCategory.id, categoryForm);
            } else {
                await api.createTicketCategory(categoryForm);
            }
            await fetchTicketCategories();
            setEditingCategory(null);
            setCategoryForm({ name: '', description: '', sort_order: 0, is_active: true });
        } catch (err) {
            console.error('Error saving category:', err);
        }
    };

    const deleteCategory = async (id: number) => {
        try {
            await api.deleteTicketCategory(id);
            await fetchTicketCategories();
        } catch (err) {
            console.error('Error deleting category:', err);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <MessageSquare className="w-8 h-8 text-[#FF5B00]" />
                        Журнал обращений
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Фиксация и контроль техподдержки клиентов</p>
                </div>

                <div className="flex items-center gap-3 self-start md:self-auto">
                    {user?.role === 'admin' && (
                        <button
                            onClick={openCategoryModal}
                            className="px-4 py-2 rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-sm"
                        >
                            Категории проблем
                        </button>
                    )}

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
            </div>

            {/* Filters & Search */}
            <div className="bg-white rounded-3xl p-3 md:p-4 shadow-sm border border-slate-100 mb-4 flex flex-wrap items-center gap-3 md:gap-4">
                <div className="relative flex-1 min-w-[200px] sm:min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Поиск по проблеме, клиенту или контакту..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-slate-900 font-medium focus:ring-2 focus:ring-[#FF5B00]/20 transition-all"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <Filter className="w-5 h-5 text-slate-400 ml-2" />
                    <select
                        value={filterClient}
                        onChange={(e) => setFilterClient(e.target.value)}
                        className="bg-slate-50 border-none rounded-2xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-[#FF5B00]/20 min-w-0 flex-1 sm:flex-none sm:min-w-[180px] w-full sm:w-auto text-sm"
                    >
                        <option value="">Все клиенты</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-50 border-none rounded-2xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-[#FF5B00]/20 min-w-[150px] w-full sm:w-auto"
                    >
                        <option value="">Все статусы</option>
                        <option value="in_progress">В работе</option>
                        <option value="on_hold">В ожидании</option>
                        <option value="solved">Решено</option>
                        <option value="unsolved">Не решено</option>
                    </select>

                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-slate-50 border-none rounded-2xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-[#FF5B00]/20 min-w-[150px] w-full sm:w-auto"
                    >
                        <option value="">Все категории</option>
                        {ticketCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>

                    <input
                        type="date"
                        value={filterReportedFrom}
                        onChange={(e) => setFilterReportedFrom(e.target.value)}
                        className="bg-slate-50 border-none rounded-2xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-[#FF5B00]/20 w-full sm:w-auto"
                        title="Дата обращения: с"
                    />
                    <input
                        type="date"
                        value={filterReportedTo}
                        onChange={(e) => setFilterReportedTo(e.target.value)}
                        className="bg-slate-50 border-none rounded-2xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-[#FF5B00]/20 w-full sm:w-auto"
                        title="Дата обращения: по"
                    />

                    <select
                        value={sortDateMode}
                        onChange={(e) => setSortDateMode(e.target.value as any)}
                        className="bg-slate-50 border-none rounded-2xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-[#FF5B00]/20 min-w-[200px] w-full sm:w-auto"
                        title="Сортировка"
                    >
                        <option value="reported_at">Сортировать по дате обращения</option>
                        <option value="created_at">Сортировать по дате добавления</option>
                    </select>
                </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Дата / Статус</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Клиент / Линия</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Проблема</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Линия ТП / Инженер</th>
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
                            ) : sortedTickets.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-24">
                                        <div className="flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all">
                                                <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Обращений не найдено</h3>
                                            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                                {searchQuery ? `По запросу "${searchQuery}" ничего не найдено. Попробуйте изменить параметры фильтрации.` : 'В этом разделе пока нет обращений. Новые появятся здесь автоматически.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : sortedTickets.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            {getStatusIcon(ticket.status)}
                                            <div>
                                                <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                                                    {formatSmartDate(ticket.reported_at || ticket.created_at)}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1.5 flex-wrap">
                                                    <span>{getStatusLabel(ticket.status)}</span>
                                                    {ticket.resolved_at && <span> • Решено: {formatSmartDate(ticket.resolved_at)}</span>}
                                                    <span className={`px-1.5 py-0.5 rounded-md ${getTicketSupportStatus(ticket).color} border border-current opacity-70`}>
                                                        {getTicketSupportStatus(ticket).label}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#FF5B00] transition-colors">{ticket.client_name}</div>
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{ticket.line_name || '—'}</div>
                                    </td>
                                    <td className="px-6 py-5 max-w-md">
                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{ticket.problem_description}</div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">Контакт: {ticket.contact_name}</div>
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
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{ticket.engineer_name}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end gap-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            {isAuthorized && !['paid', 'warranty'].includes(getTicketSupportStatus(ticket).status) && (
                                                <div className="flex items-center gap-2 border-r border-slate-100 pr-3 mr-1">
                                                    {ticket.work_started_at ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                onClick={() => handleStopWork(ticket.id)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-all animate-pulse"
                                                            >
                                                                <Square className="w-3 h-3 fill-current" />
                                                                Стоп
                                                            </button>
                                                            <button
                                                                onClick={() => handlePauseWork(ticket.id)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-100 transition-all"
                                                                title="Пауза"
                                                            >
                                                                <Pause className="w-3 h-3 fill-current" />
                                                                Пауза
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartWork(ticket.id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all"
                                                        >
                                                            <Play className="w-3 h-3 fill-current" />
                                                            {ticket.status === 'on_hold' ? 'Продолжить' : 'Начать'}
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="p-8 pb-4 flex justify-between items-center shrink-0 border-b border-slate-50 dark:border-slate-700">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-3">
                                {selectedTicket ? <Edit2 className="w-6 h-6 text-[#FF5B00]" /> : <Plus className="w-6 h-6 text-[#FF5B00]" />}
                                {selectedTicket ? 'Редактировать обращение' : 'Новое обращение'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 pt-4 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Building2 className="w-3 h-3" /> Клиент
                                    </label>
                                    <select
                                        required
                                        disabled={isViewer}
                                        value={formData.client_id}
                                        onChange={(e) => handleClientChange(Number(e.target.value))}
                                        className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
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
                                        className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                    >
                                        <option value="">Не привязано</option>
                                        {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Категория проблемы</label>
                                    <select
                                        required
                                        disabled={isViewer}
                                        value={formData.category_id ?? ''}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value ? Number(e.target.value) : null })}
                                        className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                    >
                                        <option value="">Выберите категорию</option>
                                        {ticketCategories
                                            .filter(c => c.is_active || c.id === formData.category_id)
                                            .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <UserIcon className="w-3 h-3" /> Контактное лицо
                                    </label>
                                    <input
                                        required
                                        disabled={isViewer}
                                        type="text"
                                        list="contact-suggestions"
                                        value={formData.contact_name}
                                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                        className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                        placeholder="Имя / Фамилия заявителя"
                                    />
                                    <datalist id="contact-suggestions">
                                        {Array.from(new Set(availableContacts.map(c => c.fio))).sort().map(fio => (
                                            <option key={fio} value={fio} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Линия техподдержки</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map(line => (
                                            <button
                                                key={line}
                                                type="button"
                                                disabled={isViewer}
                                                onClick={() => setFormData({ ...formData, support_line: line as any })}
                                                className={`
                                                    flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all
                                                    ${formData.support_line === line
                                                        ? (line === 1 ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' :
                                                            line === 2 ? 'bg-purple-500 text-white shadow-lg shadow-purple-200' :
                                                                'bg-red-500 text-white shadow-lg shadow-red-200')
                                                        : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'}
                                                `}
                                            >
                                                L{line}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <AlertCircle className="w-3 h-3" /> Описание проблемы
                                </label>
                                <textarea
                                    required
                                    disabled={isViewer}
                                    value={formData.problem_description}
                                    onChange={(e) => setFormData({ ...formData, problem_description: e.target.value })}
                                    className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 transition-all min-h-[100px] ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    placeholder="Подробно опишите суть обращения клиента..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <CheckCircle2 className="w-3 h-3" /> Принятые меры / Решение
                                </label>
                                <textarea
                                    disabled={isViewer}
                                    value={formData.solution_description}
                                    onChange={(e) => setFormData({ ...formData, solution_description: e.target.value })}
                                    className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 transition-all min-h-[100px] ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    placeholder="Опишите принятые меры или итоговое решение..."
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Инженер</label>
                                    <select
                                        disabled={isViewer || (user?.role !== 'admin' && !!selectedTicket?.id)}
                                        value={formData.user_id || ''}
                                        onChange={(e) => setFormData({ ...formData, user_id: Number(e.target.value) })}
                                        className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    >
                                        <option value="">Выберите инженера</option>
                                        {engineers.map(eng => (
                                            <option key={eng.id} value={eng.id}>{eng.username}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Статус</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['in_progress', 'on_hold', 'solved', 'unsolved'].map(status => (
                                            <button
                                                key={status}
                                                type="button"
                                                disabled={isViewer}
                                                onClick={() => setFormData({ ...formData, status: status as any })}
                                                className={`
                                                    px-4 py-2 rounded-xl text-xs font-bold transition-all
                                                    ${formData.status === status
                                                        ? 'bg-[#FF5B00] text-white shadow-lg shadow-[#FF5B00]/25'
                                                        : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}
                                                `}
                                            >
                                                {getStatusLabel(status)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Дата и время обращения</label>
                                    <input
                                        disabled={isViewer}
                                        type="datetime-local"
                                        value={formData.reported_at ? toInputLocal(formData.reported_at as string) : ''}
                                        onChange={(e) => setFormData({ ...formData, reported_at: toISOStringFromInput(e.target.value) || undefined })}
                                        className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Дата и время решения</label>
                                    <input
                                        disabled={isViewer}
                                        type="datetime-local"
                                        value={formData.resolved_at ? toInputLocal(formData.resolved_at as string) : ''}
                                        onChange={(e) => setFormData({ ...formData, resolved_at: toISOStringFromInput(e.target.value) || undefined })}
                                        className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    />
                                </div>
                            </div>

                            {formError && (
                                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 animate-in shake duration-300">
                                    {formError}
                                </div>
                            )}

                            <div className="flex gap-4 pt-4 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all active:scale-95"
                                >
                                    Отмена
                                </button>
                                {!isViewer && (
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex-1 px-6 py-4 bg-[#FF5B00] text-white font-black rounded-2xl hover:bg-[#e65200] transition-all shadow-lg shadow-[#FF5B00]/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                                Сохранение...
                                            </>
                                        ) : (
                                            'Сохранить запись'
                                        )}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl p-8 max-w-sm w-full text-center border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Удалить обращение?</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">Это действие нельзя отменить. Запись будет навсегда удалена из журнала.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 py-4 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all"
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

            {/* Category Modal */}
            {isCategoryModalOpen && user?.role === 'admin' && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-100 dark:border-slate-700">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Категории проблем</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                <form onSubmit={saveCategory} className="space-y-3">
                                    <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                                        {editingCategory ? 'Редактирование' : 'Новая категория'}
                                    </div>
                                    <input
                                        type="text"
                                        value={categoryForm.name}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200"
                                        placeholder="Название"
                                        required
                                    />
                                    <textarea
                                        value={categoryForm.description}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 min-h-[80px]"
                                        placeholder="Описание (пояснение)"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-black text-slate-400 uppercase ml-1">Порядок</div>
                                            <input
                                                type="number"
                                                value={categoryForm.sort_order}
                                                onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200"
                                                placeholder="Порядок"
                                            />
                                        </div>
                                        <div className="flex items-end pb-3">
                                            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categoryForm.is_active}
                                                    onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[#FF5B00] focus:ring-[#FF5B00]"
                                                />
                                                Активна
                                            </label>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            className="px-4 py-2 rounded-xl bg-[#FF5B00] text-white font-black hover:bg-[#e65200] transition-all"
                                        >
                                            Сохранить
                                        </button>
                                        {editingCategory && (
                                            <button
                                                type="button"
                                                onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', sort_order: 0, is_active: true }); }}
                                                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black hover:bg-slate-50 dark:hover:bg-slate-700"
                                            >
                                                Отмена
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                                            <tr className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                <th className="px-4 py-3">Категория</th>
                                                <th className="px-4 py-3">Порядок</th>
                                                <th className="px-4 py-3">Активна</th>
                                                <th className="px-4 py-3 text-right">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                            {ticketCategories
                                                .slice()
                                                .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
                                                .map(c => (
                                                    <tr key={c.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{c.name}</td>
                                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.sort_order}</td>
                                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.is_active ? 'Да' : 'Нет'}</td>
                                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                                            <div className="inline-flex gap-2">
                                                                <button
                                                                    onClick={() => openEditCategoryModal(c)}
                                                                    className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 font-bold"
                                                                >
                                                                    Редактировать
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteCategory(c.id)}
                                                                    className="px-3 py-1.5 rounded-lg text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 font-bold"
                                                                >
                                                                    Удалить
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
