
import React from 'react';

interface Props {
    ppm: number;
}

const ModuleVisualizer: React.FC<Props> = ({ ppm }) => {
    const displayScale = 30; // pixels in UI per "camera pixel"
    const moduleSizeInDisplay = ppm * displayScale;

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 mb-6 uppercase tracking-widest text-center">Визуализация модуля (Pixel Grid)</h3>

            <div className="relative overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner"
                style={{ width: '300px', height: '300px', background: 'var(--grid-bg)' }}>

                {/* Draw Pixel Grid */}
                <div className="absolute inset-0 opacity-40 dark:opacity-20" style={{
                    backgroundImage: `linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)`,
                    backgroundSize: `${displayScale}px ${displayScale}px`
                }}></div>

                {/* Draw the DataMatrix Module Overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500/20 dark:bg-blue-400/20 border-2 border-blue-600 dark:border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center justify-center transition-all duration-300"
                    style={{
                        width: `${moduleSizeInDisplay}px`,
                        height: `${moduleSizeInDisplay}px`,
                    }}>
                    <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 bg-white/90 dark:bg-slate-800/90 px-1.5 py-0.5 rounded shadow-sm">
                        {ppm.toFixed(2)} px
                    </span>
                </div>
            </div>

            <div className="mt-6 text-[11px] text-slate-500 dark:text-slate-400 text-center max-w-[260px] leading-relaxed">
                <p className="mb-2"><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span><b>Синяя область</b> — это один модуль кода.</p>
                <p><span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span><b>Сетка</b> — это пиксели матрицы. <br /> Для стабильности нужно 3-5 пикселей.</p>
            </div>
        </div>
    );
};

export default ModuleVisualizer;
