import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import UserAvatar from './UserAvatar';

interface UserManagerProps {
    currentUser: User;
}

const UserManager: React.FC<UserManagerProps> = ({ currentUser }) => {
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
                    setError('Password is required for new users');
                    return;
                }
                await api.createUser(formData);
            }
            setIsModalOpen(false);
            loadUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (id === currentUser.id) {
            alert('Вы не можете удалить свою собственную учетную запись');
            return;
        }
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
        try {
            await api.deleteUser(id);
            loadUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Управление пользователями</h1>
                    <p className="text-slate-500 text-sm">Создание и редактирование учетных записей сотрудников</p>
                </div>
                {currentUser.role === 'admin' && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-[#FF5B00] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#e65200] transition-colors flex items-center gap-2 shadow-lg shadow-[#FF5B00]/20"
                    >
                        <span>+ Добавить пользователя</span>
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                        <tr className="text-slate-500 text-xs uppercase font-bold tracking-wider">
                            <th className="px-6 py-4">Имя пользователя</th>
                            <th className="px-6 py-4">Роль</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Загрузка...</td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Пользователи не найдены</td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} className="text-sm hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                                        <UserAvatar username={user.username} size="sm" />
                                        <span>{user.username}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${user.role === 'admin' ? 'bg-purple-50 text-purple-700' :
                                            user.role === 'engineer' ? 'bg-blue-50 text-blue-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{user.email || '—'}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {currentUser.role === 'admin' && (
                                            <>
                                                <button
                                                    onClick={() => handleOpenModal(user)}
                                                    className="text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Редактировать"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.id)}
                                                    className={`text-slate-400 hover:text-red-600 transition-colors ${user.id === currentUser.id ? 'opacity-20 cursor-not-allowed' : ''}`}
                                                    disabled={user.id === currentUser.id}
                                                    title={user.id === currentUser.id ? "Вы не можете удалить себя" : "Удалить"}
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Имя пользователя</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    {editingUser ? 'Новый пароль (оставьте пустым для сохранения)' : 'Пароль'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Роль</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all"
                                >
                                    <option value="admin">Администратор</option>
                                    <option value="engineer">Инженер</option>
                                    <option value="viewer">Наблюдатель</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-[#FF5B00] text-white rounded-lg font-semibold hover:bg-[#e65200] shadow-lg shadow-[#FF5B00]/20 transition-all"
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
