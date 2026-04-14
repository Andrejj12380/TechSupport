
import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  Calendar,
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Filter,
  Factory,
  Clock,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { PostImplementationAnalytics as AnalyticsType, AnalyticsDrilldownTicket } from '../types';

interface PostImplementationAnalyticsProps {
  onBack?: () => void;
}

const PostImplementationAnalytics: React.FC<PostImplementationAnalyticsProps> = ({ onBack }) => {
  const [data, setData] = useState<AnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMinMonths, setFilterMinMonths] = useState(0);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [drilldownTickets, setDrilldownTickets] = useState<AnalyticsDrilldownTicket[]>([]);
  const [isDrilldownLoading, setIsDrilldownLoading] = useState(false);

  // Interaction State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null);

  const resetInteraction = () => {
    setZoom(1);
    setPan(0);
  };

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.3, 10));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.3, 1));

  const ZoomControls = () => (
    <div className="flex items-center gap-1">
      <button onClick={zoomOut} disabled={zoom <= 1} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center text-sm font-bold">−</button>
      <button onClick={zoomIn} disabled={zoom >= 10} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center text-sm font-bold">+</button>
      {zoom > 1 && <button onClick={resetInteraction} className="h-7 px-2 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black text-white/40 hover:text-white/70 uppercase tracking-wider transition-all">1:1</button>}
    </div>
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setStartX(e.clientX - pan);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newPan = e.clientX - startX;
    // Bounds for pan
    const maxPan = 0;
    const minPan = -(800 * (zoom - 1));
    setPan(Math.min(maxPan, Math.max(minPan, newPan)));
  };

  const handleMouseUp = () => setIsDragging(false);

  const fetchDrilldown = async (monthIndex: number) => {
    try {
      setSelectedMonth(monthIndex);
      setIsDrilldownLoading(true);
      const tickets = await api.getPostImplementationDrilldown(monthIndex);
      setDrilldownTickets(tickets);
    } catch (err: any) {
      console.error('Error fetching drilldown:', err);
    } finally {
      setIsDrilldownLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const result = await api.getPostImplementationAnalytics();
        setData(result);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const toggleClient = (clientId: number) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const groupedData = useMemo(() => {
    if (!data) return [];

    // Group lines by client
    const groups: Record<number, {
      client_id: number;
      client_name: string;
      lines: typeof data.lineStats;
      agg: {
        first_month_tickets: number;
        subsequent_tickets: number;
        subsequent_avg: number;
        last_30d_tickets: number;
        max_months: number;
        total_effort_mins: number;
        avg_resolution_hours: number;
        l3_escalations: number;
      }
    }> = {};

    data.lineStats.forEach(line => {
      if (!groups[line.client_id]) {
        groups[line.client_id] = {
          client_id: line.client_id,
          client_name: line.client_name,
          lines: [],
          agg: {
            first_month_tickets: 0,
            subsequent_tickets: 0,
            subsequent_avg: 0,
            last_30d_tickets: 0,
            max_months: 0,
            total_effort_mins: 0,
            avg_resolution_hours: 0,
            l3_escalations: 0
          }
        };
      }
      groups[line.client_id].lines.push(line);
      groups[line.client_id].agg.first_month_tickets += Number(line.first_month_tickets || 0);
      groups[line.client_id].agg.subsequent_tickets += Number(line.subsequent_tickets || 0);
      groups[line.client_id].agg.last_30d_tickets += Number(line.last_30d_tickets || 0);
      groups[line.client_id].agg.max_months = Math.max(groups[line.client_id].agg.max_months, Number(line.months_since_start || 0));
      groups[line.client_id].agg.total_effort_mins += Number(line.total_effort_mins || 0);
      groups[line.client_id].agg.l3_escalations += Number(line.l3_escalations || 0);
    });

    // Calculate averages for groups
    Object.values(groups).forEach(g => {
      g.agg.subsequent_avg = g.lines.reduce((sum, l) => sum + Number(l.subsequent_avg || 0), 0);
      g.agg.avg_resolution_hours = g.lines.reduce((sum, l) => sum + Number(l.avg_resolution_hours || 0), 0) / g.lines.length;
    });

    return Object.values(groups)
      .filter(g => g.agg.max_months >= filterMinMonths)
      .sort((a, b) => b.agg.last_30d_tickets - a.agg.last_30d_tickets);
  }, [data, filterMinMonths]);

  const activityGroups = useMemo(() => {
    if (!data) return { low: 0, medium: 0, high: 0 };
    return data.lineStats.reduce((acc, line) => {
      const avg = Number(line.subsequent_avg || 0);
      if (avg >= 5) acc.high++;
      else if (avg >= 1) acc.medium++;
      else acc.low++;
      return acc;
    }, { low: 0, medium: 0, high: 0 });
  }, [data]);

  // SVG Chart Logic for Ticket Trends
  const chartPoints = useMemo(() => {
    if (!data || data.monthlyTrend.length === 0) return '';
    const trend = data.monthlyTrend;
    const maxTickets = Math.max(...trend.map(t => Number(t.avg_tickets_per_line || 0))) || 1;
    const padding = 60; // Increased padding for labels
    const width = 800;
    const height = 300;
    const stepX = (width - padding * 2) / Math.max(trend.length - 1, 1);

    return trend.map((t, i) => {
      const x = padding + i * stepX;
      const val = Number(t.avg_tickets_per_line || 0);
      const y = (height - padding) - (val / maxTickets) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');
  }, [data]);

  // SVG Chart Logic for MTTR (Resolution Time)
  const mttrChartPoints = useMemo(() => {
    if (!data || data.monthlyTrend.length === 0) return '';
    const trend = data.monthlyTrend;
    const maxHours = Math.max(...trend.map(t => Number(t.avg_resolution_hours || 0))) || 1;
    const padding = 60; // Increased padding for labels
    const width = 800;
    const height = 300;
    const stepX = (width - padding * 2) / Math.max(trend.length - 1, 1);

    return trend.map((t, i) => {
      const x = padding + i * stepX;
      const val = Number(t.avg_resolution_hours || 0);
      const y = height - padding - (val / maxHours) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');
  }, [data]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-12 h-12 border-4 border-[#FF5B00]/20 border-t-[#FF5B00] rounded-full animate-spin" />
      <p className="text-white/50 font-bold uppercase tracking-widest text-xs">Загрузка аналитики...</p>
    </div>
  );

  if (error) return (
    <div className="glass-card p-12 rounded-[2.5rem] border border-red-500/20 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-xl font-black text-white mb-2">Ошибка</h3>
      <p className="text-white/60 mb-6">{error}</p>
      <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white/10 rounded-xl text-white font-bold hover:bg-white/20 transition-all">Попробовать снова</button>
    </div>
  );

  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-tight">Аналитика внедрений (Lines)</h1>
            <p className="text-white/50 font-medium">Динамика спроса в разрезе производственных линий</p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-card p-8 rounded-[2rem] border border-white/10 relative group">
          <div className="absolute top-8 right-8 text-white/20 group-hover:text-[#FF5B00] transition-colors cursor-help" title="Среднее количество обращений на одну линию за первый месяц после внедрения. Это базовый уровень нагрузки.">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4">
            <Activity className="w-6 h-6 text-indigo-500" />
          </div>
          <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">Средний спрос (M1)</p>
          <p className="text-4xl font-black text-white">
            {data.monthlyTrend.find(t => t.month_index === 0)?.avg_tickets_per_line || 0}
          </p>
          <p className="text-xs text-slate-400 mt-2 font-bold select-none">Запросов на одну линию за 1-й месяц</p>
        </div>

        <div className="glass-card p-8 rounded-[2rem] border border-white/10 relative group">
          <div className="absolute top-8 right-8 text-white/20 group-hover:text-[#FF5B00] transition-colors cursor-help" title="Процент снижения нагрузки от первого месяца к текущему. 100% — идеальное обучение и автономность персонала, 0% — отсутствие прогресса.">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4">
            <TrendingDown className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">Коэффициент обучения</p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-white">
              {(() => {
                const m0 = data.monthlyTrend.find(t => t.month_index === 0)?.avg_tickets_per_line || 0;
                const last = data.monthlyTrend[data.monthlyTrend.length - 1]?.avg_tickets_per_line || 0;
                if (m0 === 0) return '0%';
                const decay = Math.round(((m0 - last) / m0) * 100);
                return `${decay}%`;
              })()}
            </p>
            <TrendingDown className="w-5 h-5 text-emerald-500 mb-1" />
          </div>
          <p className="text-xs text-slate-400 mt-2 font-bold select-none">Снижение нагрузки к концу периода</p>
        </div>

        <div className="glass-card p-8 rounded-[2rem] border border-white/10 relative group">
          <div className="absolute top-8 right-8 text-white/20 group-hover:text-[#FF5B00] transition-colors cursor-help" title="Распределение линий по интенсивности обращений в текущий момент: High (>=5), Med (>=1), Low (<1) обращений в месяц.">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">Активность линий</p>
          <div className="flex gap-4 mt-2">
            <div className="text-center">
              <span className="text-lg font-black text-red-500">{activityGroups.high}</span>
              <div className="text-[9px] text-white/40 font-black uppercase">High</div>
            </div>
            <div className="text-center">
              <span className="text-lg font-black text-amber-500">{activityGroups.medium}</span>
              <div className="text-[9px] text-white/40 font-black uppercase">Med</div>
            </div>
            <div className="text-center">
              <span className="text-lg font-black text-emerald-500">{activityGroups.low}</span>
              <div className="text-[9px] text-white/40 font-black uppercase">Low</div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 font-bold select-none">Всего активных линий: {data.lineStats.length}</p>
        </div>
      </div>

      {/* Combined Life Cycle and Trend Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-stretch">
        {/* Life Cycle Narrative */}
        <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.02] flex flex-col h-full">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#FF5B00]/10 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-[#FF5B00]" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Жизненный цикл</h2>
          </div>
          <div className="text-[13px] text-white/70 leading-relaxed space-y-4 flex-1">
            <p>
              {(() => {
                const trend = data.monthlyTrend;
                const m0 = Number(trend.find(t => t.month_index === 0)?.avg_tickets_per_line || 0);
                return (
                  <>
                    Активное взаимодействие начинается с <strong>M0</strong>, когда нагрузка максимальна (<strong>{m0.toFixed(1)} обращений</strong>). Это период первичной настройки и обучения.
                  </>
                );
              })()}
            </p>
            <p>
              {(() => {
                const trend = data.monthlyTrend;
                const m0 = Number(trend.find(t => t.month_index === 0)?.avg_tickets_per_line || 0);
                const m1_3 = trend.filter(t => t.month_index >= 1 && t.month_index <= 3);
                const m1_3_avg = m1_3.length ? m1_3.reduce((s, t) => s + Number(t.avg_tickets_per_line), 0) / m1_3.length : 0;
                const reduction = m0 > 0 ? Math.round(((m0 - m1_3_avg) / m0) * 100) : 0;
                return (
                  <>
                    В фазе адаптации (M1-M3) количество вопросов обычно снижается на <strong>{reduction}%</strong>. Персонал переходит к специфическим кейсам.
                  </>
                );
              })()}
            </p>
            <p>
              {(() => {
                const trend = data.monthlyTrend;
                const m6_plus = trend.filter(t => t.month_index >= 6);
                const m6_avg = m6_plus.length ? m6_plus.reduce((s, t) => s + Number(t.avg_tickets_per_line), 0) / m6_plus.length : 0;
                if (m6_plus.length === 0) return "Данных для анализа стабилизации пока недостаточно.";
                return (
                  <>
                    После <strong>6-го месяца</strong> спрос стабилизируется на уровне <strong>{m6_avg.toFixed(1)} обращений/мес</strong>. Переход в штатный режим эксплуатации.
                  </>
                );
              })()}
            </p>
          </div>
        </div>

        {/* Main Chart: Tickets Demand Trend */}
        <div className="xl:col-span-2 glass-card rounded-[2.5rem] border border-white/10 overflow-hidden glass-surface p-8 h-full">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black text-white italic uppercase tracking-tight">Тренд обращений (M0-M{data.monthlyTrend.length - 1})</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Ось Y: Обращений/мес • Ось X: Месяцы от запуска</p>
            </div>
            <div className="flex items-center gap-3">
              <ZoomControls />
            </div>
          </div>

          <div 
            className="relative h-[280px] w-full cursor-grab overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg className="w-full h-full overflow-visible" viewBox="0 0 800 300">
              <g transform={`translate(${pan}, 0) scale(${zoom}, 1)`}>
                {/* Data Points moved into transformed group */}
                {chartPoints && (
                  <>
                    <polyline points={chartPoints} fill="none" stroke="#FF5B00" strokeWidth={4 / zoom} strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(255,91,0,0.5)]" />
                    <polyline points={`60,240 ${chartPoints} 740,240`} fill="url(#orangeGrad)" stroke="none" />
                    <defs>
                      <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF5B00" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#FF5B00" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {data.monthlyTrend.map((t, i) => {
                      const pointsArr = chartPoints.split(' ');
                      if (!pointsArr[i]) return null;
                      const [px, py] = pointsArr[i].split(',').map(Number);
                      return (
                        <g key={i} className="group/point">
                          <circle 
                            cx={px} cy={py} r={5 / zoom} fill="#FF5B00" 
                            className="transition-all hover:fill-white cursor-pointer" 
                            onClick={() => fetchDrilldown(t.month_index)}
                          />
                          <text
                            x={px} y={py - (20 / zoom)}
                            textAnchor="middle"
                            className="text-[16px] fill-white font-black opacity-0 group-hover/point:opacity-100 transition-opacity pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                            style={{ fontSize: `${16/zoom}px` }}
                          >
                            {t.avg_tickets_per_line}
                          </text>
                          <text 
                            x={px} y={260} 
                            textAnchor="middle" 
                            className="text-[11px] fill-slate-400 font-bold uppercase"
                            style={{ fontSize: `${11/zoom}px` }}
                          >
                            M{t.month_index}
                          </text>
                        </g>
                      );
                    })}
                  </>
                )}
              </g>

              {/* Grid & Y-Axis (Static - outside the group) */}
              {[0, 0.5, 1].map(p => {
                const maxVal = Math.max(...data.monthlyTrend.map(t => Number(t.avg_tickets_per_line))) || 1;
                const y = 60 + p * 180;
                const val = (maxVal * (1 - p)).toFixed(1);
                return (
                  <g key={p}>
                    <line x1="60" y1={y} x2="740" y2={y} stroke="white" strokeOpacity="0.05" strokeDasharray="4 4" />
                    <text x="50" y={y + 4} textAnchor="end" className="text-[12px] fill-slate-500 font-black">{val}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* MTTR Chart — Full Width */}
      <div className="glass-card rounded-[2.5rem] border border-white/10 overflow-hidden glass-surface p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-white">Среднее время решения (MTTR)</h2>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Динамика скорости закрытия обращений (часы)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-500" />
            </div>
            <ZoomControls />
          </div>
        </div>

        <div 
          className="relative h-[300px] w-full cursor-grab overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg className="w-full h-full overflow-visible" viewBox="0 0 800 300">
            <g transform={`translate(${pan}, 0) scale(${zoom}, 1)`}>
              <polyline
                points={mttrChartPoints}
                fill="none"
                stroke="#10B981"
                strokeWidth={4 / zoom}
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              />
              {data.monthlyTrend.map((t, i) => {
                const pointsArr = mttrChartPoints.split(' ');
                if (!pointsArr[i]) return null;
                const [px, py] = pointsArr[i].split(',').map(Number);
                return (
                  <g key={i} className="group/point">
                    <circle cx={px} cy={py} r={4 / zoom} fill="#10B981" />
                    <text
                      x={px} y={py - (20 / zoom)}
                      textAnchor="middle"
                      className="text-[16px] fill-white font-black opacity-0 group-hover/point:opacity-100 transition-opacity pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                      style={{ fontSize: `${16/zoom}px` }}
                    >
                      {t.avg_resolution_hours}ч
                    </text>
                    <text 
                      x={px} y={260} 
                      textAnchor="middle" 
                      className="text-[11px] fill-slate-500 font-bold uppercase"
                      style={{ fontSize: `${11/zoom}px` }}
                    >
                      M{t.month_index}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Grid & Y-Axis (Static) */}
            {[0, 0.5, 1].map(p => {
              const maxVal = Math.max(...data.monthlyTrend.map(t => Number(t.avg_resolution_hours))) || 1;
              const y = 60 + p * 180;
              const val = (maxVal * (1 - p)).toFixed(1);
              return (
                <g key={p}>
                  <line x1="60" y1={y} x2="740" y2={y} stroke="white" strokeOpacity="0.05" strokeDasharray="4 4" />
                  <text x="50" y={y + 4} textAnchor="end" className="text-[12px] fill-slate-500 font-black">{val}ч</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Category Analysis — Two Charts */}
      {(() => {
        const CATEGORY_COLORS = ['#FF5B00', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#64748B'];

        // --- Lifecycle chart data ---
        const lifecycleData = data.categoryByLifecycle || [];
        const lifecycleCategories = [...new Set(lifecycleData.map(d => d.category_name))];
        const lifecycleMonths = [...new Set(lifecycleData.map(d => d.month_index))].sort((a, b) => a - b);
        const lifecycleMax = Math.max(...lifecycleData.map(d => d.avg_per_line), 1);

        const buildLifecyclePoints = (cat: string) => {
          const padding = 60;
          const width = 800;
          const height = 300;
          const stepX = (width - padding * 2) / Math.max(lifecycleMonths.length - 1, 1);
          return lifecycleMonths.map((m, i) => {
            const entry = lifecycleData.find(d => d.month_index === m && d.category_name === cat);
            const val = entry?.avg_per_line || 0;
            const x = padding + i * stepX;
            const y = (height - padding) - (val / lifecycleMax) * (height - padding * 2);
            return { x, y, val, month: m };
          });
        };

        // --- Calendar chart data ---
        const calendarData = data.categoryByCalendar || [];
        const calendarCategories = [...new Set(calendarData.map(d => d.category_name))];
        const calendarMonths = [...new Set(calendarData.map(d => d.calendar_month))].sort();
        const calendarMax = Math.max(...calendarData.map(d => d.ticket_count), 1);

        const buildCalendarPoints = (cat: string) => {
          const padding = 60;
          const width = 800;
          const height = 300;
          const stepX = (width - padding * 2) / Math.max(calendarMonths.length - 1, 1);
          return calendarMonths.map((m, i) => {
            const entry = calendarData.find(d => d.calendar_month === m && d.category_name === cat);
            const val = entry?.ticket_count || 0;
            const x = padding + i * stepX;
            const y = (height - padding) - (val / calendarMax) * (height - padding * 2);
            return { x, y, val, month: m };
          });
        };

        const formatCalMonth = (m: string) => {
          const [y, mo] = m.split('-');
          const names = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
          return `${names[parseInt(mo) - 1]}'${y.slice(2)}`;
        };

        // Shared color legend
        const allCats = [...new Set([...lifecycleCategories, ...calendarCategories])];
        const isActive = (cat: string) => !highlightedCategory || highlightedCategory === cat;
        const legend = (
          <div className="flex flex-wrap gap-2 mb-6">
            {allCats.map((cat, i) => {
              const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
              const active = isActive(cat);
              const selected = highlightedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setHighlightedCategory(prev => prev === cat ? null : cat)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    selected
                      ? 'border-white/30 bg-white/10 ring-1 ring-white/20'
                      : active
                        ? 'border-white/5 hover:border-white/20 hover:bg-white/5'
                        : 'border-transparent opacity-30 hover:opacity-60'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-wider">{cat}</span>
                </button>
              );
            })}
            {highlightedCategory && (
              <button
                onClick={() => setHighlightedCategory(null)}
                className="px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-black text-white/40 uppercase tracking-wider hover:text-white/70 hover:border-white/20 transition-all"
              >
                Все
              </button>
            )}
          </div>
        );

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* By Lifecycle */}
            <div className="glass-card rounded-[2.5rem] border border-white/10 overflow-hidden glass-surface p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black text-white">Категории по жизненному циклу</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Ср. обращений на линию • Относительные месяцы</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                    <Activity className="w-5 h-5 text-indigo-500" />
                  </div>
                  <ZoomControls />
                </div>
              </div>
              {legend}
              {lifecycleMonths.length > 0 ? (
                <div 
                  className="relative h-[280px] w-full cursor-grab overflow-hidden"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 800 300">
                    <g transform={`translate(${pan}, 0) scale(${zoom}, 1)`}>
                      {lifecycleCategories.map((cat, ci) => {
                        const pts = buildLifecyclePoints(cat);
                        const color = CATEGORY_COLORS[allCats.indexOf(cat) % CATEGORY_COLORS.length];
                        const polyStr = pts.map(p => `${p.x},${p.y}`).join(' ');
                        return (
                          <g key={cat}>
                            <polyline
                              points={polyStr}
                              fill="none"
                              stroke={color}
                              strokeWidth={isActive(cat) ? 3 / zoom : 1.5 / zoom}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeOpacity={isActive(cat) ? 0.9 : 0.15}
                            />
                            {pts.map((p, pi) => (
                              <g key={pi} className="group/catpoint" style={{ opacity: isActive(cat) ? 1 : 0.15 }}>
                                <circle cx={p.x} cy={p.y} r={(isActive(cat) ? 3.5 : 2) / zoom} fill={color} />
                                <text
                                  x={p.x} y={p.y - (14 / zoom)}
                                  textAnchor="middle"
                                  className="fill-white font-black opacity-0 group-hover/catpoint:opacity-100 transition-opacity pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                                  style={{ fontSize: `${12/zoom}px` }}
                                >
                                  {p.val}
                                </text>
                              </g>
                            ))}
                          </g>
                        );
                      })}
                      {/* X-Axis labels */}
                      {lifecycleMonths.map((m, i) => {
                        const padding = 60;
                        const stepX = (800 - padding * 2) / Math.max(lifecycleMonths.length - 1, 1);
                        const x = padding + i * stepX;
                        // Show every label if <=12, every other if more
                        if (lifecycleMonths.length > 12 && i % 2 !== 0 && i !== lifecycleMonths.length - 1) return null;
                        return (
                          <text key={m} x={x} y={268} textAnchor="middle" className="fill-slate-500 font-bold uppercase" style={{ fontSize: `${10/zoom}px` }}>
                            M{m}
                          </text>
                        );
                      })}
                    </g>
                    {/* Y-Axis grid */}
                    {[0, 0.5, 1].map(p => {
                      const y = 60 + p * 180;
                      const val = (lifecycleMax * (1 - p)).toFixed(1);
                      return (
                        <g key={p}>
                          <line x1="60" y1={y} x2="740" y2={y} stroke="white" strokeOpacity="0.05" strokeDasharray="4 4" />
                          <text x="50" y={y + 4} textAnchor="end" className="text-[11px] fill-slate-500 font-black">{val}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="text-center py-16 text-white/20 text-xs font-black uppercase tracking-widest">Нет данных</div>
              )}
            </div>

            {/* By Calendar */}
            <div className="glass-card rounded-[2.5rem] border border-white/10 overflow-hidden glass-surface p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black text-white">Категории по календарю</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Абсолютное кол-во • Календарные месяцы</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-amber-500" />
                  </div>
                  <ZoomControls />
                </div>
              </div>
              {legend}
              {calendarMonths.length > 0 ? (
                <div 
                  className="relative h-[280px] w-full cursor-grab overflow-hidden"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 800 300">
                    <g transform={`translate(${pan}, 0) scale(${zoom}, 1)`}>
                      {calendarCategories.map((cat, ci) => {
                        const pts = buildCalendarPoints(cat);
                        const color = CATEGORY_COLORS[allCats.indexOf(cat) % CATEGORY_COLORS.length];
                        const polyStr = pts.map(p => `${p.x},${p.y}`).join(' ');
                        return (
                          <g key={cat}>
                            <polyline
                              points={polyStr}
                              fill="none"
                              stroke={color}
                              strokeWidth={isActive(cat) ? 3 / zoom : 1.5 / zoom}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeOpacity={isActive(cat) ? 0.9 : 0.15}
                            />
                            {pts.map((p, pi) => (
                              <g key={pi} className="group/calpoint" style={{ opacity: isActive(cat) ? 1 : 0.15 }}>
                                <circle cx={p.x} cy={p.y} r={(isActive(cat) ? 3.5 : 2) / zoom} fill={color} />
                                <text
                                  x={p.x} y={p.y - (14 / zoom)}
                                  textAnchor="middle"
                                  className="fill-white font-black opacity-0 group-hover/calpoint:opacity-100 transition-opacity pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                                  style={{ fontSize: `${12/zoom}px` }}
                                >
                                  {p.val}
                                </text>
                              </g>
                            ))}
                          </g>
                        );
                      })}
                      {/* X-Axis labels */}
                      {calendarMonths.map((m, i) => {
                        const padding = 60;
                        const stepX = (800 - padding * 2) / Math.max(calendarMonths.length - 1, 1);
                        const x = padding + i * stepX;
                        if (calendarMonths.length > 12 && i % 2 !== 0 && i !== calendarMonths.length - 1) return null;
                        return (
                          <text key={m} x={x} y={268} textAnchor="middle" className="fill-slate-500 font-bold" style={{ fontSize: `${9/zoom}px` }}>
                            {formatCalMonth(m)}
                          </text>
                        );
                      })}
                    </g>
                    {/* Y-Axis grid */}
                    {[0, 0.5, 1].map(p => {
                      const y = 60 + p * 180;
                      const val = Math.round(calendarMax * (1 - p));
                      return (
                        <g key={p}>
                          <line x1="60" y1={y} x2="740" y2={y} stroke="white" strokeOpacity="0.05" strokeDasharray="4 4" />
                          <text x="50" y={y + 4} textAnchor="end" className="text-[11px] fill-slate-500 font-black">{val}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="text-center py-16 text-white/20 text-xs font-black uppercase tracking-widest">Нет данных</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Stats Table */}
      <div className="glass-card rounded-[2.5rem] border border-white/10 overflow-hidden glass-surface">
        <div className="p-8 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Производственные линии</h2>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Подробная статистика по эффективности</p>
          </div>
          <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/10">
            <button onClick={() => setFilterMinMonths(0)} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${filterMinMonths === 0 ? 'bg-[#FF5B00] text-white' : 'text-white/40 hover:text-white'}`}>Все</button>
            <button onClick={() => setFilterMinMonths(3)} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${filterMinMonths === 3 ? 'bg-[#FF5B00] text-white' : 'text-white/40 hover:text-white'}`}>3+ мес</button>
            <button onClick={() => setFilterMinMonths(6)} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${filterMinMonths === 6 ? 'bg-[#FF5B00] text-white' : 'text-white/40 hover:text-white'}`}>6+ мес</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                <th className="px-8 py-4">Клиент / Линия</th>
                <th className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1" title="Количество обращений в первый месяц">
                    M1 <HelpCircle className="w-2.5 h-2.5 opacity-40" />
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1" title="Среднее время от открытия до закрытия обращения (календарные часы). Включает время ожидания ответа клиента или запчастей.">
                    MTTR <HelpCircle className="w-2.5 h-2.5 opacity-40" />
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1" title="Чистое время активной работы инженеров (человеко-часы). Не включает время, когда обращение было 'На паузе' или в статусе 'В ожидании'.">
                    Затраты <HelpCircle className="w-2.5 h-2.5 opacity-40" />
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1" title="Количество эскалаций на 3-ю линию (Разработка/Инжиниринг)">
                    L3 <HelpCircle className="w-2.5 h-2.5 opacity-40" />
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1" title="Оценка адаптации персонала к линии">
                    Статус <HelpCircle className="w-2.5 h-2.5 opacity-40" />
                  </div>
                </th>
                <th className="px-8 py-4 text-right">Тренд</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {groupedData.map(group => (
                <React.Fragment key={group.client_id}>
                  {/* Client Row (Aggregated) */}
                  <tr
                    onClick={() => toggleClient(group.client_id)}
                    className="group bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-1 rounded-lg bg-white/5 transition-transform ${expandedClients.has(group.client_id) ? 'rotate-180' : ''}`}>
                          <ChevronDown className="w-4 h-4 text-white/40" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-lg text-white group-hover:text-[#FF5B00] transition-colors">{group.client_name}</span>
                          <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">{group.lines.length} линий в работе</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className="font-black text-white/50 text-base">{group.agg.first_month_tickets}</span>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className="font-black text-white/50 text-sm">{group.agg.avg_resolution_hours.toFixed(1)}ч</span>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className="font-black text-white/50 text-sm">{(group.agg.total_effort_mins / 60).toFixed(1)}ч</span>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className="font-black text-white/50 text-sm">{group.agg.l3_escalations}</span>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className="text-[10px] font-black text-white/20 uppercase">Агрегировано</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 text-white/40">
                        {expandedClients.has(group.client_id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </td>
                  </tr>

                  {/* Line Rows (Drill-down) */}
                  {expandedClients.has(group.client_id) && group.lines.map(line => (
                    <tr key={line.line_id} className="bg-black/20 hover:bg-white/5 transition-colors animate-in slide-in-from-top-2 duration-300">
                      <td className="px-16 py-4">
                        <div className="flex items-center gap-3">
                          <Factory className="w-3.5 h-3.5 text-white/20" />
                          <div className="flex flex-col">
                            <span className="font-bold text-white/80">{line.line_name}</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">{new Date(line.start_date).toLocaleDateString('ru-RU')} • {line.months_since_start} мес</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-bold text-white/30">{line.first_month_tickets}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-bold text-white/60">{line.avg_resolution_hours.toFixed(1)}ч</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-black text-white/60">{(line.total_effort_mins / 60).toFixed(1)}ч</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-black text-white/60">{line.l3_escalations}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {line.subsequent_avg < (line.first_month_tickets / 3) ? (
                          <span
                            className="flex items-center justify-center gap-1 text-[9px] font-black text-emerald-500 uppercase cursor-help"
                            title="Нагрузка снизилась более чем в 3 раза по сравнению с первым месяцем"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Обучен
                          </span>
                        ) : line.subsequent_avg > line.first_month_tickets && line.first_month_tickets > 0 ? (
                          <span
                            className="flex items-center justify-center gap-1 text-[9px] font-black text-red-500 uppercase cursor-help"
                            title="Нагрузка на техподдержку сейчас выше, чем была в первый месяц внедрения"
                          >
                            <AlertCircle className="w-3 h-3" /> Проблемный
                          </span>
                        ) : (
                          <span
                            className="flex items-center justify-center gap-1 text-[9px] font-black text-amber-500 uppercase cursor-help"
                            title="Процесс обучения персонала продолжается, спрос на поддержку умеренный"
                          >
                            <Activity className="w-3 h-3" /> Адаптация
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {line.last_30d_tickets < line.subsequent_avg ? (
                            <span className="cursor-help" title="Активность за последние 30 дней ниже среднего исторического уровня">
                              <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                            </span>
                          ) : line.last_30d_tickets > line.subsequent_avg + 1 ? (
                            <span className="cursor-help" title="Всплеск активности: за последние 30 дней обращений больше обычного">
                              <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                            </span>
                          ) : (
                            <span className="cursor-help" title="Активность за последние 30 дней соответствует среднему уровню">
                              <Minus className="w-3.5 h-3.5 text-slate-500" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {groupedData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-24 text-center text-slate-500 font-bold uppercase tracking-widest opacity-20">Данные отсутствуют</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drilldown Modal */}
      {selectedMonth !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#FF5B00]/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-[#FF5B00]" />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Детализация: Месяц {selectedMonth}</h2>
                </div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Все обращения данного периода жизненного цикла</p>
              </div>
              <button 
                onClick={() => setSelectedMonth(null)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isDrilldownLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-[#FF5B00]/20 border-t-[#FF5B00] rounded-full animate-spin" />
                    <p className="text-white/30 font-black uppercase tracking-widest text-[10px]">Загрузка обращений...</p>
                  </div>
              ) : drilldownTickets.length > 0 ? (
                <div className="space-y-4">
                  {drilldownTickets.map((ticket, i) => (
                    <div key={i} className="glass-card p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all bg-white/[0.01]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex flex-col">
                          <span className="text-lg font-black text-white group-hover:text-[#FF5B00]">{ticket.client_name}</span>
                          <span className="text-[10px] text-[#FF5B00] font-black uppercase tracking-widest">{ticket.line_name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-white/40 uppercase border border-white/5">
                            {ticket.category_name}
                          </span>
                          <span className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-white/40 uppercase border border-white/5">
                            {new Date(ticket.reported_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                        <p className="text-white/80 text-sm leading-relaxed italic">{ticket.problem_description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <AlertCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/30 font-bold uppercase tracking-widest text-xs">Нет данных за этот период</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostImplementationAnalytics;
