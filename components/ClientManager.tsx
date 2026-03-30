
import React, { useState, useEffect } from 'react';
import { Factory, TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, ChevronRight, ChevronDown, Workflow } from 'lucide-react';
import { api } from '../services/api';
import { Client, Site, ProductionLine, Equipment, RemoteAccess, Instruction, EquipmentStatus, User, SiteContact } from '../types';
import { IconChevronRight, IconCopy, IconChevronLeft, IconChevronDown } from './Icons';
import ExcelImportModal from './ExcelImportModal';

const inputClass = "w-full bg-surface-50 dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-300 focus:ring-2 focus:ring-primary focus:bg-white outline-none transition-all shadow-inner";

const Modal = ({ title, children, onClose, onSubmit }: { title: string; children?: React.ReactNode; onClose: () => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void }) => (
  <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-6 sm:p-10">
    <div className="bg-white dark:bg-surface-900 rounded-[3rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-surface-100 dark:border-surface-800">
      <div className="p-10 pb-6 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-50/30 dark:bg-surface-800/20 shrink-0">
        <div>
          <h3 className="font-display font-black text-3xl text-slate-950 dark:text-white uppercase tracking-tight leading-none">{title}</h3>
          <div className="h-1 w-12 bg-primary mt-3 rounded-full"></div>
        </div>
        <button
          onClick={onClose}
          className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-red-50 hover:text-red-500 text-slate-400 transition-all group"
        >
          <div className="text-3xl font-light transform group-hover:rotate-90 transition-transform">&times;</div>
        </button>
      </div>
      <form onSubmit={onSubmit} className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
        {children}
        <div className="flex gap-4 pt-10 border-t border-surface-100 dark:border-surface-800 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-8 py-4 border-2 border-surface-100 dark:border-surface-700 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-all active:scale-95"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="flex-1 px-8 py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            Сохранить изменения
          </button>
        </div>
      </form>
    </div>
  </div>
);



interface ClientManagerProps {
  user: User;
}

const getLineStatus = (line: ProductionLine, now: Date) => {
  const warrantyStart = line.warranty_start_date ? new Date(line.warranty_start_date) : null;

  // Calculate relative dates
  const isPost2026 = warrantyStart && warrantyStart.getFullYear() >= 2026;

  const supportEnd = warrantyStart ? new Date(warrantyStart) : null;
  if (supportEnd) supportEnd.setMonth(supportEnd.getMonth() + (isPost2026 ? 2 : 12));

  const warrantyEnd = warrantyStart ? new Date(warrantyStart) : null;
  if (warrantyEnd) warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);

  const paidStart = line.paid_support_start_date ? new Date(line.paid_support_start_date) : null;
  const paidEnd = line.paid_support_end_date ? new Date(line.paid_support_end_date) : null;

  const formatRemaining = (endDate: Date) => {
    const diff = endDate.getTime() - now.getTime();
    if (diff < 0) return 'Истекла';

    const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (totalDays < 30) return `Осталось ${totalDays} дн.`;

    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = (totalDays % 365) % 30;

    if (years === 0) {
      return `Осталось ${months} мес.` + (days > 0 ? ` ${days} дн.` : '');
    }
    return `Осталось ${years} г.` + (months > 0 ? ` ${months} мес.` : '');
  };

  // 1. Paid support (highest priority)
  if (paidStart && paidEnd && now >= paidStart && now <= paidEnd) {
    const remaining = formatRemaining(paidEnd);
    return {
      status: 'paid',
      label: 'Техподдержка',
      color: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50',
      remaining,
      tooltip: `Платная поддержка до ${paidEnd.toLocaleDateString()} (${remaining})`
    };
  }

  // 2. Active Support + Warranty (Emerald)
  // For pre-2026 this lasts 12m. For post-2026 this lasts 2m.
  if (warrantyStart && supportEnd && now >= warrantyStart && now <= supportEnd) {
    const remaining = formatRemaining(supportEnd);
    return {
      status: 'warranty',
      label: isPost2026 ? 'Гарантия + Подд.' : 'Гарантия',
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50',
      remaining,
      tooltip: `Полная поддержка и гарантия до ${supportEnd.toLocaleDateString()} (${remaining})`
    };
  }

  // 3. Hardware Warranty ONLY (Amber)
  // Only applies to post-2026 projects during months 3-12
  if (isPost2026 && warrantyEnd && now > supportEnd && now <= warrantyEnd) {
    const remaining = formatRemaining(warrantyEnd);
    return {
      status: 'warranty_only',
      label: 'Гарантия',
      color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50',
      remaining,
      tooltip: `Только аппаратная гарантия до ${warrantyEnd.toLocaleDateString()} (${remaining}). Бесплатная поддержка истекла.`
    };
  }

  // 4. Expired
  if ((paidEnd && now > paidEnd) || (warrantyEnd && now > warrantyEnd)) {
    return {
      status: 'expired',
      label: 'Истекла',
      color: 'bg-red-50 text-red-400 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50',
      remaining: '',
      tooltip: 'Срок поддержки и гарантии истек'
    };
  }

  return {
    status: 'none',
    label: 'Нет',
    color: 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700',
    remaining: '',
    tooltip: 'Поддержка не активна/не известна'
  };
};

