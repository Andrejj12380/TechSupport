import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Plus, Edit2, Building2, Settings, User as UserIcon, 
    MessageSquare, AlertCircle, CheckCircle2, Clock, 
    Search, ChevronRight, Check
} from 'lucide-react';
import { SupportTicket, Client, ProductionLine, User, TicketCategory, SiteContact } from '../types';
import { api } from '../services/api';

// --- Glass Select Component (Internal) ---
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

interface SupportTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    ticket: SupportTicket | null;
    clients: Client[];
    engineers: User[];
    categories: TicketCategory[];
    currentUser: User | null;
}

const SupportTicketModal = ({ isOpen, onClose, onSaved, ticket, clients, engineers, categories, currentUser }: SupportTicketModalProps) => {
    const [formData, setFormData] = useState<Partial<SupportTicket>>({});
    const [lines, setLines] = useState<ProductionLine[]>([]);
    const [availableContacts, setAvailableContacts] = useState<SiteContact[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const isViewer = currentUser?.role === 'viewer';

    useEffect(() => {
        if (ticket) {
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
            fetchClientDetails(ticket.client_id);
        } else {
            const unknownCategoryId = categories.find(c => c.name.toLowerCase() === 'не известно')?.id || null;
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
            setLines([]);
            setAvailableContacts([]);
        }
        setFormError(null);
    }, [ticket, isOpen, categories]);

    const fetchClientDetails = async (clientId: number) => {
        if (!clientId) return;
        try {
            const [linesData, sitesData] = await Promise.all([
                api.getProductionLines(clientId),
                api.getSites(clientId)
            ]);
            setLines(linesData);
            setAvailableContacts(sitesData.flatMap(s => s.contacts || []));
        } catch (err) {
            console.error('Error fetching client details:', err);
        }
    };

    const handleClientChange = async (clientId: number) => {
        setFormData(prev => ({ ...prev, client_id: clientId, line_id: null }));
        if (clientId) {
            fetchClientDetails(clientId);
        } else {
            setLines([]);
            setAvailableContacts([]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        
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
            const toISO = (val?: string) => {
                if (!val) return null;
                const d = new Date(val);
                return isNaN(d.getTime()) ? null : d.toISOString();
            };

            const payload: Partial<SupportTicket> = {
                ...formData,
                client_id: Number(formData.client_id),
                line_id: formData.line_id ? Number(formData.line_id) : null,
                reported_at: toISO(formData.reported_at as string) || undefined,
                resolved_at: toISO(formData.resolved_at as string) || undefined,
                category_id: formData.category_id ? Number(formData.category_id) : null
            };

            if (ticket) {
                await api.updateTicket(ticket.id, payload);
            } else {
                await api.createTicket(payload);
            }
            onSaved();
            onClose();
        } catch (err: any) {
            console.error('Error saving ticket:', err);
            setFormError(err?.message || 'Ошибка при сохранении');
        } finally {
            setIsSaving(false);
        }
    };

    const pad = (n: number) => String(n).padStart(2, '0');
    const toInputLocal = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true">
            <div className="glass-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden border border-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-8 pb-4 flex justify-between items-center shrink-0 border-b border-slate-50 border-white/10">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        {ticket ? <Edit2 className="w-6 h-6 text-primary" /> : <Plus className="w-6 h-6 text-primary" />}
                        {ticket ? 'Редактировать обращение' : 'Новое обращение'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
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
                            options={categories
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
                            disabled={isViewer || (currentUser?.role !== 'admin' && !!ticket?.id)}
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
                                        {status === 'solved' ? 'Решено' : 
                                         status === 'in_progress' ? 'В работе' : 
                                         status === 'unsolved' ? 'Не решено' : 'В ожидании'}
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
                                onChange={(e) => {
                                    const d = new Date(e.target.value);
                                    setFormData({ ...formData, reported_at: isNaN(d.getTime()) ? undefined : d.toISOString() });
                                }}
                                className={`premium-input ${isViewer ? 'cursor-not-allowed opacity-70' : ''}`}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Дата и время решения</label>
                            <input
                                disabled={isViewer}
                                type="datetime-local"
                                value={formData.resolved_at ? toInputLocal(formData.resolved_at as string) : ''}
                                onChange={(e) => {
                                    const d = new Date(e.target.value);
                                    setFormData({ ...formData, resolved_at: isNaN(d.getTime()) ? undefined : d.toISOString() });
                                }}
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
                            onClick={onClose}
                            className="flex-1 px-6 py-4 bg-white/10 text-white/70 font-black rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all active:scale-95"
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
    );
};

export default React.memo(SupportTicketModal);
