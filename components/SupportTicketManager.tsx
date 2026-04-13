import React, { useState, useEffect, useRef } from 'react';
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
    PauseCircle,
    Sparkles,
    Layout
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

// --- Glass Select Component ---
interface GlassSelectProps {
    label: string;
    value: any;
    onChange: (value: any) => void;
    options: { id: any; name: string; icon?: React.ReactNode; color?: string }[];
    placeholder?: string;
    icon?: React.ReactNode;
    searchable?: boolean;
    disabled?: boolean;
}

const GlassSelect = ({ label, value, onChange, options, placeholder = 'Выберите...', icon, searchable = false, disabled = false }: GlassSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.id === value);
    const filteredOptions = searchable 
        ? options.filter(opt => opt.name.toLowerCase().includes(search.toLowerCase()))
        : options;

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                {icon} {label}
            </label>
            <div className="relative">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`
                        w-full px-5 py-3.5 bg-white/5 border-2 border-transparent 
                        ${isOpen ? 'border-primary/50 bg-slate-100 dark:bg-white/10' : 'hover:bg-slate-100 dark:hover:bg-white/10'} 
                        rounded-2xl outline-none font-bold text-slate-800 dark:text-white transition-all flex items-center justify-between
                        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                    `}
                >
                    <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
                    <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90 text-primary' : 'text-slate-400 dark:text-white/30'}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-0 w-full z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                        <div 
                            style={{ backgroundColor: 'var(--bg-main)' }}
                            className="glass-card shadow-2xl flex flex-col overflow-hidden w-full border border-white/10 rounded-2xl"
                        >
                            {searchable && (
                                <div className="p-3 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-white/30" />
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="Поиск..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="w-full bg-slate-200 dark:bg-black/20 border-none rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 outline-none focus:ring-1 focus:ring-primary/40"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="max-h-[250px] overflow-y-auto custom-scrollbar p-1.5">
                                {filteredOptions.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-xs font-bold text-slate-400 dark:text-white/20 uppercase tracking-widest">
                                        Ничего не найдено
                                    </div>
                                ) : (
                                    filteredOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                                            className={`
                                                w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center justify-between group/opt
                                                ${value === opt.id ? 'bg-primary/20 text-primary font-black' : 'text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white font-bold'}
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                {opt.icon}
                                                <span className="truncate">{opt.name}</span>
                                            </div>
                                            {value === opt.id && <Check className="w-4 h-4 text-primary" />}
                                            {value !== opt.id && <ChevronRight className="w-3 h-3 text-white/0 group-hover/opt:text-slate-300 dark:group-hover/opt:text-white/20 transition-all" />}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
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
        resolved_at: '',
        contact_channel: 'phone',
        total_work_minutes: 0
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
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isKanbanView, setIsKanbanView] = useState(false);
    const [aiSummary, setAiSummary] = useState<{ summary: string; action_items: string[] } | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const activeFilterCount = [filterClient, filterStatus, filterCategory, filterReportedFrom, filterReportedTo].filter(Boolean).length;

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
        if (!isLoading) {
            const params = new URLSearchParams(window.location.search);
            const ticketId = params.get('ticketId');
            const newTicket = params.get('newTicket');

            if (newTicket === 'true') {
                resetForm();
                setIsModalOpen(true);
                // Clean up URL
                const url = new URL(window.location.href);
                url.searchParams.delete('newTicket');
                window.history.replaceState({ tab: 'tickets' }, '', url.toString());
            } else if (ticketId && tickets.length > 0) {
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

    const handleSummarize = async (ticketId: number) => {
        setIsAiLoading(true);
        try {
            const summary = await api.summarizeTicket(ticketId);
            setAiSummary(summary);
        } catch (err) {
            console.error('AI Summary failed:', err);
            showToast('Не удалось получить AI-саммари', 'error');
        } finally {
            setIsAiLoading(false);
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
            resolved_at: '',
            contact_channel: 'phone',
            total_work_minutes: 0
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
            resolved_at: ticket.resolved_at || '',
            contact_channel: ticket.contact_channel || 'phone',
            total_work_minutes: ticket.total_work_minutes || 0
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
            const updatedTicket = await api.startTicketWork(ticketId);
            setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
        } catch (err) {
            console.error('Error starting work:', err);
        }
    };

    const handleStopWork = async (ticketId: number) => {
        try {
            const updatedTicket = await api.stopTicketWork(ticketId);
            setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
        } catch (err) {
            console.error('Error stopping work:', err);
        }
    };

    const handlePauseWork = async (ticketId: number) => {
        try {
            const updatedTicket = await api.pauseTicketWork(ticketId);
            setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
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

    // Kanban-specific state
    const [draggedTicket, setDraggedTicket] = useState<SupportTicket | null>(null);
    const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, ticket: SupportTicket) => {
        e.dataTransfer.setData('text/plain', ticket.id.toString());
        e.dataTransfer.effectAllowed = 'move';
        // Use setTimeout to allow the browser to initiate the drag before the DOM changes (due to state)
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
            try {
                await api.updateTicket(draggedTicket.id, { 
                    ...draggedTicket,
                    status: status as 'in_progress' | 'solved' | 'unsolved' | 'on_hold' 
                });
                await fetchData();
                showToast(`Обращение переведено в "${getStatusLabel(status)}"`);
            } catch (err) {
                console.error('Error updating ticket status:', err);
                showToast('Ошибка при обновлении статуса', 'error');
            }
        }
        setDraggedTicket(null);
    };

    const handleDragLeave = () => {
        setDragOverStatus(null);
    };

    const statusColors: { [key: string]: string } = {
        'in_progress': 'bg-amber-500',
        'on_hold': 'bg-slate-400',
        'solved': 'bg-emerald-500',
        'unsolved': 'bg-red-500'
    };

    const KanbanColumn = ({ status, title, tickets }: { status: string; title: string; tickets: SupportTicket[] }) => (
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
                    <span className="px-2 py-0.5 glass-card rounded-full text-[10px] font-black text-white/50 shadow-sm">{tickets.length}</span>
                </div>
            </div>
            <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                {tickets.length === 0 ? (
                    <div className="text-center py-10 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600/50">Нет обращений</div>
                ) : (
                    tickets.map(t => (
                        <div 
                            key={t.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, t)}
                            onDragEnd={() => setDraggedTicket(null)}
                            onClick={() => openEditModal(t)}
                            className={`glass-card p-4 rounded-2xl border border-white/10 shadow-sm hover:shadow-md hover:border-primary/40 dark:hover:border-primary/40 transition-all cursor-grab active:cursor-grabbing group select-none ${t.id === draggedTicket?.id ? 'opacity-50 scale-95 border-primary shadow-inner' : ''}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase text-white/40 tracking-wider">#{t.id} • {t.client_name}</span>
                                <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleSummarize(t.id); }}
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
                                    {getTicketSupportStatus(t).label}
                                </span>
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
        <div className="p-4 md:p-6 max-w-[1600px] 2xl:max-w-full mx-auto w-full">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <MessageSquare className="w-8 h-8 text-primary" />
                        Журнал обращений
                    </h1>
                    <p className="text-white/50 font-medium mt-1">Фиксация и контроль техподдержки клиентов</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto self-start md:self-auto">
                    {user?.role === 'admin' && (
                        <button
                            onClick={openCategoryModal}
                            className="px-4 py-2 rounded-2xl font-bold text-slate-600 dark:text-white/70 glass-card border border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-sm glass-surface"
                        >
                            Категории проблем
                        </button>
                    )}

                    <div className="flex bg-white/10 p-1 rounded-2xl border border-white/10">
                        <button
                            onClick={() => setIsKanbanView(false)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${!isKanbanView ? 'bg-white bg-white/10 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Filter className="w-3.5 h-3.5" /> Список
                        </button>
                        <button
                            onClick={() => setIsKanbanView(true)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isKanbanView ? 'bg-white bg-white/10 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Layout className="w-3.5 h-3.5" /> Канбан
                        </button>
                    </div>

                    {isAuthorized && (
                        <button
                            onClick={() => { resetForm(); setIsModalOpen(true); }}
                            className="bg-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            Новое обращение
                        </button>
                    )}
                </div>
            </div>

            {/* Filters & Search */}
            <div className="glass-card rounded-2xl p-3 md:p-4 shadow-sm border border-white/10 mb-4 glass-surface micro-pop">
                {/* Row 1: Search + Sort + Filter Toggle */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Поиск по проблеме или клиенту..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/40 border-none rounded-xl text-sm text-white font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    <select
                        value={sortDateMode}
                        onChange={(e) => setSortDateMode(e.target.value as any)}
                        className="bg-slate-50/50 dark:bg-slate-900/40 border-none rounded-xl py-2.5 px-4 text-sm text-white/70 font-bold focus:ring-2 focus:ring-primary/20 hidden sm:block"
                    >
                        <option value="reported_at">По дате обращения</option>
                        <option value="created_at">По дате добавления</option>
                    </select>

                    <button
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${isFiltersOpen || activeFilterCount > 0
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : 'bg-slate-50/50 dark:bg-slate-900/40 text-white/50 hover:bg-white/10/60'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline">Фильтры</span>
                        {activeFilterCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Row 2: Collapsible Filter Panel */}
                <div className={`expand-grid ${isFiltersOpen ? 'is-open' : ''}`}>
                    <div className="expand-inner">
                        <div className="flex flex-wrap items-center gap-3 pt-3 mt-3 border-t border-white/10">
                            <select
                                value={filterClient}
                                onChange={(e) => setFilterClient(e.target.value)}
                                className="bg-white/5 border-none rounded-xl py-2 px-4 text-sm text-white/70 font-bold focus:ring-2 focus:ring-primary/20 flex-1 min-w-[160px]"
                            >
                                <option value="">Все клиенты</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>

                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="bg-white/5 border-none rounded-xl py-2 px-4 text-sm text-white/70 font-bold focus:ring-2 focus:ring-primary/20 flex-1 min-w-[140px]"
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
                                className="bg-white/5 border-none rounded-xl py-2 px-4 text-sm text-white/70 font-bold focus:ring-2 focus:ring-primary/20 flex-1 min-w-[140px]"
                            >
                                <option value="">Все категории</option>
                                {ticketCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>

                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={filterReportedFrom}
                                    onChange={(e) => setFilterReportedFrom(e.target.value)}
                                    className="bg-white/5 dark:bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-slate-800 dark:text-white/70 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    title="Дата с"
                                />
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                                <input
                                    type="date"
                                    value={filterReportedTo}
                                    onChange={(e) => setFilterReportedTo(e.target.value)}
                                    className="bg-white/5 dark:bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-slate-800 dark:text-white/70 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    title="Дата по"
                                />
                            </div>

                            {activeFilterCount > 0 && (
                                <button
                                    onClick={() => { setFilterClient(''); setFilterStatus(''); setFilterCategory(''); setFilterReportedFrom(''); setFilterReportedTo(''); }}
                                    className="text-xs font-bold text-primary hover:text-primary/90 transition-colors ml-auto"
                                >
                                    Сбросить все
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tickets View: Table or Kanban */}
            {isKanbanView ? (
                // KANBAN VIEW
                <div className="bg-transparent h-[calc(100vh-270px)] min-h-[500px]">
                    <div className="flex gap-4 overflow-x-auto h-full pb-4 items-start custom-scrollbar">
                        <KanbanColumn status="in_progress" title="В работе" tickets={sortedTickets.filter(t => t.status === 'in_progress')} />
                        <KanbanColumn status="on_hold" title="В ожидании" tickets={sortedTickets.filter(t => t.status === 'on_hold')} />
                        <KanbanColumn status="solved" title="Решено" tickets={sortedTickets.filter(t => t.status === 'solved')} />
                        <KanbanColumn status="unsolved" title="Не решено" tickets={sortedTickets.filter(t => t.status === 'unsolved')} />
                    </div>
                </div>
            ) : (
                // TABLE VIEW
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
                            ) : sortedTickets.length === 0 ? (
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
                            ) : sortedTickets.map((ticket) => (
                                <tr
                                    key={ticket.id}
                                    onClick={() => openEditModal(ticket)}
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
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase ${getTicketSupportStatus(ticket).color} border border-current opacity-60`}>
                                                {getTicketSupportStatus(ticket).label}
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
                                                                onClick={(e) => { e.stopPropagation(); handleStopWork(ticket.id); }}
                                                                className="flex items-center gap-1 px-2 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-500/20 transition-all animate-pulse"
                                                            >
                                                                <Square className="w-3 h-3 fill-current" />
                                                                Стоп
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePauseWork(ticket.id); }}
                                                                className="flex items-center gap-1 px-2 py-1.5 bg-slate-500/10 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-500/20 transition-all"
                                                                title="Пауза"
                                                            >
                                                                <Pause className="w-3 h-3 fill-current" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleStartWork(ticket.id); }}
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
                                            {user?.role === 'admin' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeletingTicketId(ticket.id); setIsDeleteModalOpen(true); }}
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
            )}

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true">
                    <div className="glass-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden border border-white/10 animate-in zoom-in-95 duration-200">
                        <div className="p-8 pb-4 flex justify-between items-center shrink-0 border-b border-slate-50 border-white/10">
                            <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                {selectedTicket ? <Edit2 className="w-6 h-6 text-primary" /> : <Plus className="w-6 h-6 text-primary" />}
                                {selectedTicket ? 'Редактировать обращение' : 'Новое обращение'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 pt-4 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <GlassSelect
                                    label="Клиент"
                                    value={formData.client_id}
                                    onChange={(val) => handleClientChange(Number(val))}
                                    options={clients.map(c => ({ id: c.id, name: c.name }))}
                                    placeholder="Выберите клиента"
                                    icon={<Building2 className="w-3 h-3" />}
                                    searchable={true}
                                    disabled={isViewer}
                                />
                                <GlassSelect
                                    label="Линия оборудования"
                                    value={formData.line_id || ''}
                                    onChange={(val) => setFormData({ ...formData, line_id: val ? Number(val) : null })}
                                    options={lines.map(l => ({ id: l.id, name: l.name }))}
                                    placeholder="Не привязано"
                                    icon={<Settings className="w-3 h-3" />}
                                    searchable={true}
                                    disabled={isViewer}
                                />
                                <GlassSelect
                                    label="Категория проблемы"
                                    value={formData.category_id ?? ''}
                                    onChange={(val) => setFormData({ ...formData, category_id: val ? Number(val) : null })}
                                    options={ticketCategories
                                        .filter(c => c.is_active || c.id === formData.category_id)
                                        .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
                                        .map(c => ({ id: c.id, name: c.name }))}
                                    placeholder="Выберите категорию"
                                    disabled={isViewer}
                                />
                                <GlassSelect
                                    label="Канал обращения"
                                    value={formData.contact_channel || 'phone'}
                                    onChange={(val) => setFormData({ ...formData, contact_channel: val })}
                                    options={[
                                        { id: 'phone', name: '📞 Телефон' },
                                        { id: 'email', name: '📧 Email' },
                                        { id: 'telegram', name: '✈️ Telegram' },
                                        { id: 'max', name: '💬 Messenger MAX' },
                                        { id: 'other', name: '❓ Другое' }
                                    ]}
                                    icon={<MessageSquare className="w-3 h-3 text-primary" />}
                                    disabled={isViewer}
                                />
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
                                        className={`w-full px-5 py-3.5 bg-white/5 border-2 border-transparent focus:border-primary rounded-2xl outline-none font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 transition-all ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
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
                                                        ? (line === 1 ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' :
                                                            line === 2 ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50' :
                                                                'bg-red-500 text-white shadow-lg shadow-red-500/50')
                                                        : 'bg-white/5 text-slate-400 dark:text-slate-600 hover:bg-white/10'}
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
                                    className={`w-full px-5 py-3.5 bg-white/5 border-2 border-transparent focus:border-primary rounded-2xl outline-none font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 transition-all min-h-[100px] ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
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
                                    className={`w-full px-5 py-3.5 bg-white/5 border-2 border-transparent focus:border-primary rounded-2xl outline-none font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 transition-all min-h-[100px] ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    placeholder="Опишите принятые меры или итоговое решение..."
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                <GlassSelect
                                    label="Инженер"
                                    value={formData.user_id || ''}
                                    onChange={(val) => setFormData({ ...formData, user_id: val ? Number(val) : null })}
                                    options={engineers.map(eng => ({ id: eng.id, name: eng.username }))}
                                    placeholder="Выберите инженера"
                                    icon={<UserIcon className="w-3 h-3 text-primary" />}
                                    disabled={isViewer || (user?.role !== 'admin' && !!selectedTicket?.id)}
                                    searchable={true}
                                />

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
                                                        ? (status === 'solved' ? 'bg-emerald-500 shadow-emerald-500/40 shadow-lg' :
                                                           status === 'in_progress' ? 'bg-amber-500 shadow-amber-500/40 shadow-lg' :
                                                           status === 'on_hold' ? 'bg-purple-500 shadow-purple-500/40 shadow-lg' :
                                                           'bg-rose-500 shadow-rose-500/40 shadow-lg') + ' text-white'
                                                        : 'bg-white/5 text-white/50 hover:bg-white/10'}
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
                                        className={`premium-input ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Дата и время решения</label>
                                    <input
                                        disabled={isViewer}
                                        type="datetime-local"
                                        value={formData.resolved_at ? toInputLocal(formData.resolved_at as string) : ''}
                                        onChange={(e) => setFormData({ ...formData, resolved_at: toISOStringFromInput(e.target.value) || undefined })}
                                        className={`premium-input ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                    />
                                </div>
                                <div className="space-y-2 col-span-full">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Clock className="w-3 h-3" /> Затраты времени (минуты)
                                    </label>
                                    <input
                                        disabled={isViewer}
                                        type="number"
                                        min="0"
                                        value={formData.total_work_minutes || 0}
                                        onChange={(e) => setFormData({ ...formData, total_work_minutes: parseInt(e.target.value) || 0 })}
                                        className={`premium-input ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                                        placeholder="Введите время в минутах..."
                                    />
                                    <p className="text-[10px] font-bold text-white/30 italic">
                                        Это чистое время активной работы. Оно также обновляется кнопками таймера в списке.
                                    </p>
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
                                    className="flex-1 px-6 py-4 bg-white/10 text-slate-600 text-white/70 font-black rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all active:scale-95"
                                >
                                    Отмена
                                </button>
                                {!isViewer && (
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex-1 px-6 py-4 bg-gradient-to-r from-[#FF5B00] to-[#FF8C00] text-white font-black rounded-2xl hover:from-[#FF6B10] hover:to-[#FFA500] transition-all shadow-xl shadow-primary/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border-t border-white/20"
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
                    <div className="glass-card rounded-[2rem] shadow-2xl p-8 max-w-sm w-full text-center border border-white/10 animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-white mb-2">Удалить обращение?</h3>
                        <p className="text-white/50 font-medium mb-6">Это действие нельзя отменить. Запись будет навсегда удалена из журнала.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 py-4 bg-white/10 text-slate-600 text-white/70 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all"
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
                    <div className="glass-card rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden border border-white/10">
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-xl font-black text-white">Категории проблем</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                                <form onSubmit={saveCategory} className="space-y-3">
                                    <div className="text-sm font-black text-white">
                                        {editingCategory ? 'Редактирование' : 'Новая категория'}
                                    </div>
                                    <input
                                        type="text"
                                        value={categoryForm.name}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                        className="w-full px-4 py-2.5 glass-card border border-white/10 rounded-xl font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30"
                                        placeholder="Название"
                                        required
                                    />
                                    <textarea
                                        value={categoryForm.description}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                        className="w-full px-4 py-2.5 glass-card border border-white/10 rounded-xl font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 min-h-[80px]"
                                        placeholder="Описание (пояснение)"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-black text-slate-400 uppercase ml-1">Порядок</div>
                                            <input
                                                type="number"
                                                value={categoryForm.sort_order}
                                                onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 glass-card border border-white/10 rounded-xl font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30"
                                                placeholder="Порядок"
                                            />
                                        </div>
                                        <div className="flex items-end pb-3">
                                            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 text-white/70 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categoryForm.is_active}
                                                    onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                                                />
                                                Активна
                                            </label>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            className="px-4 py-2 rounded-xl bg-primary text-white font-black hover:bg-primary/90 transition-all"
                                        >
                                            Сохранить
                                        </button>
                                        {editingCategory && (
                                            <button
                                                type="button"
                                                onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', sort_order: 0, is_active: true }); }}
                                                className="px-4 py-2 rounded-xl glass-card border border-white/10 text-slate-600 text-white/70 font-black hover:bg-white/10"
                                            >
                                                Отмена
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>

                            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                                <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/5 border-b border-white/10">
                                            <tr className="text-xs font-black text-white/40 uppercase tracking-wider">
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
                                                    <tr key={c.id} className="text-sm hover:bg-white/10/50 transition-colors">
                                                        <td className="px-4 py-3 font-bold text-white">{c.name}</td>
                                                        <td className="px-4 py-3 text-white/50">{c.sort_order}</td>
                                                        <td className="px-4 py-3 text-white/50">{c.is_active ? 'Да' : 'Нет'}</td>
                                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                                            <div className="inline-flex gap-2">
                                                                <button
                                                                    onClick={() => openEditCategoryModal(c)}
                                                                    className="px-3 py-1.5 rounded-lg text-slate-600 text-white/70 bg-white/10 hover:bg-slate-100 dark:hover:bg-slate-600 font-bold"
                                                                >
                                                                    Редактировать
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteCategory(c.id)}
                                                                    className="px-3 py-1.5 rounded-lg text-red-600 bg-red-500/10 hover:bg-red-100 font-bold"
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

