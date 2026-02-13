import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import UserAvatar from './UserAvatar';
import { Eye, EyeOff, Info } from 'lucide-react';
import { useToast } from './Toast';

interface UserManagerProps {
    currentUser: User;
}

const UserManager: React.FC<UserManagerProps> = ({ currentUser }) => {
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'engineer' as UserRole,
        email: ''
    });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            const data = await api.getUsers();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (user?: User) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                username: user.username,
                password: '',
                role: user.role,
                email: user.email || ''
            });
        } else {
            setEditingUser(null);
            setFormData({
                username: '',
                password: '',
                role: 'engineer',
                email: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await api.updateUser(editingUser.id, formData);
            } else {
                if (!formData.password) {
                    setError('Пароль обязателен для новых пользователей');
                    return;
                }
                await api.createUser(formData);
            }
            setIsModalOpen(false);
            loadUsers();
            showToast(editingUser ? 'Пользователь обновлён' : 'Пользователь создан');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (id === currentUser.id) {
            showToast('Вы не можете удалить свою собственную учётную запись', 'error');
            return;
        }
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
        try {
            await api.deleteUser(id);
            loadUsers();
            showToast('Пользователь удалён', 'info');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 italic uppercase">Управление пользователями</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Создание и редактирование учетных записей сотрудников</p>
                </div>
                {currentUser.role === 'admin' && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-[#FF5B00] text-white px-6 py-3 rounded-2xl font-black hover:bg-[#e65200] transition-all flex items-center gap-2 shadow-lg shadow-[#FF5B00]/25 active:scale-95"
                    >
                        <span>+ Добавить пользователя</span>
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl text-sm flex justify-between items-center animate-in shake duration-300">
                    <span className="font-bold">{error}</span>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors">&times;</button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                            <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-[0.2em]">
                                <th className="px-8 py-5">Пользователь</th>
                                <th className="px-8 py-5">Роль</th>
                                <th className="px-8 py-5">Email</th>
                                <th className="px-8 py-5 text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-[#FF5B00] rounded-full animate-spin" />
                                            <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Загрузка данных...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold">Пользователи не найдены</td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <UserAvatar username={user.username} size="md" />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 dark:text-slate-100">{user.username}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">ID: {user.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${user.role === 'admin' ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800' :
                                                    user.role === 'engineer' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800' :
                                                        'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-slate-500 dark:text-slate-400 font-bold text-sm">{user.email || '—'}</td>
                                        <td className="px-8 py-5 text-right whitespace-nowrap">
                                            {currentUser.role === 'admin' && (
                                                <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200">
                                                    <button
                                                        onClick={() => handleOpenModal(user)}
                                                        className="p-2.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-[#FF5B00] hover:bg-[#FF5B00]/5 dark:hover:bg-[#FF5B00]/10 transition-all"
                                                        title="Редактировать"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        className={`p-2.5 rounded-xl transition-all ${user.id === currentUser.id ? 'opacity-20 cursor-not-allowed' : 'text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'}`}
                                                        disabled={user.id === currentUser.id}
                                                        title={user.id === currentUser.id ? "Вы не можете удалить себя" : "Удалить"}
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200" role="dialog" aria-modal="true">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-8 pb-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                                    {editingUser ? 'Аккаунт' : 'Новый доступ'}
                                </h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Параметры безопасности</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Имя пользователя</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                    placeholder="Напр. tech_lead_01"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    {editingUser ? 'Новый пароль' : 'Пароль'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required={!editingUser}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 pr-12"
                                        placeholder={editingUser ? "Оставьте пустым для сохранения" : "Минимум 6 символов"}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {editingUser && (
                                    <div className="mt-3 flex items-start gap-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 p-4 rounded-2xl">
                                        <Info size={16} className="text-[#FF5B00] shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                            Пароли хранятся в зашифрованном виде (Bcrypt). Вы можете изменить его, установив новое значение.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Роль доступа</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition-all cursor-pointer"
                                    >
                                        <option value="admin">Администратор</option>
                                        <option value="engineer">Инженер</option>
                                        <option value="viewer">Наблюдатель</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-[#FF5B00] rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition-all"
                                        placeholder="user@example.com"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all active:scale-95"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-4 bg-[#FF5B00] text-white rounded-2xl font-black hover:bg-[#e65200] shadow-xl shadow-[#FF5B00]/25 transition-all active:scale-95"
                                >
                                    {editingUser ? 'Сохранить' : 'Создать'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManager;
