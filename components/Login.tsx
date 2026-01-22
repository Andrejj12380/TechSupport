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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
                    {/* Logo/Header */}
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-[#FF5B00] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#FF5B00]/20">
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Motrum Support</h1>
                        <p className="text-slate-400 dark:text-slate-500 font-medium mt-2">Система управления оборудованием</p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
                                <p className="text-red-700 dark:text-red-400 text-sm font-medium text-center">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Имя пользователя</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 focus:border-[#FF5B00] focus:outline-none transition-colors font-medium bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                placeholder="admin"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Пароль</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 focus:border-[#FF5B00] focus:outline-none transition-colors font-medium bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-[#FF5B00] text-white rounded-xl font-bold text-lg hover:bg-[#e65200] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FF5B00]/20 hover:shadow-xl hover:shadow-[#FF5B00]/30"
                        >
                            {isLoading ? 'Вход...' : 'Войти'}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                            <span className="font-mono font-bold"></span>
                        </p>
                    </div>
                </div>

                {/* Version */}
                <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
                    Motrum Support v1.0 • 2026
                </p>
            </div>
        </div>
    );
}
