import { useState } from 'react';
import { api } from '../services/api';

interface LoginProps {
    onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await api.login(username, password);
            onLoginSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка входа');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10">
                <div className="bg-white dark:bg-surface-900 rounded-[3rem] shadow-2xl p-12 border border-surface-100 dark:border-surface-800 relative overflow-hidden">
                    {/* Subtle corner glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>

                    {/* Logo/Header */}
                    <div className="text-center mb-10 relative z-10">
                        <div className="w-20 h-20 bg-primary rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/20 group hover:scale-105 transition-transform">
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-display font-black text-slate-950 dark:text-white uppercase tracking-tight">Motrum Support</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">Система управления оборудованием</p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-4">
                                <p className="text-red-600 dark:text-red-400 text-xs font-black text-center uppercase tracking-widest">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Имя пользователя</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl border-2 border-surface-100 dark:border-surface-700 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all font-bold bg-surface-50 dark:bg-surface-800 text-slate-900 dark:text-white shadow-inner"
                                placeholder="admin"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Пароль</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl border-2 border-surface-100 dark:border-surface-700 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all font-bold bg-surface-50 dark:bg-surface-800 text-slate-900 dark:text-white shadow-inner"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30"
                        >
                            {isLoading ? 'Авторизация...' : 'Войти в систему'}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-10 pt-8 border-t border-surface-100 dark:border-surface-800 relative z-10">
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center font-black uppercase tracking-[0.2em]">
                            Motrum Support v1.0 • 2026
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
