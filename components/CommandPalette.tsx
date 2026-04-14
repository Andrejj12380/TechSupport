import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Command, ChevronRight, Building2, Workflow, User as UserIcon, Settings, MessageSquare, History, FileText } from 'lucide-react';
import { api } from '../services/api';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (tab: string, params?: Record<string, string>) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleSearch = async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }
            setIsLoading(true);
            try {
                const data = await api.search(query);
                setResults(data);
                setSelectedIndex(0);
            } catch (error) {
                console.error('Search failed', error);
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(handleSearch, 300);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % results.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + results.length) % (results.length || 1));
            } else if (e.key === 'Enter' && results[selectedIndex]) {
                e.preventDefault();
                handleItemClick(results[selectedIndex]);
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex]);

    const handleItemClick = (result: any) => {
        try {
            if (result.type === 'Клиент') {
                onNavigate('clients', { client: String(result.id) });
            } else if (result.type === 'Линия') {
                const params: Record<string, string> = {};
                if (result?.raw?.client_id != null) params.client = String(result.raw.client_id);
                if (result?.raw?.site_id != null) params.site = String(result.raw.site_id);
                if (result?.id != null) params.line = String(result.id);
                onNavigate('clients', params);
            } else if (result.type === 'Оборудование') {
                const params: Record<string, string> = {};
                if (result?.raw?.client_id != null) params.client = String(result.raw.client_id);
                if (result?.raw?.site_id != null) params.site = String(result.raw.site_id);
                if (result?.raw?.line_id != null) params.line = String(result.raw.line_id);
                if (result?.id != null) params.equipment = String(result.id);
                onNavigate('clients', params);
            } else if (result.type === 'Контакт') {
                const params: Record<string, string> = {};
                if (result?.raw?.client_id != null) params.client = String(result.raw.client_id);
                if (result?.raw?.site_id != null) params.site = String(result.raw.site_id);
                onNavigate('clients', params);
            } else if (result.type === 'Инструкция' || result.type === 'KB') {
                onNavigate('kb', { article: String(result.id) });
            } else {
                // Generic fallback so a single unexpected type is still actionable
                onNavigate('search', { q: query });
            }
            onClose();
        } catch (error) {
            console.error('CommandPalette navigation failed:', error, result);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'Клиент': return <Building2 className="w-4 h-4" />;
            case 'Линия': return <Workflow className="w-4 h-4" />;
            case 'Контакт': return <UserIcon className="w-4 h-4" />;
            case 'Оборудование': return <Settings className="w-4 h-4" />;
            case 'Обращение': return <MessageSquare className="w-4 h-4" />;
            case 'История': return <History className="w-4 h-4" />;
            default: return <FileText className="w-4 h-4" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" 
                onClick={onClose} 
            />
            
            <div className="relative z-10 w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 rounded-3xl shadow-2xl border border-slate-300/80 dark:border-slate-700/90 overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-300 micro-pop backdrop-blur-xl">
                <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#FF5B00] transition-colors" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Поиск клиентов, линий, оборудования или инструкций..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-16 pr-6 py-6 bg-transparent border-none outline-none text-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-medium"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-[#FF5B00]/20 border-t-[#FF5B00] rounded-full animate-spin"></div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                                <span className="text-[10px] font-black text-slate-400">ESC</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto border-t border-slate-200 dark:border-slate-700 custom-scrollbar">
                    {query.trim() === '' ? (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-300">
                            <p className="text-sm font-medium">Начните вводить текст для поиска по всей системе</p>
                            <div className="mt-4 flex justify-center gap-4">
                                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-full">
                                    <Command className="w-3 h-3" /> <span>Quick Action</span>
                                </div>
                            </div>
                        </div>
                    ) : isLoading ? (
                        <div className="p-3 space-y-3">
                            {Array.from({ length: 5 }).map((_, idx) => (
                                <div key={idx} className="flex items-center gap-4 px-3 py-3 rounded-xl">
                                    <div className="skeleton w-10 h-10 rounded-2xl" />
                                    <div className="flex-1 space-y-2">
                                        <div className="skeleton skeleton-line w-2/3" />
                                        <div className="skeleton skeleton-line w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : results.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-300">
                            <p className="text-sm font-medium">Ничего не найдено для "{query}"</p>
                        </div>
                    ) : (
                        <div className="py-2">
                            {results.map((res, idx) => (
                                <div
                                    key={`${res.type}-${res.id}`}
                                    onClick={() => handleItemClick(res)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`flex items-center justify-between px-6 py-4 cursor-pointer transition-all micro-lift ${
                                        selectedIndex === idx 
                                        ? 'bg-orange-100/80 dark:bg-orange-500/20 border-l-4 border-[#FF5B00]' 
                                        : 'border-l-4 border-transparent hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                                            selectedIndex === idx 
                                            ? 'bg-[#FF5B00] text-white shadow-lg shadow-[#FF5B00]/25' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'
                                        } transition-colors`}>
                                            {getIcon(res.type)}
                                        </div>
                                        <div>
                                            <div className={`text-sm font-bold ${selectedIndex === idx ? 'text-[#FF5B00]' : 'text-slate-800 dark:text-slate-100'}`}>
                                                {res.name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                {res.type} {res.raw?.model ? `• ${res.raw.model}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 transition-all ${selectedIndex === idx ? 'translate-x-1 text-[#FF5B00]' : 'text-slate-400 dark:text-slate-500'}`} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <div className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border dark:border-slate-700 shadow-sm">↑↓</div>
                            <span>Навигация</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <div className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border dark:border-slate-700 shadow-sm">Enter</div>
                            <span>Выбрать</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
