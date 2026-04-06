import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';

import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Placeholder from '@tiptap/extension-placeholder';

import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Details, { DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import { all } from 'lowlight';
import { createLowlight } from 'lowlight';
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Quote,
    Heading1,
    Heading2,
    Heading3,
    Code,
    Type,
    Highlighter,
    Trash2,
    Plus,
    ChevronRight,
    Link as LinkIcon
} from 'lucide-react';

const lowlight = createLowlight(all);

const COMMANDS = [
    { id: 'p', title: 'Текст', description: 'Обычный текст', icon: Type },
    { id: 'h1', title: 'Заголовок 1', description: 'Самый крупный размер', icon: Heading1 },
    { id: 'h2', title: 'Заголовок 2', description: 'Средний размер', icon: Heading2 },
    { id: 'h3', title: 'Заголовок 3', description: 'Мелкий размер', icon: Heading3 },
    { id: 'bulletList', title: 'Список', description: 'Обычный маркированный список', icon: List },
    { id: 'codeBlock', title: 'Код', description: 'Блок кода с подсветкой', icon: Code },
    { id: 'blockquote', title: 'Цитата', description: 'Визуальное выделение цитаты', icon: Quote },
    { id: 'details', title: 'Toggle list', description: 'Раскрывающийся список (спойлер)', icon: ChevronRight },
    { id: 'link', title: 'Ссылка', description: 'Вставить гиперссылку', icon: LinkIcon },
];

interface NotionEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

