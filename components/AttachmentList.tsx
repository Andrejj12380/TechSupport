import React from 'react';
import { FileAttachment } from '../types';

interface AttachmentListProps {
  attachments: FileAttachment[];
  onRemove?: (index: number) => void;
  compact?: boolean;
  className?: string;
}

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  'application/pdf': { icon: 'PDF', color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
  'application/msword': { icon: 'DOC', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'DOCX', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  'application/vnd.ms-excel': { icon: 'XLS', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'XLSX', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  'text/plain': { icon: 'TXT', color: 'text-slate-500 bg-slate-100 dark:bg-white/5' },
  'application/zip': { icon: 'ZIP', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  'application/x-rar-compressed': { icon: 'RAR', color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10' },
};

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

function getFileInfo(mimeType: string) {
  return FILE_ICONS[mimeType] || { icon: 'FILE', color: 'text-slate-400 bg-slate-100 dark:bg-white/5' };
}

const AttachmentList: React.FC<AttachmentListProps> = ({ attachments, onRemove, compact = false, className = '' }) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {attachments.map((att, idx) => {
        const image = isImage(att.mimeType);
        const fileInfo = getFileInfo(att.mimeType);

        if (compact) {
          return (
            <div key={idx} className="inline-flex items-center gap-1.5 mr-2 mb-1">
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
                  bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300
                  hover:bg-[#FF5B00]/10 hover:text-[#FF5B00] dark:hover:text-[#FF5B00]
                  transition-colors border border-slate-200 dark:border-white/10"
              >
                {image ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                ) : (
                  <span className={`text-[10px] font-bold ${fileInfo.color.split(' ')[0]}`}>{fileInfo.icon}</span>
                )}
                <span className="max-w-[120px] truncate">{att.originalName}</span>
              </a>
              {onRemove && (
                <button
                  onClick={() => onRemove(idx)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          );
        }

        return (
          <div
            key={idx}
            className="group flex items-center gap-3 p-2.5 rounded-xl
              bg-slate-50 dark:bg-white/[0.03]
              border border-slate-100 dark:border-white/5
              hover:border-[#FF5B00]/20 dark:hover:border-[#FF5B00]/20
              transition-all duration-200"
          >
            {/* Thumbnail or Icon */}
            {image ? (
              <a href={att.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img
                  src={att.url}
                  alt={att.originalName}
                  className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-white/10
                    hover:ring-[#FF5B00]/40 transition-all"
                />
              </a>
            ) : (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                  text-xs font-black ${fileInfo.color} transition-all
                  hover:scale-105`}
              >
                {fileInfo.icon}
              </a>
            )}

            {/* File info */}
            <div className="min-w-0 flex-1">
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-700 dark:text-slate-200
                  hover:text-[#FF5B00] dark:hover:text-[#FF5B00] transition-colors
                  truncate block"
              >
                {att.originalName}
              </a>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {formatSize(att.size)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF5B00] hover:bg-[#FF5B00]/10 transition-all"
                title="Открыть"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              {onRemove && (
                <button
                  onClick={() => onRemove(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                  title="Удалить"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AttachmentList;
