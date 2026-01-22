
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { ProductionLine } from '../types';

interface ExcelImportModalProps {
    clientId: number;
    targetLine?: ProductionLine;
    onClose: () => void;
    onSuccess: () => void;
}

interface ParsedRow {
    [key: string]: any;
}

interface ColumnMapping {
    systemField: string;
    excelColumn: string;
}

const SYSTEM_FIELDS = [
    { key: 'article', label: 'Артикул' },
    { key: 'description', label: 'Описание / Модель' },
    { key: 'quantity_total', label: 'Количество (в файле)' },
];

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ clientId, targetLine, onClose, onSuccess }) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [file, setFile] = useState<File | null>(null);
    const [excelColumns, setExcelColumns] = useState<string[]>([]);
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [mapping, setMapping] = useState<ColumnMapping[]>([]);

    // Step 3 state
    const [mappedData, setMappedData] = useState<any[]>([]);
    const [importQuantities, setImportQuantities] = useState<{ [key: number]: number }>({});

    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const [hasHeaders, setHasHeaders] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            parseExcel(selectedFile, hasHeaders); // Use current state or default
        }
    };

    // Toggle header mode
    const toggleHasHeaders = () => {
        const newState = !hasHeaders;
        setHasHeaders(newState);
        if (file) {
            parseExcel(file, newState);
        }
    };

    const parseExcel = (file: File, headers: boolean) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                // Read as array of arrays to handle no-headers properly if needed, butsheet_to_json is generally fine
                const options: XLSX.Sheet2JSONOpts = { defval: "" };
                if (!headers) {
                    options.header = "A";
                }

                const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, options);

                if (json.length > 0) {
                    const columns = Object.keys(json[0]);
                    setExcelColumns(columns);
                    setParsedData(json);

                    // Simple auto-mapping
                    const initialMapping = SYSTEM_FIELDS.map(field => {
                        // fuzzy match
                        const match = columns.find(c => {
                            const lat = c.toLowerCase();
                            const key = field.key;
                            if (key === 'article') return lat.includes('арт') || lat.includes('код');
                            if (key === 'description') return lat.includes('опис') || lat.includes('наим') || lat.includes('мод');
                            if (key === 'quantity_total') return lat.includes('кол') || lat.includes('qty');
                            return false;
                        });
                        return {
                            systemField: field.key,
                            excelColumn: match || ''
                        };
                    });
                    setMapping(initialMapping);
                    setStep(2);
                } else {
                    alert('Файл пуст');
                }
            } catch (error) {
                console.error('Error parsing excel', error);
                alert('Ошибка при чтении файла');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleMappingChange = (systemField: string, excelColumn: string) => {
        setMapping(prev => prev.map(m => m.systemField === systemField ? { ...m, excelColumn } : m));
    };

    const prepareData = () => {
        const mapped = parsedData.map((row, idx) => {
            const rowData: any = { _originalIdx: idx };
            mapping.forEach(m => {
                if (m.excelColumn) {
                    rowData[m.systemField] = row[m.excelColumn];
                }
            });
            return rowData;
        });
        setMappedData(mapped);

        // Initialize quantities to 0
        const initialQ: any = {};
        mapped.forEach((_, i) => initialQ[i] = 0);
        setImportQuantities(initialQ);

        setStep(3);
    };

    const changeQuantity = (idx: number, val: string) => {
        const num = parseInt(val) || 0;
        setImportQuantities(prev => ({ ...prev, [idx]: num }));
    };

    const setMaxQuantity = (idx: number, max: any) => {
        const num = parseInt(max) || 0;
        setImportQuantities(prev => ({ ...prev, [idx]: num }));
    };

    const getTotalToImport = () => {
        return Object.values(importQuantities).reduce((a: number, b: number) => a + b, 0);
    };

    const [error, setError] = useState<string | null>(null);

    const executeImport = async () => {
        if (!targetLine) {
            setError("Линия не выбрана");
            return;
        }

        setIsImporting(true);
        setError(null);

        try {
            const rowsToProcess = mappedData.filter((_, idx) => importQuantities[idx] > 0);

            // Calculate total operations
            let totalOps = 0;
            rowsToProcess.forEach((rowData) => totalOps += importQuantities[rowData._originalIdx]);
            setProgress({ current: 0, total: totalOps });

            for (const rowData of rowsToProcess) {
                const qty = importQuantities[rowData._originalIdx];
                const name = rowData.description || 'Unknown Device';
                const article = rowData.article ? ` (${rowData.article})` : '';
                const fullName = `${name}${article}`;

                for (let i = 0; i < qty; i++) {
                    // Generate serial number from Article if available
                    // Format: Article-Index (e.g. ART123-1, ART123-2)
                    // If no article, leave null (letting DB handle it or stay null)
                    let article = null;
                    if (rowData.article) {
                        // Simple collision avoidance for this batch: Article-Index
                        article = `${rowData.article}-${i + 1}`;
                    }

                    await api.addEquipment({
                        line_id: targetLine.id,
                        type_id: 1,
                        model: fullName,
                        article: article,
                        status: 'active',
                        ip_address: null,
                        subnet_mask: null,
                        gateway: null,
                        db_connection: null,
                        notes: '',
                        install_date: new Date().toISOString().split('T')[0]
                    });
                    setProgress(p => ({ ...p, current: p.current + 1 }));
                }
            }
            onSuccess();
            onClose();
        } catch (e: any) {
            console.error('Import Error:', e);
            setError(e.message || 'Ошибка импорта');
        } finally {
            setIsImporting(false);
        }
    };

    const inputClass = "w-full border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#FF5B00]";

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-150 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">Импорт оборудования</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm font-medium border border-red-100 flex items-center gap-2">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}>
                            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                            <div className="text-4xl mb-4">📊</div>
                            <p className="font-bold text-slate-700">Загрузите файл спецификации</p>
                            <p className="text-sm text-slate-400 mt-2">.xlsx, .xls</p>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-sm text-slate-500">Сопоставьте колонки</p>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={hasHeaders}
                                        onChange={toggleHasHeaders}
                                        className="rounded border-slate-300 text-[#FF5B00] focus:ring-[#FF5B00]"
                                    />
                                    Первая строка - заголовки
                                </label>
                            </div>
                            <div className="grid gap-3 max-w-md mx-auto">
                                {mapping.map((m) => (
                                    <div key={m.systemField} className="grid grid-cols-2 gap-4 items-center">
                                        <div className="text-sm font-medium text-slate-700 text-right">{SYSTEM_FIELDS.find(f => f.key === m.systemField)?.label}</div>
                                        <select
                                            className="border border-slate-200 rounded-lg p-2 text-sm bg-white"
                                            value={m.excelColumn}
                                            onChange={(e) => handleMappingChange(m.systemField, e.target.value)}
                                        >
                                            <option value="">-- Не импортировать --</option>
                                            {excelColumns.map(col => (
                                                <option key={col} value={col}>{col}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            {isImporting ? (
                                <div className="text-center py-12">
                                    <div className="text-2xl font-bold text-[#FF5B00] mb-2">{Math.round((progress.current / progress.total) * 100) || 0}%</div>
                                    <p className="text-slate-500">Создание оборудования... ({progress.current} / {progress.total})</p>
                                    <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                                        <div className="bg-[#FF5B00] h-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg border border-orange-100">
                                        <div className="text-xs font-bold text-[#FF5B00] uppercase tracking-wider">Линия: {targetLine?.name}</div>
                                        <div className="text-xs text-slate-500">К добавлению: <b>{getTotalToImport()} шт.</b></div>
                                    </div>

                                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-left text-sm relative">
                                            <thead className="bg-slate-50 text-xs font-bold text-slate-500 sticky top-0 shadow-sm z-10">
                                                <tr>
                                                    <th className="p-3 w-16 text-center">Импорт</th>
                                                    <th className="p-3">Артикул</th>
                                                    <th className="p-3">Описание</th>
                                                    <th className="p-3 w-24 text-right">Всего</th>
                                                    <th className="p-3 w-24 text-center">Выбрать</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {mappedData.map((row) => (
                                                    <tr key={row._originalIdx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-3 text-center">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                className="w-12 text-center border rounded p-1 font-bold text-[#FF5B00]"
                                                                value={importQuantities[row._originalIdx]}
                                                                onChange={(e) => changeQuantity(row._originalIdx, e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-3 font-mono text-xs text-slate-500">{row.article}</td>
                                                        <td className="p-3 text-slate-700 font-medium">{row.description}</td>
                                                        <td className="p-3 text-right text-slate-400">{row.quantity_total}</td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => setMaxQuantity(row._originalIdx, row.quantity_total)}
                                                                className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600"
                                                            >
                                                                Макс ({row.quantity_total})
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t bg-slate-50 flex justify-end gap-3">
                    {step === 2 && (
                        <button onClick={prepareData} className="bg-[#FF5B00] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#e65200]">
                            К списку →
                        </button>
                    )}
                    {step === 3 && !isImporting && (
                        <button
                            onClick={executeImport}
                            disabled={getTotalToImport() === 0}
                            className={`px-6 py-2 rounded-xl font-bold shadow-lg transition-all ${getTotalToImport() === 0 ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-[#FF5B00] text-white hover:bg-[#e65200] shadow-[#FF5B00]/20'}`}
                        >
                            Импортировать ({getTotalToImport()})
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExcelImportModal;