const NotionEditor: React.FC<NotionEditorProps> = ({ content, onChange, placeholder = "Нажмите '/' для команд..." }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [filterText, setFilterText] = useState('');
    const [slashPos, setSlashPos] = useState(0);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
                heading: false, // Disable default heading to use custom one
            }),
            Heading.extend({
                renderHTML({ node, HTMLAttributes }) {
                    const hasLevel = this.options.levels.includes(node.attrs.level);
                    const level = hasLevel ? node.attrs.level : this.options.levels[0];
                    // Generate ID from text content for ToC support
                    const id = node.textContent
                        .toLowerCase()
                        .trim()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/[\s_-]+/g, '-')
                        .replace(/^-+|-+$/g, '') || `h-${Math.random().toString(36).substr(2, 9)}`;

                    return [
                        `h${level}`,
                        { ...HTMLAttributes, id },
                        0,
                    ];
                },
            }),
            Placeholder.configure({

                placeholder: ({ node }) => {
                    if (node.type.name === 'heading') {
                        return `Заголовок ${node.attrs.level}`;
                    }
                    return placeholder;
                },
            }),
            Link.configure({
                openOnClick: false,
            }),
            Highlight,
            CodeBlockLowlight.configure({
                lowlight,
            }),
            Details.configure({
                persist: true,
                openClassName: 'is-open',
                HTMLAttributes: {
                    class: 'details-block',
                },
                renderToggleButton: ({ element }) => {
                    element.innerHTML = '<span></span>';
                    element.className = 'details-toggle-button';
                }
            }),
            DetailsSummary.configure({
                HTMLAttributes: {
                    class: 'details-summary',
                },
            }),
            DetailsContent.configure({
                HTMLAttributes: {
                    class: 'details-content',
                },
            }),
        ],
        content: content,
        editorProps: {
            attributes: {
                class: 'prose prose-lg dark:prose-invert focus:outline-none max-w-none min-h-[500px]',
            },
            handleKeyDown: (view, event) => {
                if (event.key === '/') {
                    const { selection } = view.state;
                    const coords = view.coordsAtPos(selection.from);
                    
                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        setMenuPosition({ 
                            top: coords.bottom - rect.top, 
                            left: coords.left - rect.left 
                        });
                    }
                    
                    setSlashPos(selection.from);
                    setSelectedIndex(0);
                    setFilterText('');
                    setIsMenuOpen(true);
                    return false;
                }

                if (isMenuOpen) {
                    if (event.key === 'ArrowDown') {
                        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
                        return true;
                    }
                    if (event.key === 'ArrowUp') {
                        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                        return true;
                    }
                    if (event.key === 'Enter') {
                        const command = filteredCommands[selectedIndex];
                        if (command) {
                            addBlock(command.id);
                            return true;
                        }
                    }
                    if (event.key === 'Escape') {
                        setIsMenuOpen(false);
                        return true;
                    }
                    if (event.key === 'Backspace' && filterText === '') {
                        setIsMenuOpen(false);
                        return false;
                    }
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            const { selection } = editor.state;
            if (isMenuOpen) {
                const text = editor.state.doc.textBetween(slashPos + 1, selection.from);
                setFilterText(text);
                setSelectedIndex(0);
                
                // Close if we moved away from the slash line or if it was deleted
                if (selection.from <= slashPos) {
                    setIsMenuOpen(false);
                }
            }
            onChange(editor.getHTML());
        },
    });

    const filteredCommands = useMemo(() => {
        return COMMANDS.filter(cmd => 
            cmd.title.toLowerCase().includes(filterText.toLowerCase()) || 
            cmd.id.toLowerCase().includes(filterText.toLowerCase())
        );
    }, [filterText]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClick = () => setIsMenuOpen(false);
        if (isMenuOpen) {
            window.addEventListener('click', handleClick);
        }
        return () => window.removeEventListener('click', handleClick);
    }, [isMenuOpen]);

    if (!editor) return null;

    const addBlock = (type: string) => {
        if (!editor) return;

        // Position where the slash command started
        const { from } = editor.state.selection;
        
        // Remove the slash and any filter text
        editor.chain()
            .focus()
            .deleteRange({ from: slashPos, to: from })
            .run();

        if (type === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
        else if (type === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
        else if (type === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
        else if (type === 'paragraph') editor.chain().focus().setParagraph().run();
        else if (type === 'bulletList') editor.chain().focus().toggleBulletList().run();
        else if (type === 'orderedList') editor.chain().focus().toggleOrderedList().run();
        else if (type === 'codeBlock') editor.chain().focus().toggleCodeBlock().run();
        else if (type === 'blockquote') editor.chain().focus().toggleBlockquote().run();
        else if (type === 'details') {
            editor.chain()
                .focus()
                .insertContent([
                    {
                        type: 'details',
                        content: [
                            {
                                type: 'detailsSummary',
                                content: [{ type: 'text', text: 'Заголовок списка' }]
                            },
                            {
                                type: 'detailsContent',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'Здесь ваш контент...' }]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        type: 'paragraph'
                    }
                ])
                .run();
        }
        else if (type === 'link') {
            const url = window.prompt('URL:');
            if (url) {
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
        }
        
        setIsMenuOpen(false);
    };

    return (
        <div ref={containerRef} className="relative w-full max-w-4xl mx-auto pt-0 pb-10">
            {/* Bubble Menu for formatting on selection */}
            <BubbleMenu editor={editor} className="flex bg-slate-900/90 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-1 gap-1 overflow-hidden animate-in zoom-in-95 duration-100">
                <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${editor.isActive('bold') ? 'text-primary' : 'text-white'}`}>
                    <Bold className="w-4 h-4" />
                </button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${editor.isActive('italic') ? 'text-primary' : 'text-white'}`}>
                    <Italic className="w-4 h-4" />
                </button>
                <button onClick={() => {
                    const url = window.prompt('Введите URL');
                    if (url) editor.chain().focus().setLink({ href: url }).run();
                }} className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${editor.isActive('link') ? 'text-primary' : 'text-white'}`}>
                    <LinkIcon className="w-4 h-4" />
                </button>
                <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${editor.isActive('highlight') ? 'text-primary' : 'text-white'}`}>
                    <Highlighter className="w-4 h-4" />
                </button>
            </BubbleMenu>

            {/* Slash Commands Menu */}
            {isMenuOpen && filteredCommands.length > 0 && (
                <div 
                    className="absolute z-[100] bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-64 overflow-hidden animate-in slide-in-from-bottom-2 duration-200"
                    style={{ top: `${menuPosition.top + 10}px`, left: `${menuPosition.left}px` }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-2 text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5 bg-white/5">
                        Основные блоки
                    </div>
                    <div className="max-h-80 overflow-y-auto p-1">
                        {filteredCommands.map((command, i) => (
                            <button 
                                key={command.id}
                                onClick={() => addBlock(command.id)} 
                                onMouseEnter={() => setSelectedIndex(i)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left group ${
                                    selectedIndex === i ? 'bg-primary/20 text-white' : 'text-white/70 hover:bg-white/5'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded border border-white/5 flex items-center justify-center transition-colors ${
                                    selectedIndex === i ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5'
                                }`}>
                                    <command.icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className={`text-sm font-semibold ${selectedIndex === i ? 'text-white' : 'text-white/80'}`}>{command.title}</div>
                                    <div className="text-[10px] text-white/40">{command.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <EditorContent editor={editor} />
        </div>
    );
};

export default NotionEditor;
