import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SupportTicket } from '../types';

interface TicketTrendChartProps {
    tickets: SupportTicket[];
}

const TicketTrendChart = ({ tickets }: TicketTrendChartProps) => {
    const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
    const [baseDate, setBaseDate] = useState(new Date());

    const ticketDates = tickets.map(t => new Date(t.reported_at || t.created_at));

    let labels: string[] = [];
    let values: number[] = [];
    let periodLabel = '';

    if (period === 'week') {
        const startOfWeek = new Date(baseDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        periodLabel = `${startOfWeek.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${endOfWeek.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;

        labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        values = Array(7).fill(0);

        ticketDates.forEach(d => {
            if (d >= startOfWeek && d <= endOfWeek) {
                let wd = d.getDay() - 1;
                if (wd < 0) wd = 6;
                values[wd]++;
            }
        });
    } else if (period === 'month') {
        const startOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const endOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
        
        periodLabel = startOfMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        periodLabel = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

        const daysInMonth = endOfMonth.getDate();
        labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
        values = Array(daysInMonth).fill(0);

        ticketDates.forEach(d => {
            if (d >= startOfMonth && d <= endOfMonth) {
                values[d.getDate() - 1]++;
            }
        });
    } else {
        const startOfYear = new Date(baseDate.getFullYear(), 0, 1);
        const endOfYear = new Date(baseDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        periodLabel = `${baseDate.getFullYear()} год`;

        labels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        values = Array(12).fill(0);

        ticketDates.forEach(d => {
            if (d >= startOfYear && d <= endOfYear) {
                values[d.getMonth()]++;
            }
        });
    }

    const navigateTime = (dir: number) => {
        const newDate = new Date(baseDate);
        if (period === 'week') newDate.setDate(newDate.getDate() + dir * 7);
        else if (period === 'month') newDate.setMonth(newDate.getMonth() + dir);
        else newDate.setFullYear(newDate.getFullYear() + dir);
        setBaseDate(newDate);
    };

    const maxVal = Math.max(...values, 5);
    const width = 800;
    const height = 220;
    const paddingX = 40;
    const paddingY = 40;
    const paddingBottom = 40;
    const chartW = width - paddingX * 2;
    const chartH = height - paddingY - paddingBottom;
    const stepX = chartW / Math.max(labels.length, 1);
    const barWidth = Math.max(Math.min((chartW / labels.length) - 8, 30), 8);

    return (
        <div className="glass-card p-4 md:p-6 rounded-[2rem] border border-white/10 mb-4 bg-slate-900/40 animate-in slide-in-from-top-2 duration-300 relative z-0 glass-surface">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-max self-center md:self-start shadow-inner">
                    {(['week', 'month', 'year'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => { setPeriod(p); setBaseDate(new Date()); }}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${period === p ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Год'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-center gap-4 bg-white/5 p-1.5 rounded-full border border-white/10">
                    <button onClick={() => navigateTime(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white glass-button">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="font-bold text-white min-w-[160px] text-center tracking-tight">
                        {periodLabel}
                    </div>
                    <button onClick={() => navigateTime(1)} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white glass-button">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px] h-56 drop-shadow-xl overflow-visible">
                    {[0, 0.5, 1].map(ratio => {
                        const y = paddingY + chartH - chartH * ratio;
                        return (
                            <g key={ratio}>
                                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" className="text-white/10" strokeDasharray="4 4" />
                                <text x={paddingX - 10} y={y + 4} className="text-[10px] font-bold fill-white/40" textAnchor="end">
                                    {Math.round(maxVal * ratio)}
                                </text>
                            </g>
                        );
                    })}

                    {values.map((v, i) => {
                        const h = (v / maxVal) * chartH;
                        const xOffset = stepX / 2; 
                        const x = paddingX + i * stepX + xOffset - barWidth / 2;
                        const y = paddingY + chartH - h;

                        return (
                            <g key={i} className="group relative transition-all duration-300">
                                <rect x={x - 10} y={paddingY} width={barWidth + 20} height={chartH} fill="transparent" />
                                <rect x={x} y={y} width={barWidth} height={h} rx="4" style={{ fill: 'var(--primary)' }} className="opacity-60 group-hover:opacity-100 transition-all duration-300 drop-shadow-[0_0_8px_rgba(255,91,0,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(255,91,0,0.6)]" />
                                <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="text-[12px] font-black fill-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    {v > 0 ? v : ''}
                                </text>
                                <text x={x + barWidth / 2} y={height - 20} textAnchor="middle" className={`text-[10px] font-bold transition-colors ${period === 'month' && i % 2 !== 0 && labels.length > 20 ? 'fill-transparent md:fill-white/30' : 'fill-white/50'} group-hover:fill-white`}>
                                    {labels[i]}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};

export default React.memo(TicketTrendChart);
