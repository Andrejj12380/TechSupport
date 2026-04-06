import React, { useState } from 'react';
import { KnowledgeBaseArticle } from '../types';
import { ChevronRight, ChevronDown, FileText, Plus, Folder } from 'lucide-react';

interface KBTreeProps {
    articles: KnowledgeBaseArticle[];
    parentId: number | null;
    selectedId: number | null;
    onSelect: (article: KnowledgeBaseArticle) => void;
    onAddSubPage: (parentId: number) => void;
    level?: number;
}

const KBTree: React.FC<KBTreeProps> = ({ 
    articles, 
    parentId, 
    selectedId, 
    onSelect, 
    onAddSubPage,
    level = 0 
}) => {
    const children = articles.filter(a => a.parent_id === parentId);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const toggleExpand = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedIds(newSet);
    };

    if (children.length === 0 && level > 0) return null;

    return (
        <div className="space-y-0.5">
            {children.map(article => {
                const isSelected = selectedId === article.id;
                const hasChildren = articles.some(a => a.parent_id === article.id);
                const isExpanded = expandedIds.has(article.id);

                return (
                    <div key={article.id} className="flex flex-col">
                        <div 
                            onClick={() => onSelect(article)}
                            className={`group flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-all ${
                                isSelected 
                                    ? 'bg-orange-500/10 text-orange-500 font-semibold border-l-2 border-orange-500 rounded-l-none' 
                                    : 'hover:bg-white/5 text-white/70'
                            }`}
                            style={{ paddingLeft: `${level * 16 + 8}px` }}
                        >
                            <div 
                                onClick={(e) => hasChildren && toggleExpand(e, article.id)}
                                className={`p-0.5 rounded hover:bg-white/10 transition-colors ${!hasChildren && 'invisible'}`}
                            >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </div>
                            
                            <div className="flex-1 truncate text-sm">
                                {article.title}
                            </div>

                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddSubPage(article.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {isExpanded && (
                            <KBTree
                                articles={articles}
                                parentId={article.id}
                                selectedId={selectedId}
                                onSelect={onSelect}
                                onAddSubPage={onAddSubPage}
                                level={level + 1}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default KBTree;
