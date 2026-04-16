import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save, AlertCircle, GripVertical } from 'lucide-react';
import { api } from '../services/api';
import { TicketCategory, User } from '../types';
import { useToast } from './Toast';

interface TicketCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChanged: () => void;
    currentUser: User | null;
}

export default function TicketCategoryModal({ isOpen, onClose, onChanged, currentUser }: TicketCategoryModalProps) {
    const { showToast } = useToast();
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<TicketCategory> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const isAdmin = currentUser?.role === 'admin';

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const data = await api.getTicketCategories();
            setCategories(data);
        } catch (err) {
            showToast('Ошибка загрузки категорий', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory?.name?.trim()) return;

        setIsSaving(true);
        try {
            if (editingCategory.id) {
                await api.updateTicketCategory(editingCategory.id, editingCategory);
                showToast('Категория обновлена');
            } else {
                await api.createTicketCategory(editingCategory);
                showToast('Категория создана');
            }
            setEditingCategory(null);
            fetchCategories();
            onChanged();
        } catch (err) {
            showToast('Ошибка сохранения', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!isAdmin) return;
        if (!confirm('Вы уверены? Категория будет удалена или деактивирована, если она используется в обращениях.')) return;

        try {
            const result = await api.deleteTicketCategory(id);
            if (result.mode === 'deactivated') {
                showToast('Категория деактивирована (используется в тикетах)');
            } else {
                showToast('Категория удалена');
            }
            fetchCategories();
            onChanged();
        } catch (err) {
            showToast('Ошибка удаления', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="glass-card rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-8 pb-4 flex justify-between items-center shrink-0 border-b border-white/10">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <Edit2 className="w-6 h-6 text-primary" />
                            Категории проблем
                        </h2>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Управление справочником типов обращений</p>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar space-y-6">
                    {/* Add/Edit Form */}
                    <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                        <h3 className="text-sm font-black text-white/70 uppercase tracking-widest mb-4 flex items-center gap-2">
                            {editingCategory ? 'Редактирование' : 'Новая категория'}
                            {editingCategory && <button onClick={() => setEditingCategory(null)} className="ml-auto text-[10px] text-primary hover:underline">Отмена</button>}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Название</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={editingCategory?.name || ''} 
                                        onChange={e => setEditingCategory({...editingCategory, name: e.target.value})}
                                        className="w-full bg-white/5 border-2 border-transparent focus:border-primary/50 rounded-2xl px-5 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-white/20"
                                        placeholder="Напр. Ошибка ПО"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Порядок (Sort)</label>
                                    <input 
                                        type="number" 
                                        value={editingCategory?.sort_order ?? 0} 
                                        onChange={e => setEditingCategory({...editingCategory, sort_order: parseInt(e.target.value) || 0})}
                                        className="w-full bg-white/5 border-2 border-transparent focus:border-primary/50 rounded-2xl px-5 py-3 text-sm font-bold text-white outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Описание</label>
                                <textarea 
                                    value={editingCategory?.description || ''} 
                                    onChange={e => setEditingCategory({...editingCategory, description: e.target.value})}
                                    className="w-full bg-white/5 border-2 border-transparent focus:border-primary/50 rounded-2xl px-5 py-3 text-sm font-bold text-white outline-none transition-all min-h-[80px] placeholder:text-white/20"
                                    placeholder="Краткое пояснение к категории..."
                                />
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${editingCategory?.is_active !== false ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${editingCategory?.is_active !== false ? 'left-6' : 'left-1'}`} />
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={editingCategory?.is_active !== false}
                                        onChange={e => setEditingCategory({...editingCategory, is_active: e.target.checked})}
                                    />
                                    <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors">Активна</span>
                                </label>
                                <button 
                                    type="submit" 
                                    disabled={isSaving || !editingCategory?.name?.trim()}
                                    className="px-6 py-3 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editingCategory?.id ? 'Сохранить' : 'Добавить'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-black text-white/70 uppercase tracking-widest px-2">Существующие категории</h3>
                        {isLoading ? (
                            <div className="py-20 text-center text-white/20 font-black uppercase tracking-widest text-xs">Загрузка...</div>
                        ) : categories.length === 0 ? (
                            <div className="py-12 bg-white/5 rounded-3xl border border-dashed border-white/10 text-center text-white/20 font-bold">Список пуст</div>
                        ) : (
                            <div className="grid gap-2">
                                {categories.map(cat => (
                                    <div key={cat.id} className={`group p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all flex items-center gap-4 ${!cat.is_active ? 'opacity-50 grayscale' : ''}`}>
                                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-black text-white/30 group-hover:text-primary transition-colors">
                                            {cat.sort_order}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-black text-white flex items-center gap-2">
                                                {cat.name}
                                                {!cat.is_active && <span className="text-[9px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded-lg uppercase tracking-wider">Отключена</span>}
                                            </div>
                                            {cat.description && <p className="text-[11px] text-white/40 line-clamp-1">{cat.description}</p>}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingCategory(cat)} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Изменить">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {isAdmin && (
                                                <button onClick={() => handleDelete(cat.id)} className="p-2 text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Удалить">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
