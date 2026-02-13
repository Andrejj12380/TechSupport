import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    exiting?: boolean;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
        }, 3500);
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, []);

    const icons: Record<ToastType, ReactNode> = {
        success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        error: <XCircle className="w-5 h-5 text-red-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };

    const bgColors: Record<ToastType, string> = {
        success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
        error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
        warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
        info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-lg backdrop-blur-sm transition-all duration-300 max-w-sm ${bgColors[toast.type]} ${toast.exiting
                            ? 'opacity-0 translate-x-8'
                            : 'opacity-100 translate-x-0 animate-in slide-in-from-right-5'
                            }`}
                    >
                        {icons[toast.type]}
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{toast.message}</span>
                        <button
                            onClick={() => dismiss(toast.id)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-2 shrink-0"
                            aria-label="Закрыть уведомление"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
