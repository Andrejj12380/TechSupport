import React, { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { FileAttachment } from '../types';

interface FileUploaderProps {
  directory: 'avatars' | 'tickets' | 'equipment' | 'kb';
  multiple?: boolean;
  onUpload: (attachment: FileAttachment) => void;
  compact?: boolean;
  accept?: string; // e.g. "image/*" for avatars
  className?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  directory,
  multiple = true,
  onUpload,
  compact = false,
  accept,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    setProgress(0);

    for (let i = 0; i < fileArray.length; i++) {
      try {
        const result = await api.uploadFile(directory, fileArray[i]);
        onUpload(result);
        setProgress(Math.round(((i + 1) / fileArray.length) * 100));
      } catch (err) {
        console.error('Upload error:', err);
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      }
    }

    setIsUploading(false);
    setProgress(0);
    // Reset input so same file can be re-uploaded
    if (inputRef.current) inputRef.current.value = '';
  }, [directory, onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleClick = () => inputRef.current?.click();

  if (compact) {
    return (
      <div className={className}>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
            rounded-lg transition-all duration-200
            bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300
            hover:bg-[#FF5B00]/10 hover:text-[#FF5B00] dark:hover:bg-[#FF5B00]/10 dark:hover:text-[#FF5B00]
            border border-slate-200 dark:border-white/10
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
          {isUploading ? `${progress}%` : 'Прикрепить'}
        </button>
        {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer
          transition-all duration-300 ease-out group
          ${isDragging
            ? 'border-[#FF5B00] bg-[#FF5B00]/5 dark:bg-[#FF5B00]/10 scale-[1.01]'
            : 'border-slate-200 dark:border-white/10 hover:border-[#FF5B00]/40 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        {/* Animated background glow on drag */}
        {isDragging && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#FF5B00]/5 to-orange-500/5 animate-pulse" />
        )}

        <div className="relative z-10">
          <div className={`
            mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-300
            ${isDragging
              ? 'bg-[#FF5B00]/20 text-[#FF5B00] scale-110'
              : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 group-hover:text-[#FF5B00] group-hover:bg-[#FF5B00]/10'
            }
          `}>
            {isUploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>

          {isUploading ? (
            <>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Загрузка... {progress}%</p>
              <div className="mt-2 mx-auto max-w-[200px] h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF5B00] to-orange-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {isDragging ? 'Отпустите для загрузки' : 'Перетащите файлы сюда'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                или <span className="text-[#FF5B00] font-medium">нажмите для выбора</span>
              </p>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-2 text-center">{error}</p>
      )}
    </div>
  );
};

export default FileUploader;