const ClientManager: React.FC<ClientManagerProps> = ({ user }) => {
  const isAdmin = user.role === 'admin';
  const isEngineer = user.role === 'engineer' || isAdmin;
  const isViewer = user.role === 'viewer';

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<ProductionLine | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [remote, setRemote] = useState<RemoteAccess[]>([]);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [allLines, setAllLines] = useState<ProductionLine[]>([]);
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dragActiveDocs, setDragActiveDocs] = useState(false);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);

  // Modal & Edit State
  const [modal, setModal] = useState<{ type: string; data: any } | null>(null);
  const [equipSearchQuery, setEquipSearchQuery] = useState('');
  const [equipSearchResults, setEquipSearchResults] = useState<any[]>([]);
  const [draggedEquipId, setDraggedEquipId] = useState<number | null>(null);
  const [l3Provider, setL3Provider] = useState<string>('');
  const [supportFilter, setSupportFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [searchClientQuery, setSearchClientQuery] = useState('');

  const [isLoading, setIsLoading] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!(params.get('client') || params.get('line'));
  });

  // Combined initialization and navigation
  useEffect(() => {
    const init = async () => {
      const [allClients, allLinesData] = await Promise.all([
        api.getClients(),
        api.getAllLines()
      ]);
      setClients(allClients);
      setAllLines(allLinesData);

      const params = new URLSearchParams(window.location.search);
      const clientId = params.get('client');
      const siteId = params.get('site');
      const lineId = params.get('line');
      const equipmentId = params.get('equipment');
      const support = params.get('support');

      if (support === 'active') setSupportFilter('active');
      else if (support === 'expired') setSupportFilter('expired');

      if (clientId || lineId || equipmentId) {
        setIsLoading(true); // Ensure loading is shown
        try {
          if (lineId) {
            const allLines = await api.getAllLines();
            const targetLine = allLines.find(l => l.id === parseInt(lineId));
            if (targetLine) {
              for (const client of allClients) {
                const siteList = await api.getSites(client.id);
                const site = siteList.find(s => s.id === targetLine.site_id);
                if (site) {
                  setSelectedClient(client);
                  setSites(siteList);
                  setSelectedSite(site);
                  const lineList = await api.getLines(site.id);
                  setLines(lineList);
                  setSelectedLine(targetLine);
                  // Load line-specific data
                  setEquipment(await api.getEquipment(targetLine.id));
                  setRemote(await api.getRemoteAccess(targetLine.id));
                  setInstructions(await api.getInstructions(targetLine.id));
                  setIsLoading(false);
                  return;
                }
              }
            }
          }

          if (clientId) {
            const targetClient = allClients.find(c => c.id === parseInt(clientId));
            if (targetClient) {
              setSelectedClient(targetClient);
              const siteList = await api.getSites(targetClient.id);
              setSites(siteList);

              if (siteId) {
                const targetSite = siteList.find(s => s.id === parseInt(siteId));
                if (targetSite) {
                  setSelectedSite(targetSite);
                  const lineList = await api.getLines(targetSite.id);
                  setLines(lineList);

                  if (lineId) {
                    const targetLine = lineList.find(l => l.id === parseInt(lineId));
                    if (targetLine) {
                      setSelectedLine(targetLine);
                      setEquipment(await api.getEquipment(targetLine.id));
                      setRemote(await api.getRemoteAccess(targetLine.id));
                      setInstructions(await api.getInstructions(targetLine.id));
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Navigation error", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const loadClients = async () => setClients(await api.getClients());

  const handleClientSelect = async (client: Client) => {
    if (selectedClient?.id === client.id) {
      setSelectedClient(null);
      setSelectedSite(null);
      setSelectedLine(null);
      setSites([]);
      setLines([]);
      setEquipment([]);
      // Clear URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('client');
      url.searchParams.delete('site');
      url.searchParams.delete('line');
      url.searchParams.delete('equipment');
      window.history.pushState({}, '', url.toString());
      return;
    }

    setSelectedClient(client);
    setSelectedSite(null);
    setSelectedLine(null);
    setLines([]); // Clear stale lines from previous client
    setSites(await api.getSites(client.id));

    const url = new URL(window.location.href);
    url.searchParams.set('client', client.id.toString());
    url.searchParams.delete('site'); // Also clear site param
    url.searchParams.delete('line');
    url.searchParams.delete('equipment');
    window.history.pushState({}, '', url.toString());
  };

  const handleSiteSelect = async (site: Site) => {
    setSelectedSite(site);
    setSelectedLine(null);
    setLines(await api.getLines(site.id));
    const url = new URL(window.location.href);
    url.searchParams.set('site', site.id.toString());
    url.searchParams.delete('line');
    url.searchParams.delete('equipment');
    window.history.pushState({}, '', url.toString());
  };

  const handleLineSelect = async (line: ProductionLine) => {
    setSelectedLine(line);
    setEquipment(await api.getEquipment(line.id));
    setRemote(await api.getRemoteAccess(line.id));
    setInstructions(await api.getInstructions(line.id));
    const url = new URL(window.location.href);
    url.searchParams.set('line', line.id.toString());
    url.searchParams.delete('equipment');
    window.history.pushState({}, '', url.toString());

    // Auto-scroll to top to ensure the selected line's details are visible in view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeEquipStatus = async (id: number, status: EquipmentStatus) => {
    // Оптимистичное обновление для мгновенной обратной связи
    setEquipment(prev => prev.map(e => e.id === id ? { ...e, status } : e));

    try {
      await api.updateEquipmentStatus(id, status);
      // Перезагрузка для подтверждения изменений
      if (selectedLine) setEquipment(await api.getEquipment(selectedLine.id));
    } catch (error) {
      // Откат при ошибке
      if (selectedLine) setEquipment(await api.getEquipment(selectedLine.id));
    }
  };

  const handleDeleteEquip = async (id: number) => {
    if (window.confirm('Удалить оборудование?')) {
      await api.deleteEquipment(id);
      if (selectedLine) setEquipment(await api.getEquipment(selectedLine.id));
    }
  };

  const handleDeleteRemote = async (id: number) => {
    if (window.confirm('Удалить этот доступ?')) {
      await api.deleteRemoteAccess(id);
      if (selectedLine) setRemote(await api.getRemoteAccess(selectedLine.id));
    }
  };

  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, equipId: number) => {
    setDraggedEquipId(equipId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', equipId.toString());
    
    // Create a ghost image or just let browser handle it
    const target = e.currentTarget as HTMLElement;
    target.classList.add('dragging');
  };

  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== targetId) setDragOverId(targetId);
  };

  const handleDrop = async (e: React.DragEvent, targetEquipId: number) => {
    e.preventDefault();
    setDragOverId(null);
    
    const draggedIdStr = e.dataTransfer.getData('text/plain');
    const actualDraggedId = draggedIdStr ? parseInt(draggedIdStr, 10) : draggedEquipId;

    if (!actualDraggedId || actualDraggedId === targetEquipId || !selectedLine) {
        setDraggedEquipId(null);
        return;
    }

    const draggedIndex = equipment.findIndex(eq => eq.id === actualDraggedId);
    const targetIndex = equipment.findIndex(eq => eq.id === targetEquipId);

    if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedEquipId(null);
        return;
    }

    const newEquipment = [...equipment];
    const [draggedItem] = newEquipment.splice(draggedIndex, 1);
    newEquipment.splice(targetIndex, 0, draggedItem);

    const updates = newEquipment.map((eq, index) => ({
      id: eq.id,
      display_order: index
    }));

    setEquipment(newEquipment);
    setDraggedEquipId(null);

    try {
      await Promise.all(
        updates.map(({ id, display_order }) => api.updateEquipmentOrder(id, display_order))
      );
    } catch (error) {
      console.error('Failed to update equipment order:', error);
      setEquipment(await api.getEquipment(selectedLine.id));
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedEquipId(null);
    setDragOverId(null);
    (e.currentTarget as HTMLElement).classList.remove('dragging');
  };

  const handleDeleteClient = async (id: number) => {
    if (window.confirm('Удалить клиента и все связанные данные?')) {
      await api.deleteClient(id);
      await loadClients();
      setSelectedClient(null);
      setSelectedSite(null);
      setSelectedLine(null);
    }
  };

  const handleDeleteSite = async (id: number) => {
    if (window.confirm('Удалить площадку и все связанные данные?')) {
      await api.deleteSite(id);
      if (selectedClient) {
        setSites(await api.getSites(selectedClient.id));
        setSelectedSite(null);
        setSelectedLine(null);
      }
    }
  };

  const handleDeleteLine = async (id: number) => {
    if (window.confirm('Удалить линию и все связанные данные?')) {
      await api.deleteLine(id);
      if (selectedSite) {
        setLines(await api.getLines(selectedSite.id));
        setAllLines(await api.getAllLines());
        setSelectedLine(null);
      }
    }
  };

  const handleDuplicateLine = async (line: ProductionLine) => {
    if (!selectedSite) return;
    if (!window.confirm(`Дублировать линию "${line.name}" вместе с оборудованием?`)) return;
    try {
      const newLine = await api.duplicateLine(line.id);
      const updatedLines = await api.getLines(selectedSite.id);
      setLines(updatedLines);
      setAllLines(await api.getAllLines());
      // Auto-select the newly created line and load its related data
      await handleLineSelect(newLine);
      setToastMessage(`Линия продублирована: ${newLine.name}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Duplicate line failed', err);
      alert('Ошибка при дублировании линии');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      if (modal?.type === 'client') {
        const result = modal.data ? await api.updateClient(modal.data.id, payload) : await api.addClient(payload);
        await loadClients();
        if (selectedClient && (modal.data?.id === selectedClient.id || !modal.data)) {
          setSelectedClient(result);
        }
      } else if (modal?.type === 'site' && selectedClient) {
        let updatedSites: Site[];
        if (modal.data) {
          await api.updateSite(modal.data.id, payload);
          updatedSites = await api.getSites(selectedClient.id);
          setSites(updatedSites);
          setSelectedSite(updatedSites.find(s => s.id === modal.data.id) ?? null);
        } else {
          const newSite = await api.addSite({ ...payload, client_id: selectedClient.id });
          updatedSites = await api.getSites(selectedClient.id);
          setSites(updatedSites);
          setSelectedSite(updatedSites.find(s => s.id === newSite.id) ?? null);
        }
      } else if (modal?.type === 'line') {
        const targetSiteId = selectedSite ? selectedSite.id : parseInt(payload.site_id as string, 10);
        if (!targetSiteId && !modal.data) throw new Error("Необходима площадка");
        modal.data ? await api.updateLine(modal.data.id, payload) : await api.addLine({ ...payload, site_id: targetSiteId });
        
        if (selectedSite) {
          const updatedLines = await api.getLines(selectedSite.id);
          setLines(updatedLines);
          if (selectedLine && modal.data?.id === selectedLine.id) {
            setSelectedLine(updatedLines.find(l => l.id === selectedLine.id) || null);
          }
        }
        
        setAllLines(await api.getAllLines());
        if (selectedClient && !modal.data) {
           setSites(await api.getSites(selectedClient.id));
        }
      } else if (modal?.type === 'equipment' && selectedLine) {
        modal.data && modal.data.id
          ? await api.updateEquipment(modal.data.id, payload)
          : await api.addEquipment({
            ...payload,
            line_id: selectedLine.id,
            status: (payload.status as EquipmentStatus) || 'active',
            install_date: new Date().toISOString().split('T')[0]
          });
        setEquipment(await api.getEquipment(selectedLine.id));
      } else if (modal?.type === 'remote' && selectedLine) {
        await api.saveRemoteAccess(modal.data?.id || null, { ...payload, line_id: selectedLine.id });
        setRemote(await api.getRemoteAccess(selectedLine.id));
      } else if (modal?.type === 'instruction' && selectedLine) {
        // Attach to current line
        const instructionPayload = { ...payload, line_id: selectedLine.id };
        if (modal.data?.id) {
          await api.saveInstruction(modal.data.id, instructionPayload);
        } else {
          await api.saveInstruction(null, instructionPayload);
        }
        setInstructions(await api.getInstructions(selectedLine.id));
      } else if (modal?.type === 'site_contact' && selectedSite) {
        if (modal.data?.id) {
          await api.updateSiteContact(modal.data.id, payload);
        } else {
          await api.addSiteContact(selectedSite.id, payload);
        }
        const updatedSites = await api.getSites(selectedClient!.id);
        setSites(updatedSites);
        setSelectedSite(updatedSites.find(s => s.id === selectedSite.id) ?? selectedSite);
      }
      setModal(null);
      setEquipSearchQuery('');
      setEquipSearchResults([]);
    } catch (err) {
      alert('Ошибка при сохранении данных');
    }
  };

  const searchGlobalEquip = async (q: string) => {
    setEquipSearchQuery(q);
    if (q.length > 2) {
      const results = await api.search(q);
      setEquipSearchResults(results.filter(r => r.type === 'Оборудование'));
    } else {
      setEquipSearchResults([]);
    }
  };

  const openInExplorer = (text?: string | null) => {
    if (!text) {
      setToastMessage('Пустая ссылка');
      return;
    }

    // Build a file:// URL from UNC or raw path
    let fileUrl = text;
    try {
      if (/^\\\\/.test(text)) {
        // Strip leading backslashes and convert to host/path
        const withoutLeading = text.replace(/^\\\\+/, '');
        const parts = withoutLeading.replace(/\\/g, '/');
        fileUrl = 'file://' + parts;
      } else if (!/^file:/i.test(text) && !/^https?:/i.test(text)) {
        // If it's a plain windows path like C:\dir\file -> convert slashes
        const converted = text.replace(/\\/g, '/');
        fileUrl = 'file://' + converted;
      }

      const win = window.open(fileUrl, '_blank');
      if (!win) {
        setToastMessage('Браузер, вероятно, блокирует открытие file://. Используйте "Копировать ссылку" и вставьте в Проводник.');
      } else {
        setToastMessage('Пытаюсь открыть Проводник… Если не открылось — используйте "Копировать ссылку".');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error('Open in Explorer failed', err);
      setToastMessage('Не удалось открыть Проводник — используйте "Копировать ссылку".');
    }
  };

  const onInstructionDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragActiveDocs(true);
  };

  const onInstructionDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActiveDocs(false);
  };

  const onInstructionDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActiveDocs(false);

    if (!selectedLine) {
      setToastMessage('Выберите линию прежде чем загружать файлы');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    setIsUploadingDocs(true);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        await api.uploadInstructionAttachment(selectedLine.id, fd);
      }
      setInstructions(await api.getInstructions(selectedLine.id));
      setToastMessage(`Загружено ${files.length} файл(ов)`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Upload failed', err);
      setToastMessage('Ошибка при загрузке файла');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsUploadingDocs(false);
    }
  };

  const currentNow = React.useMemo(() => new Date(), []);

  const filteredClients = React.useMemo(() => {
    return clients.filter(c => {
      const q = searchClientQuery.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q)) return false;

      if (supportFilter === 'all') return true;
      const clientLines = allLines.filter(l => l.client_id === c.id);
      if (supportFilter === 'active') {
        return clientLines.some(l => {
          const s = getLineStatus(l, currentNow);
          return s.status === 'paid' || s.status === 'warranty';
        });
      }
      if (supportFilter === 'expired') {
        return clientLines.some(l => getLineStatus(l, currentNow).status === 'expired');
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [clients, supportFilter, allLines, searchClientQuery, currentNow]);

  const filteredSites = React.useMemo(() => {
    return sites.filter(s => {
      if (supportFilter === 'all') return true;
      const siteLines = allLines.filter(l => l.site_id === s.id);
      if (supportFilter === 'active') {
        return siteLines.some(l => {
          const st = getLineStatus(l, currentNow);
          return st.status === 'paid' || st.status === 'warranty';
        });
      }
      if (supportFilter === 'expired') {
        return siteLines.some(l => getLineStatus(l, currentNow).status === 'expired');
      }
      return true;
    });
  }, [sites, supportFilter, allLines, currentNow]);

  const filteredLines = React.useMemo(() => {
    return lines.filter(l => {
      if (supportFilter === 'all') return true;
      const st = getLineStatus(l, currentNow);
      if (supportFilter === 'active') {
        return st.status === 'paid' || st.status === 'warranty';
      }
      if (supportFilter === 'expired') {
        return st.status === 'expired';
      }
      return true;
    });
  }, [lines, supportFilter, currentNow]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5B00]"></div>
        <div className="text-sm text-slate-400 font-medium animate-pulse">Загрузка данных...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full min-h-0">
      {/* Sidebar: Navigation Tree */}
      <div className={`
        w-full lg:w-80 bg-surface-50 dark:bg-surface-950 p-4 lg:p-6 rounded-[2.5rem] border border-surface-100 dark:border-surface-900 overflow-y-auto shrink-0 flex flex-col
        ${(selectedLine || selectedSite) ? 'hidden lg:flex' : 'flex'}
        max-h-[85vh] lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] custom-scrollbar shadow-2xl shadow-surface-200/50 dark:shadow-none
      `}>
          <div className="lg:hidden mb-6">
            {selectedSite ? (
              <button
                onClick={() => { setSelectedSite(null); setSelectedLine(null); setLines([]); }}
                className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest"
              >
                <IconChevronLeft className="w-4 h-4" />
                Назад к площадкам
              </button>
            ) : selectedClient ? (
              <button
                onClick={() => { setSelectedClient(null); setSelectedSite(null); setSites([]); }}
                className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest"
              >
                <IconChevronLeft className="w-4 h-4" />
                Назад к клиентам
              </button>
            ) : null}
          </div>

          <div className={`flex items-center justify-between mb-6 px-2 ${selectedClient ? 'hidden lg:flex' : 'flex'}`}>
            <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Индекс Клиентов</h2>
            {!isViewer && (
              <button 
                onClick={() => setModal({ type: 'client', data: null })} 
                className="w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 shadow-lg shadow-primary/20 transition-all text-xl font-medium"
              >
                +
              </button>
            )}
          </div>


        <div className={`mb-4 px-1 ${selectedClient ? 'hidden lg:block' : 'block'}`}>
          <input
            type="text"
            placeholder="🔍 Поиск клиента..."
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#FF5B00] focus:ring-1 focus:ring-[#FF5B00]/20 transition-all"
            value={searchClientQuery}
            onChange={(e) => setSearchClientQuery(e.target.value)}
          />
        </div>

        <div className={`flex bg-surface-100 dark:bg-surface-900 p-1.5 rounded-2xl mb-8 text-center shadow-inner ${selectedClient ? 'hidden lg:flex' : 'flex'}`}>
          {[
            { id: 'all', label: 'Все' },
            { id: 'active', label: 'Актив' },
            { id: 'expired', label: 'Истек' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setSupportFilter(p.id as any)}
              className={`flex-1 py-1.5 px-3 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all ${supportFilter === p.id ? 'bg-white dark:bg-surface-800 text-primary shadow-md ring-1 ring-surface-200/50' : 'text-slate-400 hover:text-slate-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>


        <div className="space-y-1.5 flex-1">
          {filteredClients.map(c => (
            <div key={c.id} className={`group/item ${selectedClient && selectedClient.id !== c.id ? 'hidden lg:block' : 'block'}`}>
              <div className={`flex items-center rounded-2xl transition-all duration-300 ${selectedClient?.id === c.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-surface-100 dark:hover:bg-surface-800/50'}`}>
                <button
                  onClick={() => handleClientSelect(c)}
                  className={`flex-1 text-left p-4 flex items-center justify-between ${selectedClient?.id === c.id ? 'text-primary font-black' : 'text-slate-600 dark:text-slate-400 font-bold'}`}
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <span className={`w-2 h-2 rounded-full shrink-0 transition-all duration-500 ${selectedClient?.id === c.id ? 'bg-primary scale-125 shadow-[0_0_8px_rgba(255,91,0,0.5)]' : 'bg-slate-200'}`}></span>
                    <span className="text-sm truncate font-display tracking-tight">{c.name}</span>
                  </div>
                </button>
                {!isViewer && (
                  <div className="flex items-center pr-2">
                    <button onClick={() => setModal({ type: 'client', data: c })} className="p-2 opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-primary transition-all active:scale-125">✎</button>
                    {isAdmin && <button onClick={() => handleDeleteClient(c.id)} className="p-2 opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-red-500 transition-all active:scale-125 text-lg">🗑</button>}
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredClients.length === 0 && searchClientQuery && (
            <div className="text-center py-8 px-4 text-slate-400 dark:text-slate-500 text-sm italic">
              Клиенты не найдены
            </div>
          )}
        </div>
      </div>

      <div className={`
        flex-1 bg-white dark:bg-surface-900 p-6 lg:p-10 rounded-[2.5rem] border border-surface-100 dark:border-surface-800 shadow-xl shadow-surface-200/20 dark:shadow-none overflow-y-auto min-h-0
        ${!selectedLine && !selectedSite && !selectedClient ? 'hidden lg:block' : 'block'}
      `}>

        {/* BREADCRUMBS (Shared across all views if a client is selected) */}
        {selectedClient && (
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-black text-slate-400 dark:text-slate-500 mb-10 bg-surface-50 dark:bg-surface-800/40 p-4 rounded-2xl w-fit border border-surface-100 dark:border-surface-700/50 uppercase tracking-[0.2em] animate-in fade-in slide-in-from-top-2 duration-300">
            <button 
              onClick={() => { setSelectedClient(null); setSites([]); setSelectedSite(null); setLines([]); setSelectedLine(null); }} 
              className="lg:hidden hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <IconChevronLeft className="w-3 h-3" />
              ИНДЕКС
            </button>
            <span className="lg:hidden text-slate-200 dark:text-slate-700">|</span>
            
            <button
              onClick={() => { setSelectedSite(null); setLines([]); setSelectedLine(null); }}
              className={`hover:text-primary transition-colors ${!selectedSite && !selectedLine ? 'text-slate-950 dark:text-white' : ''}`}
            >
              {selectedClient.name}
            </button>
            
            {selectedSite && (
              <>
                <span className="text-slate-200 dark:text-slate-700">|</span>
                <div className="relative group/site-nav inline-block">
                  <button
                    onClick={() => setSelectedLine(null)}
                    className={`flex items-center gap-2 hover:text-primary transition-all group-hover/site-nav:text-primary ${!selectedLine ? 'text-slate-950 dark:text-white' : ''}`}
                  >
                    {selectedSite.name}
                    <IconChevronDown className="w-3 h-3 opacity-50 group-hover/site-nav:opacity-100 transition-opacity" />
                  </button>

                  <div className="absolute left-0 mt-3 w-80 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-surface-100 dark:border-surface-800 opacity-0 invisible group-hover/site-nav:opacity-100 group-hover/site-nav:visible transition-all z-[100] py-5 translate-y-2 group-hover/site-nav:translate-y-0 duration-300 overflow-hidden ring-1 ring-black/5">
                    <div className="px-6 pb-3 mb-2 border-b border-surface-50 dark:border-surface-800 flex items-center justify-between">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Линии площадки</span>
                       <span className="text-[10px] font-black text-primary px-2.5 py-1 bg-primary/10 rounded-full">{lines.length}</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto px-2 custom-scrollbar">
                      {lines.map(line => (
                        <button
                          key={line.id}
                          onClick={() => handleLineSelect(line)}
                          className={`w-full text-left p-4 rounded-2xl transition-all flex items-center justify-between group/line-btn mb-1 ${selectedLine?.id === line.id ? 'bg-primary text-white font-black shadow-lg shadow-primary/20' : 'hover:bg-surface-50 dark:hover:bg-surface-800 text-slate-600 dark:text-slate-400 font-bold'}`}
                        >
                          <span className="truncate flex-1 font-display uppercase tracking-tight text-sm">{line.name}</span>
                          {selectedLine?.id === line.id ? (
                             <IconChevronRight className="w-4 h-4 text-white" />
                          ) : (
                             <div className={`w-2 h-2 rounded-full transition-all group-hover/line-btn:scale-125 ${getLineStatus(line, currentNow).status === 'expired' ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {selectedLine && (
              <>
                <span className="text-slate-200 dark:text-slate-700">|</span>
                <span className="text-slate-950 dark:text-white flex items-center gap-2 group cursor-default font-black">
                  <Workflow className="w-3.5 h-3.5 text-primary animate-subtle-pulse" />
                  {selectedLine.name}
                </span>
              </>
            )}
          </div>
        )}
        {
          !selectedLine ? (
            !selectedClient ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-300 dark:text-slate-600 space-y-8 animate-slideUp">
                <div className="w-32 h-32 bg-surface-50 dark:bg-surface-800/40 rounded-[2.5rem] flex items-center justify-center shadow-inner relative overflow-hidden group">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg className="w-16 h-16 text-primary/20 group-hover:text-primary transition-all duration-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Выберите объект</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest opacity-60">Используйте навигацию слева для начала работы</p>
                </div>
              </div>

            ) : selectedSite ? (
              <div className="space-y-10 animate-slideUp">
                <div>
                  <h1 className="text-4xl font-display font-black text-slate-950 dark:text-white uppercase tracking-tight">{selectedSite.name}</h1>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-80">{selectedClient.name} • Объект</p>
                </div>


                <div className="bg-white dark:bg-surface-800 p-10 rounded-[3rem] border border-surface-100 dark:border-surface-700 shadow-2xl shadow-surface-200/40 dark:shadow-none relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-8 relative z-10 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                       <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    </div>
                    Учётные данные объекта
                  </h3>
                  <div className="space-y-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Локация / Адрес</div>
                        {selectedSite.address ? (
                          <a
                            href={`https://yandex.ru/maps/?text=${encodeURIComponent(selectedSite.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base text-primary hover:text-primary/80 font-black transition-all inline-flex items-center gap-2 group/map"
                            title="Открыть на Яндекс.Картах"
                          >
                            {selectedSite.address}
                            <span className="text-[10px] px-2 py-1 bg-primary/5 rounded-lg border border-primary/10 text-primary opacity-0 group-hover/map:opacity-100 transition-all -translate-x-2 group-hover/map:translate-x-0 normal-case font-bold">Открыть карту →</span>
                          </a>
                        ) : (
                          <p className="text-base font-bold text-slate-400 italic">Не указано</p>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">L3 Провайдер / Маркировка</div>
                        <p className="text-base font-display font-black text-slate-900 dark:text-white flex items-center gap-2">
                          {selectedSite.l3_provider === 'Другое' ? selectedSite.l3_provider_custom : (selectedSite.l3_provider || 'Не указано')}
                        </p>
                      </div>
                    </div>
                    {selectedSite.notes && (
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Заметки / Комментарии</div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium italic border-l-2 border-primary/20 pl-4 py-1">{selectedSite.notes}</p>
                      </div>
                    )}


                    <div className="mt-10 pt-10 border-t border-surface-50 dark:border-surface-800/50">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Ответственные лица</h4>
                        {!isViewer && (
                          <button
                            onClick={() => setModal({ type: 'site_contact', data: null })}
                            className="text-[10px] font-black text-primary hover:text-primary/70 uppercase tracking-widest bg-primary/5 px-4 py-2 rounded-xl border border-primary/10 transition-all active:scale-95 shadow-sm shadow-primary/5"
                          >
                            + Добавить контакт
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedSite.contacts && selectedSite.contacts.length > 0 ? (
                          selectedSite.contacts.map(contact => (
                            <div key={contact.id} className="bg-surface-50/50 dark:bg-surface-800/60 p-6 rounded-[2rem] border border-surface-100 dark:border-surface-700/50 group/contact relative overflow-hidden transition-all hover:bg-white dark:hover:bg-surface-800 hover:shadow-xl hover:shadow-surface-200/50 dark:hover:shadow-none hover:-translate-y-1">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 overflow-hidden mr-4">
                                  <div className="font-display font-black text-slate-950 dark:text-white truncate" title={contact.fio}>{contact.fio}</div>
                                  {contact.position && <div className="text-[10px] text-primary font-black uppercase tracking-[0.1em] mt-1 truncate">{contact.position}</div>}

                                  <div className="space-y-2 mt-5">
                                    {contact.phone && (
                                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-bold">
                                        <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">📞</span>
                                        <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors truncate">{contact.phone}</a>
                                      </div>
                                    )}
                                    {contact.email && (
                                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-bold overflow-hidden">
                                        <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">✉️</span>
                                        <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors truncate" title={contact.email}>{contact.email}</a>
                                      </div>
                                    )}
                                    {contact.comments && (
                                      <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-700/50 text-slate-500 italic text-[11px] leading-relaxed">
                                        {contact.comments}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center shrink-0 ml-2">
                                  {!isViewer && (
                                    <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => setModal({ type: 'site_contact', data: contact })} className="p-1.5 text-slate-400 hover:text-[#FF5B00] transition-colors">✎</button>
                                      {isAdmin && (
                                        <button
                                          onClick={async () => {
                                            if (confirm('Удалить контакт?')) {
                                              await api.deleteSiteContact(contact.id);
                                              setSites(await api.getSites(selectedClient!.id));
                                            }
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full py-6 text-center bg-white/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest opacity-50">Список пуст</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                      {isEngineer && (
                        <button onClick={() => setModal({ type: 'site', data: selectedSite })} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Редактировать объект</button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDeleteSite(selectedSite.id)} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">Удалить объект</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="animate-slideUp">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Производственные линии ({lines.length})</h3>
                    {isEngineer && lines.length > 0 && (
                      <button onClick={() => setModal({ type: 'line', data: null })} className="px-5 py-2.5 bg-primary/10 text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white shadow-sm transition-all active:scale-95">+ Добавить линию</button>
                    )}
                  </div>
                  {lines.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {lines.map(line => (
                        <button
                          key={line.id}
                          onClick={() => handleLineSelect(line)}
                          className="p-8 bg-surface-50 dark:bg-surface-800/40 rounded-[2.5rem] border border-surface-100 dark:border-surface-700/50 hover:border-primary hover:bg-white dark:hover:bg-surface-800 hover:shadow-2xl hover:shadow-primary/5 transition-all text-left group relative overflow-hidden active:scale-[0.98]"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors"></div>
                          <div className="flex items-start justify-between mb-6 relative z-10">
                            <div className="w-14 h-14 bg-white dark:bg-surface-900 rounded-2xl shadow-inner flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Factory className="w-7 h-7 text-primary group-hover:rotate-12 transition-transform" strokeWidth={2} />
                            </div>
                            <div className="flex items-center gap-2">
                              {isEngineer && !isViewer && (
                                <div onClick={(e) => { e.stopPropagation(); handleDuplicateLine(line); }} title="Создать копию линии" className="opacity-0 group-hover:opacity-100 p-2 hover:text-primary bg-white dark:bg-surface-900 rounded-xl shadow-lg border border-surface-100 dark:border-surface-800 text-slate-400 transition-all hover:scale-110 active:scale-90">
                                  <IconCopy className="w-4 h-4" />
                                </div>
                              )}
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">L{line.id}</div>
                            </div>
                          </div>
                          <h4 className="font-display font-black text-lg text-slate-950 dark:text-white mb-2 group-hover:text-primary transition-colors flex items-center flex-wrap gap-3 uppercase tracking-tight">
                            {line.name}
                            {line.cabinet_number && (
                              <span className="text-[10px] font-black text-primary bg-primary/5 border border-primary/10 px-2 py-1 rounded-lg">
                                {line.cabinet_number}
                              </span>
                            )}
                            <span
                              title={getLineStatus(line, currentNow).tooltip}
                              className={`w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-surface-800 ${['paid', 'warranty', 'warranty_only'].includes(getLineStatus(line, currentNow).status) ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : getLineStatus(line, currentNow).status === 'expired' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-slate-200'}`}
                            ></span>
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">{line.description || 'Инженерное описание отсутствует'}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-surface-50 dark:bg-surface-800/20 rounded-[3rem] border-2 border-dashed border-surface-200 dark:border-surface-800">
                      <div className="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                         <Factory className="w-8 h-8" />
                      </div>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Линии еще не созданы</p>
                      {isEngineer && (
                        <button onClick={() => setModal({ type: 'line', data: null })} className="mt-6 px-8 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">+ Создать первую линию</button>
                      )}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">{selectedClient.name}</h1>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-slate-400 dark:text-slate-500 font-medium">Карточка клиента</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isEngineer && sites.length > 0 && (
                        <button onClick={() => setModal({ type: 'line', data: null })} className="px-5 py-2.5 bg-[#FF5B00] text-white rounded-full text-xs font-bold hover:bg-[#e65200] shadow-sm transition-colors hidden sm:block">+ Добавить линию</button>
                      )}
                      {isEngineer && (
                        <button onClick={() => setModal({ type: 'client', data: selectedClient })} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Редактировать</button>
                      )}
                      {isAdmin && (
                        <button onClick={async () => {
                          if (confirm('Удалить клиента и все связанные данные?')) {
                            await api.deleteClient(selectedClient.id);
                            setSelectedClient(null);
                            setClients(await api.getClients());
                          }
                        }} className="px-5 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-full text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">Удалить</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-5 rounded-3xl border border-orange-100 dark:border-orange-900/40 text-center">
                    <div className="text-3xl font-black text-[#FF5B00]">{sites.length}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mt-1 border-t border-orange-200/50 dark:border-orange-800/50 pt-2 mx-4">Площадок</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
                    <div className="text-3xl font-black text-slate-800 dark:text-slate-200">
                      {sites.reduce((acc, site) => acc + (site.line_count || 0), 0)}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mt-1 border-t border-slate-200 dark:border-slate-700 pt-2 mx-4">Линий</div>
                  </div>
                </div>

                {/* Sites Tiles Grid */}
                <div className="mb-10 animate-slideUp">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Производственные площадки</h3>
                  </div>
                  {sites.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {sites.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleSiteSelect(s)}
                          className="group p-8 bg-surface-50 dark:bg-surface-800/40 rounded-[2.5rem] border border-surface-100 dark:border-surface-700/50 hover:border-primary hover:bg-white transition-all text-left relative overflow-hidden active:scale-95 hover:shadow-xl hover:shadow-surface-200/50"
                        >
                          <div className="absolute top-0 right-0 w-1.5 h-full bg-primary transform translate-x-1.5 group-hover:translate-x-0 transition-transform"></div>
                          <div className="font-display font-black text-lg text-slate-950 dark:text-white group-hover:text-primary transition-colors pr-4 uppercase tracking-tight">{s.name}</div>
                          <div className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest font-black line-clamp-1 opacity-60">{s.address || 'Адрес не указан'}</div>
                          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-surface-100 dark:border-surface-800/50">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 py-1.5 bg-surface-100 dark:bg-surface-800 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              {s.line_count || 0} линий
                            </div>
                            <span className="text-[10px] text-primary font-black uppercase tracking-widest ml-auto opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all animate-pulse">ОТКРЫТЬ →</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-surface-50 dark:bg-surface-800/20 rounded-[3rem] border border-dashed border-surface-200 dark:border-surface-800">
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Площадки еще не определены</p>
                      {isEngineer && (
                        <button onClick={() => setModal({ type: 'site', data: null })} className="mt-8 px-6 py-3 bg-surface-100 dark:bg-surface-800 text-slate-600 dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all">+ Добавить площадку</button>
                      )}
                    </div>
                  )}
                </div>


                {/* All Lines Across Sites Grid */}
                {sites.length > 0 && (
                  <div className="animate-slideUp delay-100">
                    <div className="flex items-center justify-between mb-10">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Индустриальная Карта Линий</h3>
                      {isEngineer && (
                        <button onClick={() => setModal({ type: 'line', data: null })} className="px-5 py-2.5 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all sm:hidden">+ Линия</button>
                      )}
                    </div>
                    <div className="space-y-12">
                      {sites.map(s => {
                        const siteLines = allLines.filter(l => l.site_id === s.id);
                        if (siteLines.length === 0) return null;
                        return (
                          <div key={s.id} className="space-y-6">
                            <div className="flex items-center gap-6">
                              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 whitespace-nowrap">{s.name}</h4>
                              <div className="h-px flex-1 bg-gradient-to-r from-surface-100 to-transparent dark:from-surface-800"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                              {siteLines.map(l => (
                                <button
                                  key={l.id}
                                  onClick={() => handleLineSelect(l)}
                                  className="group p-5 bg-surface-50/50 dark:bg-surface-800/60 rounded-[2rem] border border-surface-100 dark:border-surface-800 hover:border-emerald-400/50 hover:bg-white dark:hover:bg-surface-700 transition-all text-left flex items-center justify-between shadow-sm active:scale-95"
                                >
                                  <div>
                                    <div className="font-display font-black text-sm text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors uppercase tracking-tight">{l.name}</div>
                                    <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1">{l.cabinet_number || 'ШКАФ —'}</div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    {isEngineer && !isViewer && (
                                       <div onClick={(e) => { e.stopPropagation(); handleDuplicateLine(l); }} title="Дублировать" className="opacity-0 group-hover:opacity-100 p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-xl transition-all cursor-pointer">
                                         <IconCopy className="w-4 h-4" />
                                       </div>
                                    )}
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${['paid', 'warranty', 'warranty_only'].includes(getLineStatus(l, currentNow).status) ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-200'}`}></div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


              </div>
            )
          ) : (
            <div className="space-y-10 animate-slideUp">
              <div className="border-b border-surface-100 dark:border-surface-800 pb-10">
                <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                  <div className="flex-1">
                    <h1 title={selectedLine.tooltip_message || ''} className="text-4xl font-display font-black text-slate-950 dark:text-white mb-2 cursor-help decoration-primary/30 underline decoration-dotted underline-offset-8 transition-all hover:decoration-primary uppercase tracking-tight">
                      {selectedLine.name}
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{selectedClient?.name} / {selectedSite?.name}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {selectedLine.cabinet_number && (
                      <div className="px-6 py-4 bg-primary/5 border border-primary/20 rounded-[1.5rem] flex flex-col items-center shadow-inner group/cabinet">
                        <span className="text-[10px] font-black text-primary/60 uppercase tracking-[0.15em] mb-1">Шкаф управления</span>
                        <span className="text-2xl font-display font-black text-primary group-hover:scale-110 transition-transform tracking-tight">{selectedLine.cabinet_number}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span
                        title={getLineStatus(selectedLine, currentNow).tooltip}
                        className={`text-[10px] uppercase font-black tracking-widest px-4 py-2 rounded-xl border border-transparent shadow-sm flex items-center gap-3 cursor-help transition-all hover:scale-105 ${getLineStatus(selectedLine, currentNow).color}`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {getLineStatus(selectedLine, currentNow).label}
                        {getLineStatus(selectedLine, currentNow).remaining && (
                          <span className="opacity-60 font-bold border-l pl-3 ml-1 border-current uppercase">
                            {getLineStatus(selectedLine, currentNow).remaining}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-10">
                  {isEngineer && !isViewer && (
                    <button
                      onClick={() => handleDuplicateLine(selectedLine)}
                      className="px-6 py-3 bg-white dark:bg-surface-800 border-2 border-surface-100 dark:border-surface-700 text-slate-600 dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all active:scale-95 shadow-sm"
                      title="Копировать проектную структуру"
                    >
                      Клонировать линию
                    </button>
                  )}
                  <button onClick={() => setModal({ type: 'line', data: selectedLine })} className="px-6 py-3 bg-surface-100 dark:bg-surface-800 text-slate-600 dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95">Режим Наладки</button>
                  {isAdmin && (
                    <button onClick={() => handleDeleteLine(selectedLine.id)} className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95">Списать в брак</button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                  <div className="p-8 bg-surface-50 dark:bg-surface-800/40 rounded-[2.5rem] border border-surface-100 dark:border-surface-700/50 group relative shadow-inner overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12"></div>
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-4 tracking-[0.2em] relative z-10">Монтажные Особенности</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic relative z-10">{selectedLine.mounting_features || 'Архитектурные пояснения отсутствуют'}</p>
                  </div>
                  <div className="p-8 bg-surface-50 dark:bg-surface-800/40 rounded-[2.5rem] border border-surface-100 dark:border-surface-700/50 group relative shadow-inner overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12"></div>
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-4 tracking-[0.2em] relative z-10">Специфика Эксплуатации</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic relative z-10">{selectedLine.operational_specifics || 'Эксплуатационные карты не заполнены'}</p>
                  </div>
                </div>
              </div>


              {/* Middle Section: DB & Remote Access */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Database Connection Card */}
                <div className="md:col-span-2 bg-white dark:bg-surface-800 p-10 rounded-[3rem] border border-surface-100 dark:border-surface-700 shadow-2xl shadow-surface-200/20 dark:shadow-none relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-10 flex items-center gap-3 relative z-10">
                    <span className="w-1 h-5 bg-primary rounded-full"></span>
                    Конфигурация Базы Данных
                  </h3>
                  {selectedLine.db_ip ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 relative z-10">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Host Address</div>
                        <div className="font-mono text-sm text-slate-900 dark:text-white bg-surface-50 dark:bg-surface-900 px-5 py-4 rounded-2xl border border-surface-100 dark:border-surface-800 shadow-inner group-hover:border-primary/20 transition-all">{selectedLine.db_ip}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Schema Name</div>
                        <div className="font-display font-black text-sm text-slate-900 dark:text-white bg-surface-50 dark:bg-surface-900 px-5 py-4 rounded-2xl border border-surface-100 dark:border-surface-800 shadow-inner group-hover:border-primary/20 transition-all uppercase tracking-tight">{selectedLine.db_name}</div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">User Identifier</div>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedLine.db_user}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Security Token</div>
                          <div className="text-sm font-bold text-slate-400 font-mono tracking-tighter">••••••••••••</div>
                        </div>
                      </div>
                      {selectedLine.db_notes && (
                        <div className="sm:col-start-2">
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Infrastructure Notes</div>
                          <div className="text-xs text-slate-500 font-medium italic border-l-2 border-primary/20 pl-4 py-1">{selectedLine.db_notes}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 relative z-10">
                      <p className="text-xs text-slate-300 font-bold uppercase tracking-widest mb-6">Database credentials missing</p>
                      <button onClick={() => setModal({ type: 'line', data: selectedLine })} className="text-[10px] font-black text-primary px-6 py-3 bg-primary/5 rounded-xl border border-primary/10 hover:bg-primary hover:text-white transition-all active:scale-95">ИНИЦИИРОВАТЬ ПОДКЛЮЧЕНИЕ →</button>
                    </div>
                  )}
                </div>

                <div className="bg-slate-950 p-10 rounded-[3rem] text-white shadow-2xl shadow-primary/10 flex flex-col relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary animate-pulse opacity-10 blur-3xl -mr-16 -mt-16"></div>
                  <div className="flex justify-between items-center mb-8 relative z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Remote Secure Access</h3>
                    {!isViewer && (
                      <button
                        onClick={() => setModal({ type: 'remote', data: null })}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white hover:bg-primary hover:border-primary transition-all active:scale-90"
                        title="Добавить шлюз"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="space-y-6 max-h-[350px] overflow-y-auto custom-scrollbar pr-4 relative z-10">
                    {remote.length > 0 ? remote.map((r) => (
                      <div key={r.id} className="group/remote bg-white/5 p-5 rounded-[1.5rem] border border-white/5 hover:border-primary/40 transition-all hover:bg-white/10 relative overflow-hidden">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 group/id">
                              <div className="text-base font-display font-black text-white truncate uppercase tracking-tight" title={r.url_or_address}>{r.url_or_address}</div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(r.url_or_address);
                                  setToastMessage('ID скопирован');
                                  setTimeout(() => setToastMessage(null), 2000);
                                }}
                                className="p-1.5 text-white/30 hover:text-primary transition-colors opacity-0 group-hover/id:opacity-100 active:scale-125"
                                title="Копировать ID"
                              >
                                <IconCopy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-primary/20 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20">{r.type}</span>
                              {r.notes && <span className="text-[10px] text-white/40 font-bold truncate tracking-tight">{r.notes}</span>}
                            </div>
                            {r.credentials && (
                              <div className="text-[10px] text-white/30 font-mono mt-4 bg-black/40 p-3 rounded-xl break-all border border-white/5">
                                {r.credentials}
                              </div>
                            )}
                          </div>
                          {!isViewer && (
                            <div className="flex flex-col gap-2 ml-4 opacity-0 group-hover/remote:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                              <button onClick={() => setModal({ type: 'remote', data: r })} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-primary hover:bg-white/10 transition-colors">✎</button>
                              <button onClick={() => handleDeleteRemote(r.id)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-red-500 hover:bg-white/10 transition-colors">✕</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-8 text-center">
                        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Gateway structural maps empty</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="animate-slideUp delay-200">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-3">
                    <span className="w-4 h-4 bg-primary/20 rounded-lg flex items-center justify-center">
                       <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    </span>
                    Инженерная Спецификация
                  </h3>
                  <div className="flex gap-3">
                    <button onClick={() => setModal({ type: 'import_line', data: null })} className="bg-surface-100 dark:bg-surface-800 text-slate-500 dark:text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-surface-200 dark:hover:bg-surface-700 transition-all flex items-center gap-3 active:scale-95 border border-surface-200 dark:border-surface-700 shadow-sm">
                      <IconCopy className="w-3.5 h-3.5" /> Импорт структуры
                    </button>
                    {!isViewer && <button onClick={() => setModal({ type: 'equipment', data: null })} className="bg-primary text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 shadow-lg shadow-primary/20 transition-all">+ Добавить узел</button>}
                  </div>
                </div>
                <div className="bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-surface-200/20 dark:shadow-none overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[900px] border-collapse">
                    <thead className="bg-surface-50 dark:bg-surface-800/40 text-[10px] font-black text-slate-400 uppercase border-b border-surface-100 dark:border-surface-800 tracking-[0.15em]">
                      <tr>
                        <th className="px-6 py-6 w-12 text-center">#</th>
                        <th className="px-8 py-6">Модель Инструментария</th>
                        <th className="px-8 py-6">Network Parameters</th>
                        <th className="px-8 py-6 text-center">Status Index</th>
                        <th className="px-8 py-6">Engineer Notes</th>
                        <th className="px-8 py-6 text-right w-32">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {equipment.length > 0 ? equipment.map((e, idx) => (
                        <tr
                          key={e.id}
                          className={`group transition-all duration-300 ${
                            draggedEquipId === e.id ? 'opacity-20 cursor-grabbing' : 'cursor-grab'
                          } ${dragOverId === e.id ? 'bg-primary/5 ring-2 ring-primary/20 ring-inset' : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'}`}
                          draggable={!isViewer}
                          onDragStart={(ev) => handleDragStart(ev, e.id)}
                          onDragOver={(ev) => handleDragOver(ev, e.id)}
                          onDrop={(ev) => handleDrop(ev, e.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <td className="px-6 py-6 text-center">
                            <span className="text-[10px] font-black text-slate-300 group-hover:text-primary transition-colors tracking-tighter">
                               {(idx + 1).toString().padStart(2, '0')}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-display font-black text-sm text-slate-950 dark:text-white uppercase tracking-tight group-hover:translate-x-1 transition-transform">{e.model}</div>
                            <div className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">{e.article || 'NON-INDEXED'}</div>
                          </td>
                          <td className="px-8 py-6">
                            {e.ip_address ? (
                              <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                <div className="flex flex-col">
                                  <span className="font-mono text-slate-900 dark:text-white text-xs font-bold">{e.ip_address}</span>
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Mask: {e.subnet_mask || '—'}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300 font-bold text-[10px] uppercase tracking-widest opacity-50">Off-network</span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-center">
                            <select
                              value={e.status}
                              onChange={(ev) => changeEquipStatus(e.id, ev.target.value as EquipmentStatus)}
                              className={`text-[9px] font-black uppercase tracking-widest py-2 px-4 rounded-xl focus:outline-none cursor-pointer border-2 border-transparent transition-all hover:scale-105 active:scale-95 shadow-sm ${e.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:border-emerald-200' :
                                e.status === 'maintenance' ? 'bg-amber-50 text-amber-600 border-amber-100 hover:border-amber-200' : 'bg-red-50 text-red-600 border-red-100 hover:border-red-200'
                                }`}
                            >
                              <option value="active">Operational</option>
                              <option value="maintenance">Maintenance</option>
                              <option value="faulty">Critical</option>
                            </select>
                          </td>
                          <td className="px-8 py-6 text-slate-500 font-medium text-xs max-w-[200px] truncate italic opacity-60 group-hover:opacity-100 transition-opacity">{e.notes || '—'}</td>
                          <td className="px-8 py-6 text-right space-x-1">
                            {!isViewer && <button onClick={() => setModal({ type: 'equipment', data: e })} className="p-2.5 text-slate-300 hover:text-primary hover:bg-primary/5 rounded-xl transition-all active:scale-125">✎</button>}
                            {isEngineer && <button onClick={() => handleDeleteEquip(e.id)} className="p-2.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-125">✕</button>}
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-[10px] italic">Specification map is currently blank</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>


              {/* Support Tools Grid (Documentation) */}
              <div
                className="bg-white dark:bg-surface-900 p-10 rounded-[3rem] border border-surface-100 dark:border-surface-800 shadow-2xl shadow-surface-200/20 dark:shadow-none relative overflow-hidden"
                onDragOver={onInstructionDragOver}
                onDragEnter={onInstructionDragOver}
                onDragLeave={onInstructionDragLeave}
                onDrop={onInstructionDrop}
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                    <Workflow className="w-4 h-4 text-primary" />
                    Техническая Документация
                  </h3>
                  {!isViewer && (
                    <button
                      onClick={() => setModal({ type: 'instruction', data: null })}
                      className="px-5 py-2.5 bg-primary/5 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95 border border-primary/10"
                    >
                      + Добавить карту
                    </button>
                  )}
                </div>

                {dragActiveDocs && (
                  <div className="absolute inset-0 bg-primary/5 backdrop-blur-sm flex items-center justify-center rounded-[2.5rem] z-40 pointer-events-none border-4 border-dashed border-primary animate-pulse">
                    <div className="bg-white dark:bg-surface-900 px-10 py-6 rounded-3xl text-primary font-black uppercase tracking-widest shadow-2xl border border-primary/20">Отпустите файлы для импорта</div>
                  </div>
                )}

                {isUploadingDocs && (
                  <div className="absolute top-6 right-6 z-50 bg-primary px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-widest animate-bounce shadow-lg">Загрузка в облако...</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {instructions.length > 0 ? (
                    <>
                      {instructions.map(i => (
                        <div key={i.id} className="group/doc bg-surface-50 dark:bg-surface-800/40 p-6 rounded-[2rem] border border-surface-100 dark:border-surface-700/50 hover:bg-white dark:hover:bg-surface-800 transition-all hover:shadow-2xl hover:shadow-surface-200/50 relative overflow-hidden flex flex-col justify-between">
                          <div className="flex items-start gap-5">
                            <div className="w-14 h-14 bg-white dark:bg-surface-900 rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover/doc:scale-110 transition-transform group-hover/doc:rotate-3">📄</div>
                            <div className="flex-1 min-w-0">
                              <a
                                href={(() => {
                                  if (!i.link) return '#';
                                  if (/^\\\\/.test(i.link)) return 'file:' + i.link.replace(/\\\\/g, '/').replace(/\\/g, '/');
                                  return i.link;
                                })()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-display font-black text-sm text-slate-950 dark:text-white hover:text-primary transition-colors block truncate uppercase tracking-tight"
                                title={i.link}
                              >
                                {i.module_type || 'Технический регламент'}
                              </a>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-700 text-[9px] font-black text-slate-400 uppercase tracking-widest">v{i.version || '1.0'}</span>
                                <span className="text-[10px] text-slate-500 font-bold truncate opacity-60 italic">{i.notes || 'Без квалификации'}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-8 pt-6 border-t border-surface-100 dark:border-surface-800/50">
                            <div className="flex gap-2">
                              {!isViewer && (
                                <button onClick={() => setModal({ type: 'instruction', data: i })} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-primary hover:bg-primary/5 transition-all">✎</button>
                              )}
                              <button
                                onClick={() => openInExplorer(i.link)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-all"
                                title="Открыть в Проводнике"
                              >
                                📂
                              </button>
                            </div>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    let text = (i.link || '').replace(/^["']|["']$/g, '');
                                    await navigator.clipboard.writeText(text);
                                    setCopiedLinkId(i.id);
                                    setToastMessage('Ссылка в буфере');
                                    setTimeout(() => { setCopiedLinkId(null); setToastMessage(null); }, 3000);
                                  } catch (err) { alert('Ошибка копирования'); }
                                }}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${copiedLinkId === i.id ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-surface-100 dark:bg-surface-800 text-slate-400 hover:bg-primary hover:text-white border border-transparent'}`}
                              >
                                {copiedLinkId === i.id ? 'КОПИЯ ✓' : 'ССЫЛКА'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="col-span-full py-16 bg-surface-50 dark:bg-surface-800/20 rounded-[3rem] border-2 border-dashed border-surface-200 dark:border-surface-800 text-center">
                      <p className="text-slate-300 font-black uppercase tracking-widest text-[10px] italic">Документальная база не сформирована</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        }
      </div >

      {/* MODALS */}
      {/* MODALS */}
      {
        modal?.type === 'client' && (
          <Modal
            title={modal.data ? "Редактировать клиента" : "Новый клиент"}
            onClose={() => setModal(null)}
            onSubmit={handleSubmit}
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Название организации</label>
                <input name="name" defaultValue={modal.data?.name} required className={inputClass} placeholder="Напр. ООО ВегаТорг" />
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                {/* Support dates moved to Line settings */}
              </div>
            </div>
          </Modal>
        )
      }

      {
        modal?.type === 'site' && (
          <Modal
            title={modal.data ? "Изменить площадку" : "Новая площадка"}
            onClose={() => setModal(null)}
            onSubmit={handleSubmit}
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Название объекта</label>
                <input name="name" defaultValue={modal.data?.name} required placeholder="Цех №1, Склад ГСМ..." className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Адрес</label>
                <input name="address" defaultValue={modal.data?.address} placeholder="Фактический адрес объекта" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Реализация L3</label>
                  <select
                    name="l3_provider"
                    className={inputClass}
                    defaultValue={modal.data?.l3_provider || ''}
                    onChange={(e) => setL3Provider(e.target.value)}
                  >
                    <option value="">Не выбрано</option>
                    <option value="Контур">Контур</option>
                    <option value="IT Кластер">IT Кластер</option>
                    <option value="Мотрум">Мотрум</option>
                    <option value="Другое">Другое (указать вручную)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Название компании (если Другое)</label>
                  <input
                    name="l3_provider_custom"
                    defaultValue={modal.data?.l3_provider_custom}
                    placeholder="Укажите компанию..."
                    disabled={l3Provider !== 'Другое' && modal.data?.l3_provider !== 'Другое'}
                    className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400 opacity-60 disabled:opacity-30`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Комментарии</label>
                <textarea name="notes" defaultValue={modal.data?.notes} placeholder="Дополнительная информация о площадке..." className={inputClass} style={{ minHeight: '80px' }} />
              </div>
            </div>
          </Modal>
        )
      }

      {
        modal?.type === 'line' && (
          <Modal
            title={modal.data ? "Настройки линии" : "Новая линия"}
            onClose={() => setModal(null)}
            onSubmit={handleSubmit}
          >
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary uppercase flex items-center gap-3 tracking-[0.2em] border-b border-surface-100 dark:border-surface-800 pb-3">
                  <span className="w-1 h-4 bg-primary rounded-full"></span>
                  Общая информация
                </h4>
                {!selectedSite && !modal.data && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Площадка</label>
                    <select name="site_id" required className={inputClass}>
                      <option value="">-- Выберите площадку --</option>
                      {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Название линии</label>
                  <input name="name" defaultValue={modal.data?.name} required placeholder="Линия розлива B-50" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Номер шкафа управления</label>
                  <input name="cabinet_number" defaultValue={modal.data?.cabinet_number} placeholder="Напр. ШУ-1" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Монтажные особенности</label>
                  <textarea name="mounting_features" defaultValue={modal.data?.mounting_features} placeholder="Фундамент, высота..." className={inputClass} style={{ minHeight: '60px' }} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Специфика эксплуатации</label>
                  <textarea name="operational_specifics" defaultValue={modal.data?.operational_specifics} placeholder="Температурный режим, вибрации..." className={inputClass} style={{ minHeight: '60px' }} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Всплывающая подсказка (Tooltip)</label>
                  <input name="tooltip_message" defaultValue={modal.data?.tooltip_message} placeholder="Напр. Сериализация с принтером Savema..." className={inputClass} />
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-surface-100 dark:border-surface-800">
                <h4 className="text-[10px] font-black text-primary uppercase flex items-center gap-3 tracking-[0.2em] border-b border-surface-100 dark:border-surface-800 pb-3">
                  <span className="w-1 h-4 bg-primary rounded-full"></span>
                  Подключение к БД (SCADA/ERP)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">IP Адрес БД</label>
                    <input name="db_ip" defaultValue={modal.data?.db_ip} placeholder="192.168.1.50" className={inputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Имя базы данных</label>
                    <input name="db_name" defaultValue={modal.data?.db_name} placeholder="production_db" className={inputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Логин</label>
                    <input name="db_user" defaultValue={modal.data?.db_user} placeholder="db_admin" className={inputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Пароль</label>
                    <input name="db_password" defaultValue={modal.data?.db_password} placeholder="••••••••" className={inputClass} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Комментарий к БД</label>
                    <input name="db_notes" defaultValue={modal.data?.db_notes} placeholder="Сервер в щите управления №2" className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-surface-100 dark:border-surface-800 space-y-6">
                <div>
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-3 tracking-[0.2em] flex items-center gap-3">
                    Гарантия (Срок: 12 мес. / Поддержка: {(() => {
                      const d = modal.data?.warranty_start_date;
                      const year = d ? new Date(d).getFullYear() : new Date().getFullYear();
                      return year >= 2026 ? '2' : '12';
                    })()} мес.)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Дата начала</label>
                      <input type="date" name="warranty_start_date" defaultValue={modal.data?.warranty_start_date ? modal.data.warranty_start_date.split('T')[0] : ''} className={inputClass} />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase mb-3 tracking-[0.2em] flex items-center gap-3">
                    <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                    Платная техподдержка
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Начало</label>
                      <input type="date" name="paid_support_start_date" defaultValue={modal.data?.paid_support_start_date ? modal.data.paid_support_start_date.split('T')[0] : ''} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Окончание</label>
                      <input type="date" name="paid_support_end_date" defaultValue={modal.data?.paid_support_end_date ? modal.data.paid_support_end_date.split('T')[0] : ''} className={inputClass} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )
      }

      {
        modal?.type === 'equipment' && (
          <Modal
            title={modal.data ? "Редактировать оборудование" : "Добавить оборудование"}
            onClose={() => { setModal(null); setEquipSearchResults([]); setEquipSearchQuery(''); }}
            onSubmit={handleSubmit}
          >
            {!modal.data && (
              <div className="mb-8 p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
                <label className="text-[10px] font-black text-primary uppercase mb-3 block tracking-[0.2em]">Найти в базе (копирование модели)</label>
                <input
                  type="text"
                  placeholder="Поиск по модели или S/N..."
                  className="w-full border border-primary/10 bg-white dark:bg-surface-900 rounded-2xl px-5 py-3 text-xs font-bold mb-3 shadow-inner focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={equipSearchQuery}
                  onChange={(e) => searchGlobalEquip(e.target.value)}
                />
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {equipSearchResults.map((res, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left p-3 text-[11px] hover:bg-primary hover:text-white rounded-xl flex justify-between bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 transition-all group active:scale-[0.98]"
                      onClick={() => {
                        // Use state update to force re-render with new defaultValues
                        // We set ID to undefined so it treats it as a NEW record
                        setModal({ type: 'equipment', data: { ...res.raw, id: undefined } });
                        setEquipSearchQuery('');
                        setEquipSearchResults([]);
                      }}
                    >
                      <span className="font-medium">{res.name}</span>
                      <span className="text-primary group-hover:text-white/80 font-black uppercase text-[9px] tracking-widest">Копировать ⭲</span>
                    </button>
                  ))}
                  {equipSearchQuery.length > 2 && equipSearchResults.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center py-2">Ничего не найдено</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-6" key={modal.data ? 'edit-' + (modal.data.id || 'new') : 'new'}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Модель / Вендор</label>
                  <input name="model" defaultValue={modal.data?.model} required className={inputClass} placeholder="Напр. Schneider Electric M221" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Артикул (опционально)</label>
                  <input name="article" defaultValue={modal.data?.article} className={inputClass} placeholder="ART-XXXX-XXXX" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Статус</label>
                  <select name="status" defaultValue={modal.data?.status || 'active'} className={inputClass}>
                    <option value="active">Активен</option>
                    <option value="maintenance">Обслуживание</option>
                    <option value="faulty">Неисправен</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t border-surface-100 dark:border-surface-800">
                <h4 className="text-[10px] font-black text-primary uppercase mb-6 flex items-center gap-3 tracking-[0.2em]">
                  <span className="w-1 h-4 bg-primary rounded-full"></span>
                  Сетевые настройки
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">IP Адрес</label>
                    <input name="ip_address" defaultValue={modal.data?.ip_address} className={inputClass} placeholder="192.168.1.10" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Маска подсети</label>
                    <input name="subnet_mask" defaultValue={modal.data?.subnet_mask} className={inputClass} placeholder="255.255.255.0" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Шлюз</label>
                    <input name="gateway" defaultValue={modal.data?.gateway} className={inputClass} placeholder="192.168.1.1" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Строка подключения БД</label>
                    <textarea name="db_connection" defaultValue={modal.data?.db_connection} className={inputClass} style={{ minHeight: '60px' }} placeholder="Server=192.168.1...;User Id=...;" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-surface-100 dark:border-surface-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Дополнительные заметки</label>
                  <textarea name="notes" defaultValue={modal.data?.notes} className={inputClass} style={{ minHeight: '80px' }} placeholder="Ревизия платы, особенности ПО..." />
                </div>
              </div>
              <input type="hidden" name="type_id" value={modal.data?.type_id || 1} />
            </div>
          </Modal>
        )
      }

      {
        modal?.type === 'remote' && (
          <Modal
            title="Параметры удаленного доступа"
            onClose={() => setModal(null)}
            onSubmit={handleSubmit}
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Тип соединения</label>
                <select name="type" defaultValue={modal.data?.type || 'anydesk'} className={inputClass}>
                  <option value="anydesk">AnyDesk</option>
                  <option value="vpn">VPN (OpenVPN / L2TP)</option>
                  <option value="rdp">Remote Desktop (RDP)</option>
                  <option value="rudesktop">RuDesktop</option>
                  <option value="rustdesk">RustDesk</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Адрес / ID / URL</label>
                <input name="url_or_address" defaultValue={modal.data?.url_or_address} required className={inputClass} placeholder="Напр. 123 456 789 или vpn.domain.ru" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Креды (логин/пароль)</label>
                <textarea name="credentials" defaultValue={modal.data?.credentials} className={inputClass} style={{ minHeight: '60px' }} placeholder="Логин: admin, Пароль: 12345" />
              </div>
            </div>
          </Modal>
        )
      }

      {
        modal?.type === 'instruction' && (
          <Modal
            title={modal.data ? "Редактировать документ" : "Новый документ"}
            onClose={() => setModal(null)}
            onSubmit={handleSubmit}
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Название документа</label>
                <input name="module_type" defaultValue={modal.data?.module_type} required placeholder="Схема эл. подключений" className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Прямая ссылка (URL)</label>
                <input name="link" defaultValue={modal.data?.link} required placeholder="http://cloud.storage.ru/file.pdf" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Версия</label>
                  <input name="version" defaultValue={modal.data?.version} placeholder="1.0.2" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Заметки</label>
                  <input name="notes" defaultValue={modal.data?.notes} placeholder="Краткий комментарий" className={inputClass} />
                </div>
              </div>
            </div>
          </Modal>
        )
      }

      {
        modal?.type === 'import' && selectedClient && (
          <ExcelImportModal
            clientId={selectedClient.id}
            onClose={() => setModal(null)}
            onSuccess={async () => {
              // Refresh data
              if (selectedClient) {
                setSites(await api.getSites(selectedClient.id));
              }
              alert('Импорт успешно завершен!');
            }}
          />
        )
      }
      {
        modal?.type === 'import_line' && selectedLine && selectedClient && (
          <ExcelImportModal
            clientId={selectedClient.id}
            targetLine={selectedLine}
            onClose={() => setModal(null)}
            onSuccess={async () => {
              // Refresh data
              if (selectedLine) {
                setEquipment(await api.getEquipment(selectedLine.id));
              }
              alert('Импорт в линию успешно завершен!');
            }}
          />
        )
      }
      {
        modal?.type === 'site_contact' && (
          <Modal
            title={modal.data ? "Редактировать контакт" : "Новый контакт"}
            onClose={() => setModal(null)}
            onSubmit={handleSubmit}
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ФИО</label>
                <input name="fio" defaultValue={modal.data?.fio} required placeholder="Иванов Иван Иванович" className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Должность</label>
                <input name="position" defaultValue={modal.data?.position} placeholder="Главный энергетик" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Телефон</label>
                  <input name="phone" defaultValue={modal.data?.phone} placeholder="+7 (999) 000-00-00" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email</label>
                  <input name="email" defaultValue={modal.data?.email} placeholder="example@mail.ru" className={inputClass} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Комментарии</label>
                <textarea name="comments" defaultValue={modal.data?.comments} placeholder="Доступ по будням..." className={inputClass} style={{ minHeight: '80px' }} />
              </div>
            </div>
          </Modal>
        )
      }
      {
        toastMessage && (
          <div className="fixed right-8 bottom-8 z-[300] animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-slate-950 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-slate-950/30 max-w-sm border border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"></div>
                <span className="text-xs font-bold">{toastMessage}</span>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default ClientManager;
