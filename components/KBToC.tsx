import React, { useEffect, useState } from 'react';
import { List } from 'lucide-react';

interface ToCItem {
    id: string;
    text: string;
    level: number;
}

interface KBToCProps {
    content: string; // HTML from TipTap
}

const KBToC: React.FC<KBToCProps> = ({ content }) => {
    const [headings, setHeadings] = useState<ToCItem[]>([]);

    useEffect(() => {
        // Parse the HTML content to find headings
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const headingElements = doc.querySelectorAll('h1, h2, h3');
        
        const items: ToCItem[] = Array.from(headingElements).map((el, i) => {
            const id = el.id || `heading-${i}`;
            // If the element doesn't have an ID, we'll need to handle it in the editor
            // but for now we extract text
            return {
                id,
                text: el.textContent || '',
                level: parseInt(el.tagName[1])
            };
        });

        setHeadings(items);
    }, [content]);

    if (headings.length === 0) return null;

    return (
        <div className="w-64 flex-shrink-0 hidden xl:flex flex-col sticky top-10 self-start p-6 border-l border-white/10 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                <List className="w-3 h-3 text-primary" />
                Оглавление
            </h3>
            <nav className="space-y-3">
                {headings.map((h, i) => (
                    <a
                        key={i}
                        href={`#${h.id}`}
                        onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById(h.id);
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`block text-xs font-semibold overflow-hidden text-ellipsis transition-all hover:text-primary ${
                            h.level === 1 ? 'text-white pl-0' :
                            h.level === 2 ? 'text-white/60 pl-3' :
                            'text-white/40 pl-6'
                        }`}
                    >
                        {h.text}
                    </a>
                ))}
            </nav>
        </div>
    );
};

export default KBToC;
