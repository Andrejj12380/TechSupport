
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Client, Site, ProductionLine, Equipment, RemoteAccess, Instruction, EquipmentStatus, User, SiteContact } from '../types';
import { IconChevronRight, IconCopy, IconChevronLeft } from './Icons';
import ExcelImportModal from './ExcelImportModal';

const inputClass = "w-full border border-slate-200 dark:border-slate-700 rounded-2xl p-3 lg:p-4 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#FF5B00]/10 focus:border-[#FF5B00] outline-none transition-all";

const Modal = ({ title, children, onClose, onSubmit }: { title: string; children?: React.ReactNode; onClose: () => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void }) => (
  <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-150 border border-slate-200 dark:border-slate-800">
      <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
        <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">{title}</h3>
        <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none">&times;</button>
      </div>
      <form onSubmit={onSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
        {children}
        <div className="flex gap-3 pt-6 border-t dark:border-slate-800 mt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300 transition-colors">Отмена</button>
          <button type="submit" className="flex-1 px-4 py-3 bg-[#FF5B00] text-white rounded-full text-sm font-bold hover:bg-[#e65200] shadow-md shadow-[#FF5B00]/20 transition-all">Сохранить</button>
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
  const [showSitesTiles, setShowSitesTiles] = useState(false);
  const [showLinesTiles, setShowLinesTiles] = useState(false);

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

  const handleDragStart = (e: React.DragEvent, equipId: number) => {
    setDraggedEquipId(equipId);
    e.dataTransfer.effectAllowed = 'move';
    // Required for some browsers (e.g., Yandex Browser)
    e.dataTransfer.setData('text/plain', equipId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetEquipId: number) => {
    e.preventDefault();
    if (!draggedEquipId || draggedEquipId === targetEquipId || !selectedLine) return;

    const draggedIndex = equipment.findIndex(eq => eq.id === draggedEquipId);
    const targetIndex = equipment.findIndex(eq => eq.id === targetEquipId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder locally
    const newEquipment = [...equipment];
    const [draggedItem] = newEquipment.splice(draggedIndex, 1);
    newEquipment.splice(targetIndex, 0, draggedItem);

    // Update display_order for all items
    const updates = newEquipment.map((eq, index) => ({
      id: eq.id,
      display_order: index
    }));

    // Update local state immediately for smooth UX
    setEquipment(newEquipment);
    setDraggedEquipId(null);

    // Persist to backend
    try {
      console.log('Updating equipment order:', updates);
      const responses = await Promise.all(
        updates.map(({ id, display_order }) =>
          fetch(`http://localhost:5002/api/equipment/${id}/order`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_order })
          })
        )
      );

      // Check if all requests succeeded
      const allSucceeded = responses.every(r => r.ok);
      if (!allSucceeded) {
        console.error('Some order updates failed');
        setEquipment(await api.getEquipment(selectedLine.id));
      } else {
        console.log('Order updated successfully');
      }
    } catch (error) {
      console.error('Failed to update equipment order:', error);
      // Reload from server on error
      setEquipment(await api.getEquipment(selectedLine.id));
    }
  };

  const handleDragEnd = () => {
    setDraggedEquipId(null);
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
      } else if (modal?.type === 'line' && selectedSite) {
        modal.data ? await api.updateLine(modal.data.id, payload) : await api.addLine({ ...payload, site_id: selectedSite.id });
        const updatedLines = await api.getLines(selectedSite.id);
        setLines(updatedLines);
        // Refresh allLines for stats/tiles
        setAllLines(await api.getAllLines());
        // If we were editing the currently selected line, update its display state
        if (selectedLine && modal.data?.id === selectedLine.id) {
          setSelectedLine(updatedLines.find(l => l.id === selectedLine.id) || null);
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
  }, [clients, supportFilter, allLines, currentNow]);

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
        w-full lg:w-80 bg-slate-50 dark:bg-slate-900 p-3 lg:p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 overflow-y-auto shrink-0 flex flex-col
        ${(selectedLine || selectedSite) ? 'hidden lg:flex' : 'flex'}
        max-h-[85vh] lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] custom-scrollbar
      `}>
        {/* Navigation Breadcrumbs / Back Button for Mobile */}
        <div className="lg:hidden mb-4">
          {selectedSite ? (
            <button
              onClick={() => { setSelectedSite(null); setSelectedLine(null); setLines([]); }}
              className="flex items-center gap-2 text-[#FF5B00] font-bold text-sm"
            >
              <IconChevronLeft className="w-4 h-4" />
              Назад к списку площадок
            </button>
          ) : selectedClient ? (
            <button
              onClick={() => { setSelectedClient(null); setSelectedSite(null); setSites([]); }}
              className="flex items-center gap-2 text-[#FF5B00] font-bold text-sm"
            >
              <IconChevronLeft className="w-4 h-4" />
              Назад к списку клиентов
            </button>
          ) : null}
        </div>

        <div className={`flex items-center justify-between mb-4 px-2 ${selectedClient ? 'hidden lg:flex' : 'flex'}`}>
          <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Реестр Клиентов</h2>
          {!isViewer && <button onClick={() => setModal({ type: 'client', data: null })} className="w-8 h-8 bg-[#FF5B00] text-white rounded-2xl flex items-center justify-center hover:bg-[#e65200] shadow-md shadow-[#FF5B00]/20 transition-all text-xl font-medium">+</button>}
        </div>

        <div className={`flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-full mb-6 mt-2 text-center shadow-inner ${selectedClient ? 'hidden lg:flex' : 'flex'}`}>
          {[
            { id: 'all', label: 'Все' },
            { id: 'active', label: 'Активная' },
            { id: 'expired', label: 'Истекла' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setSupportFilter(p.id as any)}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-full transition-all ${supportFilter === p.id ? 'bg-white dark:bg-slate-600 text-[#FF5B00] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-1 flex-1">
          {filteredClients.map(c => (
            <div key={c.id} className={`group/item mb-1 ${selectedClient && selectedClient.id !== c.id ? 'hidden lg:block' : 'block'}`}>
              <div className={`flex items-center rounded-2xl transition-all ${selectedClient?.id === c.id ? 'bg-orange-100/50 dark:bg-orange-900/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <button
                  onClick={() => handleClientSelect(c)}
                  className={`flex-1 text-left p-3 flex items-center justify-between ${selectedClient?.id === c.id ? 'text-[#FF5B00] font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-sm truncate">{c.name}</span>
                  </div>
                  <IconChevronRight className={`w-3 h-3 transition-transform ${selectedClient?.id === c.id ? 'rotate-90 text-[#FF5B00]' : 'text-slate-300 dark:text-slate-500'}`} />
                </button>
                {!isViewer && (
                  <>
                    <button onClick={() => setModal({ type: 'client', data: c })} className="p-2 opacity-0 group-hover/item:opacity-100 text-slate-400 dark:text-slate-500 hover:text-[#FF5B00] transition-opacity">✎</button>
                    {isAdmin && <button onClick={() => handleDeleteClient(c.id)} className="p-2 opacity-0 group-hover/item:opacity-100 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-opacity">🗑</button>}
                  </>
                )}
              </div>

              {selectedClient?.id === c.id && (
                <div id="client-sites-tree" className="ml-4 mt-1 space-y-0.5 border-l-2 pl-2 border-slate-100 dark:border-slate-700">
                  {filteredSites.map(s => (
                    <div key={s.id} className={`group/site mb-1 ${selectedSite && selectedSite.id !== s.id ? 'hidden lg:block' : 'block'}`}>
                      <div className={`flex items-center rounded-xl transition-all ${selectedSite?.id === s.id ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <button
                          onClick={() => handleSiteSelect(s)}
                          className={`flex-1 text-left p-2.5 text-xs flex items-center justify-between ${selectedSite?.id === s.id ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-[#FF5B00]'}`}
                        >
                          <span className="truncate">{s.name}</span>
                          <IconChevronRight className={`w-2.5 h-2.5 ${selectedSite?.id === s.id ? 'rotate-90' : ''}`} />
                        </button>
                        {!isViewer && (
                          <>
                            <button onClick={() => setModal({ type: 'site', data: s })} className="p-1.5 opacity-0 group-hover/site:opacity-100 text-slate-400 dark:text-slate-500 hover:text-[#FF5B00] text-[10px] transition-opacity">✎</button>
                            {isAdmin && <button onClick={() => handleDeleteSite(s.id)} className="p-1.5 opacity-0 group-hover/site:opacity-100 text-slate-400 dark:text-slate-500 hover:text-red-500 text-[10px] transition-opacity">🗑</button>}
                          </>
                        )}
                      </div>

                      {selectedSite?.id === s.id && (
                        <div className="ml-3 mt-1 space-y-0.5 border-l pl-2 border-slate-200 dark:border-slate-600">
                          {filteredLines.map(l => (
                            <div key={l.id} className="group/line flex items-center pr-1 mb-0.5">
                              <button
                                onClick={() => handleLineSelect(l)}
                                className={`flex-1 text-left p-2.5 text-xs rounded-xl transition-colors flex items-center justify-between ${selectedLine?.id === l.id ? 'text-[#FF5B00] font-bold bg-white dark:bg-slate-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                              >
                                <span className="truncate mr-2">{l.name}</span>
                                <span
                                  title={getLineStatus(l, currentNow).tooltip}
                                  className={`w-1.5 h-1.5 shrink-0 rounded-full ${['paid', 'warranty', 'warranty_only'].includes(getLineStatus(l, currentNow).status) ? 'bg-emerald-400' : getLineStatus(l, currentNow).status === 'expired' ? 'bg-red-400' : 'bg-slate-200 dark:bg-slate-600'}`}
                                ></span>
                              </button>
                              {!isViewer && (
                                <div className="flex items-center lg:opacity-0 lg:group-hover/line:opacity-100 transition-opacity">
                                  <button onClick={() => setModal({ type: 'line', data: l })} className="p-1.5 text-slate-300 dark:text-slate-500 hover:text-[#FF5B00] transition-colors">✎</button>
                                  {isAdmin && <button onClick={() => handleDeleteLine(l.id)} className="p-1.5 text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors">🗑</button>}
                                </div>
                              )}
                            </div>
                          ))}
                          {isEngineer && !isViewer && (
                            <button onClick={() => setModal({ type: 'line', data: null })} className="w-full text-left p-1 text-[10px] text-[#FF5B00] font-bold hover:underline opacity-60">+ Линия</button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {isEngineer && !isViewer && (
                    <button onClick={() => setModal({ type: 'site', data: null })} className="w-full text-left p-2 text-[10px] text-[#FF5B00] font-bold hover:underline opacity-60">+ Площадка</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`
        flex-1 bg-white dark:bg-slate-800 p-4 lg:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-y-auto
        ${!selectedLine && !selectedSite && !selectedClient ? 'hidden lg:block' : 'block'}
      `}>
        {selectedLine && (
          <div className="lg:hidden mb-6">
            <button
              onClick={() => setSelectedLine(null)}
              className="flex items-center gap-2 text-[#FF5B00] font-bold text-sm"
            >
              <IconChevronLeft className="w-4 h-4" />
              Назад к списку линий
            </button>
          </div>
        )}
        {!selectedLine && selectedSite && (
          <div className="lg:hidden mb-6">
            <button
              onClick={() => { setSelectedSite(null); setLines([]); }}
              className="flex items-center gap-2 text-[#FF5B00] font-bold text-sm"
            >
              <IconChevronLeft className="w-4 h-4" />
              Назад к площадкам
            </button>
          </div>
        )}
        {!selectedLine && !selectedSite && selectedClient && (
          <div className="lg:hidden mb-6">
            <button
              onClick={() => { setSelectedClient(null); setSites([]); }}
              className="flex items-center gap-2 text-[#FF5B00] font-bold text-sm"
            >
              <IconChevronLeft className="w-4 h-4" />
              Назад к клиентам
            </button>
          </div>
        )}
        {
          !selectedLine ? (
            !selectedClient ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600 space-y-4">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <p className="text-sm font-bold uppercase tracking-widest opacity-50 text-center px-4">Выберите клиента в меню слева</p>
              </div>
            ) : selectedSite ? (
              <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">{selectedSite.name}</h1>
                  <p className="text-slate-400 dark:text-slate-500 font-medium">{selectedClient.name} • Площадка</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 dark:bg-slate-800/50 rounded-bl-full -mr-16 -mt-16"></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#FF5B00] mb-4 relative z-10">Информация о площадке</h3>
                  <div className="space-y-4 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1">Адрес</div>
                        {selectedSite.address ? (
                          <a
                            href={`https://yandex.ru/maps/?text=${encodeURIComponent(selectedSite.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#FF5B00] hover:text-[#e65200] hover:underline font-medium transition-colors inline-flex items-center gap-1.5"
                            title="Открыть на Яндекс.Картах"
                          >
                            {selectedSite.address}
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 normal-case font-bold ml-1">→ на карте</span>
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Не указано</p>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1">L3 Маркировка</div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-100 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#FF5B00] rounded-full"></span>
                          {selectedSite.l3_provider === 'Другое' ? selectedSite.l3_provider_custom : (selectedSite.l3_provider || 'Не указано')}
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1">Комментарии</div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 italic mb-4">{selectedSite.notes || 'Нет комментариев'}</p>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#FF5B00]">Контактные лица</h4>
                        {!isViewer && (
                          <button
                            onClick={() => setModal({ type: 'site_contact', data: null })}
                            className="text-[10px] font-bold text-[#FF5B00] hover:text-[#e65200] uppercase tracking-wider underline transition-colors"
                          >
                            + Добавить контакт
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedSite.contacts && selectedSite.contacts.length > 0 ? (
                          selectedSite.contacts.map(contact => (
                            <div key={contact.id} className="bg-slate-50/50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 group hover:border-orange-100 dark:hover:border-orange-900/30 transition-all">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 overflow-hidden mr-4">
                                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate" title={contact.fio}>{contact.fio}</div>
                                  {contact.position && <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider truncate">{contact.position}</div>}

                                  <div className="space-y-1.5 mt-3">
                                    {contact.phone && (
                                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                        <span className="opacity-50">📞</span>
                                        <a href={`tel:${contact.phone}`} className="hover:text-[#FF5B00] hover:underline truncate">{contact.phone}</a>
                                      </div>
                                    )}
                                    {contact.email && (
                                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 overflow-hidden">
                                        <span className="opacity-50">✉️</span>
                                        <a href={`mailto:${contact.email}`} className="hover:text-[#FF5B00] hover:underline truncate" title={contact.email}>{contact.email}</a>
                                      </div>
                                    )}
                                    {contact.comments && (
                                      <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-slate-500 italic text-[11px] leading-relaxed">
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

                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Производственные линии ({lines.length})</h3>
                  {lines.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {lines.map(line => (
                        <button
                          key={line.id}
                          onClick={() => handleLineSelect(line)}
                          className="p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-[#FF5B00] hover:shadow-lg transition-all text-left group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-12 h-12 bg-[#FF5B00]/10 dark:bg-[#FF5B00]/20 rounded-xl flex items-center justify-center group-hover:bg-[#FF5B00] transition-colors">
                              <svg className="w-6 h-6 text-[#FF5B00] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                              </svg>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Линия</div>
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-[#FF5B00] transition-colors flex items-center gap-2">
                            {line.name}
                            {line.cabinet_number && (
                              <span className="text-[10px] font-black text-[#FF5B00] bg-orange-50 dark:bg-orange-400/10 border border-orange-100 dark:border-orange-400/20 px-2 py-0.5 rounded-lg">
                                {line.cabinet_number}
                              </span>
                            )}
                            <span
                              title={getLineStatus(line, currentNow).tooltip}
                              className={`w-2 h-2 rounded-full ${['paid', 'warranty', 'warranty_only'].includes(getLineStatus(line, currentNow).status) ? 'bg-emerald-400' : getLineStatus(line, currentNow).status === 'expired' ? 'bg-red-400' : 'bg-slate-200 dark:bg-slate-700'}`}
                            ></span>
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{line.description || 'Нет описания'}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 text-sm">Нет производственных линий</p>
                      {isEngineer && (
                        <button onClick={() => setModal({ type: 'line', data: null })} className="mt-4 px-4 py-2 bg-[#FF5B00] text-white rounded-xl text-xs font-bold hover:bg-[#e65200]">+ Добавить линию</button>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Статистика</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => { setShowSitesTiles(!showSitesTiles); setShowLinesTiles(false); }}
                        className={`p-5 rounded-3xl border text-center transition-all cursor-pointer ${showSitesTiles ? 'bg-orange-50 border-[#FF5B00] dark:bg-orange-950/20 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-[#FF5B00]/60'}`}
                      >
                        <div className={`text-3xl font-black ${showSitesTiles ? 'text-[#FF5B00]' : 'text-slate-800 dark:text-slate-200'}`}>{sites.length}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mt-1">Площадок</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowLinesTiles(!showLinesTiles); setShowSitesTiles(false); }}
                        className={`p-5 rounded-3xl border text-center transition-all cursor-pointer ${showLinesTiles ? 'bg-orange-50 border-[#FF5B00] dark:bg-orange-950/20 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-[#FF5B00]/60'}`}
                      >
                        <div className={`text-3xl font-black ${showLinesTiles ? 'text-[#FF5B00]' : 'text-slate-800 dark:text-slate-200'}`}>
                          {sites.reduce((acc, site) => acc + (site.line_count || 0), 0)}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mt-1">Линий</div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sites Tiles (Smooth Reveal) */}
                <div className={`expand-grid mt-6 ${showSitesTiles ? 'is-open' : ''}`}>
                  <div className="expand-inner">
                    <div className="space-y-4 pb-6 px-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-[#FF5B00]">Выберите площадку</h3>
                        <button onClick={() => setShowSitesTiles(false)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Скрыть</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sites.map(s => (
                          <button
                            key={s.id}
                            onClick={() => { handleSiteSelect(s); setShowSitesTiles(false); }}
                            className="group p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-[#FF5B00] hover:shadow-xl transition-all text-left relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-2 h-full bg-[#FF5B00] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#FF5B00] transition-colors">{s.name}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest font-black line-clamp-1">{s.address || 'Адрес не указан'}</div>
                            <div className="flex items-center gap-3 mt-3">
                              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded">
                                {s.line_count || 0} линий
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lines Tiles (Smooth Reveal) */}
                <div className={`expand-grid mt-6 ${showLinesTiles ? 'is-open' : ''}`}>
                  <div className="expand-inner">
                    <div className="space-y-6 pb-6 px-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-[#FF5B00]">Производственные линии в разрезе площадок</h3>
                        <button onClick={() => setShowLinesTiles(false)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Скрыть</button>
                      </div>
                      <div className="space-y-8">
                        {sites.map(s => (
                          <div key={s.id} className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{s.name}</h4>
                              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {(allLines.filter(l => l.site_id === s.id)).map(l => (
                                <button
                                  key={l.id}
                                  onClick={() => { handleLineSelect(l); setShowLinesTiles(false); }}
                                  className="group p-5 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-transparent hover:border-emerald-400/50 hover:bg-white dark:hover:bg-slate-800 transition-all text-left flex items-center justify-between shadow-sm"
                                >
                                  <div>
                                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-emerald-500 transition-colors">{l.name}</div>
                                    <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{l.cabinet_number || 'Шкаф не указ.'}</div>
                                  </div>
                                  <div className={`w-1.5 h-1.5 rounded-full ${['paid', 'warranty', 'warranty_only'].includes(getLineStatus(l, currentNow).status) ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-300'}`}></div>
                                </button>
                              ))}
                              {(!allLines.some(l => l.site_id === s.id)) && (
                                <div className="col-span-full py-4 text-center text-slate-300 italic text-[10px] uppercase tracking-widest">Нет линий на этой площадке</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="border-b dark:border-slate-800 pb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 title={selectedLine.tooltip_message || ''} className="text-3xl font-black text-slate-900 dark:text-slate-100 mb-1 cursor-help underline decoration-dotted decoration-slate-200 dark:decoration-slate-700 underline-offset-4 hover:decoration-[#FF5B00] transition-all">
                      {selectedLine.name}
                    </h1>
                    <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">{selectedClient?.name} / {selectedSite?.name}</p>
                  </div>

                  {selectedLine.cabinet_number && (
                    <div className="hidden md:flex flex-1 justify-center px-4">
                      <div className="px-4 py-2 bg-orange-50 dark:bg-orange-400/10 border border-orange-100 dark:border-orange-400/20 rounded-2xl flex flex-col items-center">
                        <span className="text-[10px] font-black text-orange-400 dark:text-orange-500 uppercase tracking-widest leading-none mb-1">Шкаф управления</span>
                        <span className="text-xl font-black text-[#FF5B00] leading-none">{selectedLine.cabinet_number}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span
                      title={getLineStatus(selectedLine, currentNow).tooltip}
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-transparent shadow-sm flex items-center gap-2 cursor-help ${getLineStatus(selectedLine, currentNow).color}`}
                    >
                      {getLineStatus(selectedLine, currentNow).label}
                      {getLineStatus(selectedLine, currentNow).remaining && <span className="opacity-75 font-normal border-l pl-2 ml-1 border-current">
                        {getLineStatus(selectedLine, currentNow).remaining}
                      </span>}
                    </span>
                    {isEngineer && !isViewer && (
                      <button
                        onClick={() => handleDuplicateLine(selectedLine)}
                        className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold hover:border-[#FF5B00] dark:hover:border-[#FF5B00] hover:text-[#FF5B00] transition-colors shadow-sm"
                        title="Создать копию линии со всем оборудованием (S/N сбросятся)"
                      >
                        Дублировать
                      </button>
                    )}
                    <button onClick={() => setModal({ type: 'line', data: selectedLine })} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Настроить линию</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 group relative shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Монтажные Особенности</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">{selectedLine.mounting_features || 'Не заполнено'}</p>
                  </div>
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 group relative shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Специфика Эксплуатации</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">{selectedLine.operational_specifics || 'Не заполнено'}</p>
                  </div>
                </div>
              </div>

              {/* Middle Section: DB & Remote Access */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Database Connection Card */}
                <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-900/10 rounded-bl-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform"></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-[#FF5B00] rounded-full"></span>
                    Подключение к Базе Данных (Линия)
                  </h3>
                  {selectedLine.db_ip ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 relative z-10">
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1">IP Адрес Сервера</div>
                        <div className="font-mono text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-700">{selectedLine.db_ip}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1">Имя Базы</div>
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-700">{selectedLine.db_name}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1">Логин</div>
                        <div className="text-sm text-slate-700 dark:text-slate-300">{selectedLine.db_user}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1">Пароль</div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 font-mono">••••••••</div>
                      </div>
                      {selectedLine.db_notes && (
                        <div className="sm:col-span-2">
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1">Комментарий</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 italic">{selectedLine.db_notes}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-300 italic mb-3">Параметры БД не настроены</p>
                      <button onClick={() => setModal({ type: 'line', data: selectedLine })} className="text-[10px] font-bold text-[#FF5B00] hover:underline">Настроить сейчас →</button>
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-[#FF5B00]">Удаленное подключение</h3>
                    {!isViewer && (
                      <button
                        onClick={() => setModal({ type: 'remote', data: null })}
                        className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest underline transition-colors"
                      >
                        + Добавить
                      </button>
                    )}
                  </div>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {remote.length > 0 ? remote.map((r) => (
                      <div key={r.id} className="group/remote border-b border-white/5 pb-3 last:border-0 last:pb-0">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 group/id">
                              <div className="text-lg font-black text-white truncate" title={r.url_or_address}>{r.url_or_address}</div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(r.url_or_address);
                                  setToastMessage('ID скопирован');
                                  setTimeout(() => setToastMessage(null), 2000);
                                }}
                                className="p-1 text-white/20 hover:text-white transition-colors opacity-0 group-hover/id:opacity-100"
                                title="Копировать ID"
                              >
                                <IconCopy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold uppercase tracking-wider">{r.type}</span>
                              {r.notes && <span className="text-[10px] text-white/40 italic truncate max-w-[150px]">{r.notes}</span>}
                            </div>
                            {r.credentials && (
                              <div className="text-[10px] text-white/30 font-mono mt-2 bg-black/20 p-2 rounded-lg break-all">
                                {r.credentials}
                              </div>
                            )}
                          </div>
                          {!isViewer && (
                            <div className="flex gap-1 ml-2 lg:opacity-0 lg:group-hover/remote:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => setModal({ type: 'remote', data: r })} className="p-1.5 text-white/40 hover:text-[#FF5B00] transition-colors">✎</button>
                              <button onClick={() => handleDeleteRemote(r.id)} className="p-1.5 text-white/40 hover:text-red-500 transition-colors">✕</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="text-white/20 text-xs italic py-4">Параметры доступа не настроены</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Equipment Table */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-[#FF5B00] rounded-full"></span>
                    Спецификация Оборудования
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={() => setModal({ type: 'import_line', data: null })} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-5 py-2.5 rounded-full text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2">
                      <span>📥</span> Импорт
                    </button>
                    {!isViewer && <button onClick={() => setModal({ type: 'equipment', data: null })} className="bg-[#FF5B00] text-white px-5 py-2.5 rounded-full text-xs font-bold hover:bg-[#e65200] shadow-md shadow-[#FF5B00]/20 transition-all">+ Добавить</button>}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase border-b dark:border-slate-800 tracking-widest">
                      <tr>
                        <th className="px-2 py-4 w-8"></th>
                        <th className="px-6 py-4">Модель / Артикул</th>
                        <th className="px-6 py-4">Сеть (IP)</th>
                        <th className="px-6 py-4 text-center">Статус</th>
                        <th className="px-6 py-4">Примечания</th>
                        <th className="px-6 py-4 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {equipment.length > 0 ? equipment.map(e => (
                        <tr
                          key={e.id}
                          className={`text-sm group hover:bg-orange-50/20 transition-all cursor-move ${draggedEquipId === e.id ? 'opacity-50' : ''
                            }`}
                          draggable
                          onDragStart={(ev) => handleDragStart(ev, e.id)}
                          onDragOver={handleDragOver}
                          onDrop={(ev) => handleDrop(ev, e.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <td className="px-2 py-4 text-slate-400">
                            <div className="text-lg leading-none cursor-grab active:cursor-grabbing">⋮⋮</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{e.model}</div>
                            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{e.article || 'Артикул отсутствует'}</div>
                          </td>
                          <td className="px-6 py-4">
                            {e.ip_address ? (
                              <div className="flex flex-col">
                                <span className="font-mono text-slate-700 dark:text-slate-300 text-xs">{e.ip_address}</span>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500">Mask: {e.subnet_mask || '—'}</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-xs italic">не настроено</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <select
                              value={e.status}
                              onChange={(ev) => changeEquipStatus(e.id, ev.target.value as EquipmentStatus)}
                              className={`text-[10px] font-bold uppercase py-1.5 px-3 rounded-full focus:outline-none cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all ${e.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                e.status === 'maintenance' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                }`}
                            >
                              <option value="active">Активен</option>
                              <option value="maintenance">Сервис</option>
                              <option value="faulty">Брак</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs italic max-w-[200px] truncate">{e.notes}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            {!isViewer && <button onClick={() => setModal({ type: 'equipment', data: e })} className="p-2 text-slate-300 dark:text-slate-600 hover:text-[#FF5B00] dark:hover:text-[#FF5B00] transition-colors">✎</button>}
                            {isEngineer && <button onClick={() => handleDeleteEquip(e.id)} className="p-2 text-slate-200 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 transition-colors">✕</button>}
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-300 dark:text-slate-600 italic text-sm">Оборудование не добавлено</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Support Tools Grid (Documentation) */}
              <div
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative"
                onDragOver={onInstructionDragOver}
                onDragEnter={onInstructionDragOver}
                onDragLeave={onInstructionDragLeave}
                onDrop={onInstructionDrop}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Документация и Ресурсы</h3>
                  {!isViewer && <button onClick={() => setModal({ type: 'instruction', data: null })} className="text-[10px] font-bold text-[#FF5B00] hover:text-[#e65200] uppercase tracking-wider underline transition-colors">+ Добавить документ</button>}
                </div>

                {dragActiveDocs && (
                  <div className="absolute inset-0 bg-[#FF5B00]/10 flex items-center justify-center rounded-2xl z-40 pointer-events-none">
                    <div className="bg-white/90 dark:bg-slate-800/90 px-6 py-4 rounded-lg text-[#FF5B00] font-bold">Отпустите файлы, чтобы загрузить</div>
                  </div>
                )}

                {isUploadingDocs && (
                  <div className="absolute top-4 right-4 z-50 bg-white/90 dark:bg-slate-800/90 px-3 py-2 rounded-lg text-sm font-semibold text-[#FF5B00]">Загрузка...</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {instructions.length > 0 ? (
                    <>
                      {instructions.map(i => (
                        <div key={i.id} className="group flex items-center p-4 rounded-3xl bg-[#F8FAFC] dark:bg-slate-800/40 border border-slate-50 dark:border-slate-800 hover:bg-orange-50 dark:hover:bg-orange-900/10 hover:border-orange-100 dark:hover:border-orange-900/20 transition-all shadow-sm">
                          <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-xl mr-4 shadow-sm text-[#FF5B00]">📄</div>
                          <div className="flex-1 overflow-hidden">
                            <a
                              href={(() => {
                                if (!i.link) return '#';
                                // Convert UNC paths (\\server\share\file) to file:// URI
                                if (/^\\\\/.test(i.link)) {
                                  // Replace backslashes with forward slashes and prepend file://
                                  return 'file:' + i.link.replace(/\\\\/g, '/').replace(/\\/g, '/');
                                }
                                return i.link;
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-black text-slate-800 dark:text-slate-100 hover:underline block truncate"
                              title={i.link}
                            >
                              {i.module_type || 'Файл'}
                            </a>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">Версия {i.version || '1.0'} • {i.notes || 'Без описания'}</p>
                            {copiedLinkId === i.id && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">Ссылка скопирована</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isViewer && <button onClick={() => setModal({ type: 'instruction', data: i })} className="p-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#FF5B00] transition-all">✎</button>}

                            <button
                              onClick={() => openInExplorer(i.link)}
                              title="Открыть в Проводнике"
                              className="p-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-all"
                            >
                              📂
                            </button>

                            <button
                              onClick={async () => {
                                // Copy original link to clipboard
                                try {
                                  let text = i.link || '';
                                  // Strip surrounding quotes if present (common issue with some CSV imports)
                                  text = text.replace(/^["']|["']$/g, '');

                                  if (navigator.clipboard && navigator.clipboard.writeText) {
                                    await navigator.clipboard.writeText(text);
                                  } else {
                                    const dummy = document.createElement('textarea');
                                    document.body.appendChild(dummy);
                                    dummy.value = text;
                                    dummy.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(dummy);
                                  }
                                  // Context-aware hint
                                  const hint = (() => {
                                    if (!text) return 'Ссылка скопирована в буфер обмена';
                                    if (/^\\\\/.test(text) || text.startsWith('file:')) return 'Ссылка скопирована. Если браузер блокирует открытие file://, откройте путь в Проводнике (вставьте путь в адресную строку Проводника)';
                                    if (/^https?:\/\//.test(text)) return 'Ссылка скопирована в буфер обмена — вставьте в адресную строку или откройте в новой вкладке';
                                    return 'Ссылка скопирована в буфер обмена';
                                  })();
                                  setCopiedLinkId(i.id);
                                  setToastMessage(hint);
                                  setTimeout(() => { setCopiedLinkId(null); setToastMessage(null); }, 3000);
                                } catch (err) {
                                  console.error('Copy failed:', err);
                                  alert('Не удалось скопировать ссылку');
                                }
                              }}
                              title="Копировать ссылку"
                              className="p-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-all"
                            >
                              📋
                            </button>

                            {isAdmin && (
                              <button
                                onClick={async () => {
                                  if (!selectedLine) return;
                                  if (!window.confirm('Удалить документ?')) return;
                                  try {
                                    await api.deleteInstruction(i.id);
                                    setInstructions(await api.getInstructions(selectedLine.id));
                                  } catch (err) {
                                    console.error('Failed to delete instruction:', err);
                                    alert('Не удалось удалить документ');
                                  }
                                }}
                                className="p-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : <div className="col-span-full text-center py-6 text-slate-300 italic text-xs">Нет прикрепленных документов</div>}
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
                <h4 className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  Общая информация
                </h4>
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

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  <span className="w-1.5 h-1.5 bg-[#FF5B00] rounded-full"></span>
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

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div>
                  <h4 className="text-[11px] font-black text-emerald-600 uppercase mb-2 tracking-widest">
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
                  <h4 className="text-[11px] font-black text-indigo-600 uppercase mb-2 tracking-widest">Платная техподдержка</h4>
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
              <div className="mb-6 p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50">
                <label className="text-[10px] font-black text-[#FF5B00] uppercase mb-2 block tracking-widest">Найти в базе (копирование модели)</label>
                <input
                  type="text"
                  placeholder="Поиск по модели или S/N..."
                  className="w-full border border-orange-100 bg-white rounded-xl p-2.5 text-xs mb-2 shadow-sm focus:ring-0 outline-none"
                  value={equipSearchQuery}
                  onChange={(e) => searchGlobalEquip(e.target.value)}
                />
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {equipSearchResults.map((res, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left p-2 text-[11px] hover:bg-[#FF5B00] hover:text-white rounded-lg flex justify-between bg-white border border-slate-100 transition-all group"
                      onClick={() => {
                        // Use state update to force re-render with new defaultValues
                        // We set ID to undefined so it treats it as a NEW record
                        setModal({ type: 'equipment', data: { ...res.raw, id: undefined } });
                        setEquipSearchQuery('');
                        setEquipSearchResults([]);
                      }}
                    >
                      <span className="font-medium">{res.name}</span>
                      <span className="text-[#FF5B00] group-hover:text-orange-100 font-bold uppercase text-[9px]">Копировать ⭲</span>
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

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-[11px] font-black text-slate-800 uppercase mb-4 flex items-center gap-2 tracking-widest">
                  <span className="w-1.5 h-1.5 bg-[#FF5B00] rounded-full"></span>
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

              <div className="pt-4 border-t border-slate-100">
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
          <div className="fixed right-6 bottom-6 z-50">
            <div className="bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg max-w-xs">{toastMessage}</div>
          </div>
        )
      }
    </div>
  );
};

export default ClientManager;
