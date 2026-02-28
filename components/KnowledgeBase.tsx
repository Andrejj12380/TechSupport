import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { api } from '../services/api';
import { KnowledgeBaseArticle, KnowledgeBaseAttachment, User } from '../types';
import { useToast } from './Toast';
import {
    Search,
    Book,
    Plus,
    Edit,
    Trash2,
    Paperclip,
    Download,
    X,
    Eye,
    Code,
    FileText,
    ExternalLink,
    Clock,
    Tag as TagIcon,
    ChevronLeft,
    AlertTriangle
} from 'lucide-react';

interface KnowledgeBaseProps {
    user: User;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ user }) => {
    const isEngineer = user.role === 'admin' || user.role === 'engineer';
    const { showToast } = useToast();

    const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
    const [attachments, setAttachments] = useState<KnowledgeBaseAttachment[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', content: '', category: '', tags: '' });
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingArticleId, setDeletingArticleId] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
    const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');

    // Auto-save drafts to localStorage
    const DRAFT_KEY = 'kb_draft';
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const saveDraft = useCallback(() => {
        if (isEditing && (editForm.title || editForm.content)) {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(editForm));
        }
    }, [isEditing, editForm]);

    useEffect(() => {
        if (!isEditing) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(saveDraft, 1500);
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    }, [editForm, isEditing, saveDraft]);

    const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

    const loadDraft = (): typeof editForm | null => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    };

    const loadArticles = useCallback(async (queryParam = searchQuery, catFilter = selectedCategoryFilter, tagFilter = selectedTagFilter) => {
        setLoading(true);
        try {
            const data = await api.getKbArticles(catFilter || undefined, tagFilter || undefined, queryParam);
            setArticles(data);
        } catch (error) {
            console.error('Failed to load articles', error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedCategoryFilter, selectedTagFilter]);

    useEffect(() => {
        loadArticles();
    }, [selectedCategoryFilter, selectedTagFilter, loadArticles]);

    useEffect(() => {
        if (selectedArticle) {
            loadAttachments(selectedArticle.id);
        } else {
            setAttachments([]);
        }
    }, [selectedArticle]);

    const loadAttachments = async (articleId: number) => {
        try {
            const data = await api.getKbAttachments(articleId);
            setAttachments(data);
        } catch (error) {
            console.error('Failed to load attachments', error);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadArticles(searchQuery);
    };

    const handleCategoryClick = (e: React.MouseEvent, category: string) => {
        e.stopPropagation();
        setSelectedCategoryFilter(category);
    };

    const handleTagClick = (e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        setSelectedTagFilter(tag);
    };

    const clearCategoryFilter = () => setSelectedCategoryFilter('');
    const clearTagFilter = () => setSelectedTagFilter('');

    const handleCreateNew = () => {
        const draft = loadDraft();
        if (draft && (draft.title || draft.content)) {
            setEditForm(draft);
            showToast('Черновик восстановлен', 'info');
        } else {
            setEditForm({ title: '', content: '', category: '', tags: '' });
        }
        setSelectedArticle(null);
        setIsEditing(true);
        setIsPreview(false);
    };

    const handleEdit = (article: KnowledgeBaseArticle) => {
        setEditForm({
            title: article.title,
            content: article.content,
            category: article.category || '',
            tags: article.tags ? article.tags.join(', ') : '',
        });
        setSelectedArticle(article);
        setIsEditing(true);
        setIsPreview(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const tagsArray = editForm.tags.split(',').map(tag => tag.trim()).filter(Boolean);

        if (!editForm.title || !editForm.content) {
            alert('Заголовок и содержание обязательны');
            return;
        }

        try {
            const articleData = {
                ...editForm,
                tags: tagsArray
            };

            if (selectedArticle) {
                const updated = await api.updateKbArticle(selectedArticle.id, articleData);
                setSelectedArticle(updated);
            } else {
                const created = await api.addKbArticle(articleData);
                setSelectedArticle(created);
            }
            setIsEditing(false);
            clearDraft();
            loadArticles();
            showToast(selectedArticle ? 'Статья обновлена' : 'Статья создана');
        } catch (error) {
            console.error('Failed to save article', error);
            showToast('Не удалось сохранить статью', 'error');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.deleteKbArticle(id);
            if (selectedArticle?.id === id) {
                setSelectedArticle(null);
                setIsEditing(false);
            }
            loadArticles();
            showToast('Статья удалена', 'info');
        } catch (error) {
            console.error('Failed to delete article', error);
            showToast('Не удалось удалить статью', 'error');
        } finally {
            setDeleteModalOpen(false);
            setDeletingArticleId(null);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedArticle) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.uploadKbAttachment(selectedArticle.id, formData);
            loadAttachments(selectedArticle.id);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error('File upload failed', error);
            alert('Ошибка при загрузке файла');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAttachment = async (id: number) => {
        if (!confirm('Удалить вложение?')) return;
        try {
            await api.deleteKbAttachment(id);
            if (selectedArticle) loadAttachments(selectedArticle.id);
        } catch (error) {
            console.error('Failed to delete attachment', error);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6 antialiased">
            {/* Left Sidebar - List */}
            <div className={`${selectedArticle || isEditing ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden`}>
                <div className="p-5 border-b border-slate-100 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Book className="w-5 h-5 text-[#FF5B00]" />
                            База Знаний
                        </h2>
                        {isEngineer && (
                            <button
                                onClick={handleCreateNew}
                                className="p-1.5 bg-[#FF5B00]/10 text-[#FF5B00] rounded-lg hover:bg-[#FF5B00] hover:text-white transition-all"
                                title="Создать статью"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleSearch} className="relative group">
                        <input
                            type="text"
                            placeholder="Поиск статей..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all"
                        />
                        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#FF5B00] transition-colors" />
                    </form>

                    {/* Active Filters */}
                    {(selectedCategoryFilter || selectedTagFilter) && (
                        <div className="flex gap-2 flex-wrap">
                            {selectedCategoryFilter && (
                                <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-md text-[11px] font-bold">
                                    <span>Категория: {selectedCategoryFilter}</span>
                                    <button onClick={clearCategoryFilter} className="hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-sm p-0.5 transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                            {selectedTagFilter && (
                                <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/30 text-[#FF5B00] px-2 py-1 rounded-md text-[11px] font-bold">
                                    <span>Тег: {selectedTagFilter}</span>
                                    <button onClick={clearTagFilter} className="hover:bg-orange-200 dark:hover:bg-orange-800 rounded-sm p-0.5 transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {loading ? (
                        <div className="space-y-3 p-1">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800 animate-pulse">
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                                    <div className="flex gap-2">
                                        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/4"></div>
                                        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/4"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : articles.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm text-slate-500">Статей пока нет</p>
                        </div>
                    ) : (
                        articles.map(article => (
                            <div
                                key={article.id}
                                onClick={() => {
                                    setSelectedArticle(article);
                                    setIsEditing(false);
                                }}
                                className={`group p-3 rounded-xl cursor-pointer transition-all border ${selectedArticle?.id === article.id
                                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-500/30 shadow-sm'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-transparent'
                                    }`}
                            >
                                <h3 className={`font-semibold text-sm mb-1 truncate ${selectedArticle?.id === article.id ? 'text-[#FF5B00]' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {article.title}
                                </h3>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                    {article.category && (
                                        <span
                                            onClick={(e) => handleCategoryClick(e, article.category!)}
                                            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                        >
                                            <TagIcon className="w-3 h-3" />
                                            {article.category}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(article.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden ${!selectedArticle && !isEditing ? 'hidden lg:flex' : 'flex'}`}>
                {!selectedArticle && !isEditing ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-12 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
                            <Book className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Выберите статью</h3>
                        <p className="max-w-xs text-sm">Используйте поиск слева или создайте новую статью для базы знаний.</p>
                    </div>
                ) : isEditing ? (
                    /* Notion-style Editor */
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-lg lg:hidden">
                                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                                </button>
                                <h3 className="font-bold text-slate-800">
                                    {selectedArticle ? 'Редактирование' : 'Новое руководство'}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsPreview(!isPreview)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isPreview ? 'bg-orange-50 dark:bg-orange-900/20 text-[#FF5B00]' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                                        }`}
                                >
                                    {isPreview ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    {isPreview ? 'Редактор' : 'Предпросмотр'}
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-[#FF5B00] text-white rounded-lg font-bold hover:bg-[#e05000] shadow-lg shadow-[#FF5B00]/20 transition-all text-sm"
                                >
                                    Сохранить
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
                            <div className="space-y-6">
                                <input
                                    type="text"
                                    placeholder="Заголовок статьи..."
                                    value={editForm.title}
                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full text-4xl font-black text-slate-900 dark:text-slate-100 placeholder:text-slate-200 dark:placeholder:text-slate-700 bg-transparent border-none outline-none focus:ring-0 p-0"
                                />

                                <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Категория</label>
                                        <input
                                            type="text"
                                            value={editForm.category}
                                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                            className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 p-0"
                                            placeholder="Напр. Настройка VPN"
                                        />
                                    </div>
                                    <div className="w-[1px] bg-slate-200 dark:bg-slate-700 my-1" />
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Теги</label>
                                        <input
                                            type="text"
                                            value={editForm.tags}
                                            onChange={e => setEditForm({ ...editForm, tags: e.target.value })}
                                            className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 p-0"
                                            placeholder="тэги через запятую..."
                                        />
                                    </div>
                                </div>

                                {isPreview ? (
                                    <div className="prose prose-slate dark:prose-invert max-w-none min-h-[500px] border-t border-slate-100 dark:border-slate-700 pt-6 prose-headings:font-black prose-h1:text-4xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-img:rounded-2xl">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                code(props) {
                                                    const { children, className, node, ref, ...rest } = props
                                                    const match = /language-(\w+)/.exec(className || '')
                                                    return match ? (
                                                        <SyntaxHighlighter
                                                            {...rest as any}
                                                            PreTag="div"
                                                            children={String(children).replace(/\n$/, '')}
                                                            language={match[1]}
                                                            style={vscDarkPlus as any}
                                                            className="rounded-xl !my-4 !bg-[#1E1E1E]"
                                                        />
                                                    ) : (
                                                        <code {...rest as any} className={className}>
                                                            {children}
                                                        </code>
                                                    )
                                                }
                                            }}
                                        >
                                            {editForm.content || '*Начните писать, чтобы увидеть предпросмотр...*'}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <textarea
                                        value={editForm.content}
                                        onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                                        className="w-full min-h-[600px] text-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-200 dark:placeholder:text-slate-700 bg-transparent border-none outline-none focus:ring-0 p-0 font-mono resize-none"
                                        placeholder="Начните писать контент в формате Markdown..."
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Read Mode with Attachments */
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg lg:hidden">
                                    <ChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                </button>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100">
                                    База знаний → {selectedArticle?.category || 'Общее'}
                                </h3>
                            </div>
                            {isEngineer && selectedArticle && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(selectedArticle)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-[#FF5B00] hover:bg-orange-50 dark:hover:bg-orange-900/10 rounded-lg transition-all text-sm font-semibold"
                                    >
                                        <Edit className="w-4 h-4" />
                                        <span>Редактировать</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDeletingArticleId(selectedArticle.id);
                                            setDeleteModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all text-sm font-semibold"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Удалить</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-8 py-12">
                            <div className="max-w-4xl mx-auto space-y-12">
                                {selectedArticle && (
                                    <>
                                        <div>
                                            <h1 className="text-5xl font-black text-slate-900 dark:text-slate-100 mb-6 leading-tight">{selectedArticle.title}</h1>
                                            <div className="flex flex-wrap gap-4 items-center text-xs">
                                                {selectedArticle.category && (
                                                    <div
                                                        onClick={(e) => handleCategoryClick(e, selectedArticle.category!)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider cursor-pointer transition-colors"
                                                    >
                                                        <TagIcon className="w-3 h-3" />
                                                        {selectedArticle.category}
                                                    </div>
                                                )}

                                                {selectedArticle.category && <div className="h-4 w-[1px] bg-slate-200" />}

                                                <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {new Date(selectedArticle.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="flex gap-2">
                                                    {selectedArticle.tags?.map((tag, i) => (
                                                        <span
                                                            key={i}
                                                            onClick={(e) => handleTagClick(e, tag)}
                                                            className="text-[#FF5B00] font-bold hover:underline cursor-pointer"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-h1:text-5xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-a:text-[#FF5B00] text-slate-700 dark:text-slate-300 leading-relaxed text-lg pb-12 prose-img:rounded-2xl prose-img:shadow-xl">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code(props) {
                                                        const { children, className, node, ref, ...rest } = props
                                                        const match = /language-(\w+)/.exec(className || '')
                                                        return match ? (
                                                            <SyntaxHighlighter
                                                                {...rest as any}
                                                                PreTag="div"
                                                                children={String(children).replace(/\n$/, '')}
                                                                language={match[1]}
                                                                style={vscDarkPlus as any}
                                                                className="rounded-xl !my-4 !bg-[#1E1E1E]"
                                                            />
                                                        ) : (
                                                            <code {...rest as any} className={className}>
                                                                {children}
                                                            </code>
                                                        )
                                                    }
                                                }}
                                            >
                                                {selectedArticle.content}
                                            </ReactMarkdown>
                                        </div>

                                        {/* Attachments Section */}
                                        <div className="border-t border-slate-100 dark:border-slate-700 pt-10">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                    <Paperclip className="w-5 h-5 text-[#FF5B00]" />
                                                    Вложенные файлы ({attachments.length})
                                                </h3>
                                                {isEngineer && (
                                                    <div className="relative">
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            ref={fileInputRef}
                                                            onChange={handleFileUpload}
                                                        />
                                                        <button
                                                            onClick={() => fileInputRef.current?.click()}
                                                            disabled={uploading}
                                                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-sm font-bold shadow-lg shadow-slate-200 disabled:opacity-50"
                                                        >
                                                            {uploading ? (
                                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                            ) : <Plus className="w-4 h-4" />}
                                                            {uploading ? 'Загрузка...' : 'Добавить файл'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {attachments.length === 0 ? (
                                                <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400 text-sm">
                                                    Файлы не прикреплены ко вкладу
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {attachments.map(file => (
                                                        <div key={file.id} className="group p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-4 hover:border-[#FF5B00]/50 hover:shadow-xl hover:shadow-slate-100 dark:hover:shadow-black/20 transition-all">
                                                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 group-hover:text-[#FF5B00] transition-colors">
                                                                <FileText className="w-6 h-6" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{file.original_name}</div>
                                                                <div className="text-[11px] text-slate-400 font-medium">
                                                                    {formatSize(file.size_bytes)} • {new Date(file.created_at).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <a
                                                                    href={`http://localhost:5002/uploads/kb/${file.filename}`}
                                                                    target="_blank"
                                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                    title="Открыть/Скачать"
                                                                >
                                                                    <ExternalLink className="w-4 h-4" />
                                                                </a>
                                                                {isEngineer && (
                                                                    <button
                                                                        onClick={() => handleDeleteAttachment(file.id)}
                                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                        title="Удалить"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDeleteModalOpen(false)} />
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md relative z-10 border border-slate-100 dark:border-slate-700 p-8 animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center mb-2">Удалить статью?</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
                            Вы собираетесь безвозвратно удалить статью "{articles.find(a => a.id === deletingArticleId)?.title}". Это действие нельзя отменить.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={() => deletingArticleId && handleDelete(deletingArticleId)}
                                className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;
