import React, { useState, useEffect } from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { api } from '../services/api';

interface NotionEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

const NotionEditor: React.FC<NotionEditorProps> = ({ content, onChange, placeholder = "Нажмите '/' для команд..." }) => {
    // We track if the editor has loaded initial content to prevent cursor jumps
    const [isLoaded, setIsLoaded] = useState(false);

    const editor = useCreateBlockNote({
        uploadFile: async (file: File) => {
            try {
                const attachment = await api.uploadFile('kb', file);
                return attachment.url;
            } catch (error) {
                console.error("Failed to upload file:", error);
                throw error;
            }
        }
    });

    // Load initial HTML into the editor when it first mounts
    useEffect(() => {
        if (!isLoaded && editor) {
            const loadHtml = async () => {
                if (content) {
                    const blocks = await editor.tryParseHTMLToBlocks(content);
                    editor.replaceBlocks(editor.document, blocks);
                }
                setIsLoaded(true);
            };
            loadHtml();
        }
    }, [editor, isLoaded, content]);

    if (!editor) return null;

    return (
        <div className="w-full max-w-4xl mx-auto pt-0 pb-10">
            <BlockNoteView
                editor={editor}
                theme="dark" // TechSupport Pro uses dark mode heavily
                onChange={async () => {
                    const html = await editor.blocksToHTMLLossy(editor.document);
                    onChange(html);
                }}
            />
        </div>
    );
};

export default NotionEditor;
