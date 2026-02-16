import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Ruler, Focus, Maximize, AlertCircle, Cpu, CheckCircle2, Zap, Box, Link, Calculator, Check, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { CameraParams, CalculationResult, CameraPreset } from '../types';
import ModuleVisualizer from './ModuleVisualizer';
import { api } from '../services/api';

const PpmCalculator: React.FC = () => {
  const [params, setParams] = useState<CameraParams>({
    resolutionWidth: 3072,
    resolutionHeight: 2048,
    fovWidth: 400,
    fovHeight: 300,
    pixelSizeUm: 2.4,
    distanceMm: 730,
    moduleSizeMm: 0.375,
    lensFocalLengthMm: 8.5
  });

  const [presets, setPresets] = useState<CameraPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [results, setResults] = useState<(CalculationResult & { opticalFovW: number, discrepancy: number, reliabilityStatus: 'low' | 'acceptable' | 'stable' }) | null>(null);

  // Module size calculator
  const [calcTotalSize, setCalcTotalSize] = useState(10);
  const [calcModuleCount, setCalcModuleCount] = useState(20);
  const [calculatedModuleSize, setCalculatedModuleSize] = useState(0.5);

  // Preset management
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CameraPreset | null>(null);
  const [presetForm, setPresetForm] = useState({
    name: '',
    resolution_width: 0,
    resolution_height: 0,
    pixel_size_um: 0,
    has_built_in_lens: false,
    lens_focal_length_mm: null as number | null
  });

  useEffect(() => {
    loadPresets();
  }, []);

  useEffect(() => {
    if (calcModuleCount > 0) {
      setCalculatedModuleSize(calcTotalSize / calcModuleCount);
    }
  }, [calcTotalSize, calcModuleCount]);

  const loadPresets = async () => {
    try {
      const data = await api.getCameraPresets();
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  const handlePresetSelect = (preset: CameraPreset) => {
    setSelectedPresetId(preset.id);
    setParams(prev => ({
      ...prev,
      resolutionWidth: preset.resolution_width,
      resolutionHeight: preset.resolution_height,
      pixelSizeUm: preset.pixel_size_um,
      lensFocalLengthMm: preset.lens_focal_length_mm ?? prev.lensFocalLengthMm
    }));
  };

  const calculate = useCallback(() => {
    const { resolutionWidth, resolutionHeight, fovWidth, fovHeight, pixelSizeUm, moduleSizeMm, distanceMm, lensFocalLengthMm } = params;

    // Validation
    if (fovWidth <= 0 || fovHeight <= 0 || moduleSizeMm <= 0 ||
      resolutionWidth <= 0 || resolutionHeight <= 0 ||
      pixelSizeUm <= 0 || distanceMm <= 0 || lensFocalLengthMm <= 0 ||
      distanceMm <= lensFocalLengthMm) {
      setResults(null);
      return;
    }

    // Physics calculations
    const sensorWidthMm = (resolutionWidth * pixelSizeUm) / 1000;
    const sensorHeightMm = (resolutionHeight * pixelSizeUm) / 1000;

    const opticalFovW = (sensorWidthMm * distanceMm) / lensFocalLengthMm;

    const pixelsPerMmW = resolutionWidth / fovWidth;
    const pixelsPerMmH = resolutionHeight / fovHeight;

    const ppmW = pixelsPerMmW * moduleSizeMm;
    const ppmH = pixelsPerMmH * moduleSizeMm;
    const ppm = Math.min(ppmW, ppmH);

    const magnification = sensorWidthMm / fovWidth;

    const discrepancy = opticalFovW > 0 ? Math.abs(fovWidth - opticalFovW) / opticalFovW : 0;

    let reliabilityStatus: 'low' | 'acceptable' | 'stable' = 'low';
    let statusMessage = 'Внимание: Низкая надежность (PPM < 2.5).';

    if (ppm >= 3) {
      reliabilityStatus = 'stable';
      statusMessage = 'Стабильное считывание (PPM > 3.0).';
    } else if (ppm >= 2.5) {
      reliabilityStatus = 'acceptable';
      statusMessage = 'Приемлемо (PPM 2.5–3.0). Требует качественной настройки.';
    }

    setResults({
      pixelsPerMmW,
      pixelsPerMmH,
      ppmW,
      ppmH,
      ppm,
      sensorWidthMm,
      sensorHeightMm,
      magnification,
      isReliable: reliabilityStatus !== 'low',
      reliabilityStatus,
      statusMessage,
      opticalFovW,
      discrepancy
    });
  }, [params]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  const handlePresetFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPreset) {
        await api.updateCameraPreset(editingPreset.id, presetForm);
      } else {
        await api.addCameraPreset(presetForm);
      }
      await loadPresets();
      setShowPresetForm(false);
      setEditingPreset(null);
      resetPresetForm();
    } catch (error) {
      console.error('Failed to save preset:', error);
    }
  };

  const resetPresetForm = () => {
    setPresetForm({
      name: '',
      resolution_width: 0,
      resolution_height: 0,
      pixel_size_um: 0,
      has_built_in_lens: false,
      lens_focal_length_mm: null
    });
  };

  const startEditPreset = (preset: CameraPreset) => {
    setEditingPreset(preset);
    setPresetForm({
      name: preset.name,
      resolution_width: preset.resolution_width,
      resolution_height: preset.resolution_height,
      pixel_size_um: preset.pixel_size_um,
      has_built_in_lens: preset.has_built_in_lens,
      lens_focal_length_mm: preset.lens_focal_length_mm
    });
    setShowPresetForm(true);
  };

  const deletePreset = async (id: number) => {
    if (confirm('Удалить этот пресет?')) {
      try {
        await api.deleteCameraPreset(id);
        await loadPresets();
      } catch (error) {
        console.error('Failed to delete preset:', error);
      }
    }
  };

  const applyOpticalFov = () => {
    if (results) {
      const aspectRatio = params.resolutionWidth / params.resolutionHeight;
      setParams(prev => ({
        ...prev,
        fovWidth: results.opticalFovW,
        fovHeight: results.opticalFovW / aspectRatio
      }));
    }
  };

  const applyCalculatedModuleSize = () => {
    setParams(prev => ({ ...prev, moduleSizeMm: calculatedModuleSize }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Calculator className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">PPM Калькулятор</h1>
              <p className="text-slate-300">Расчет пикселей на модуль DataMatrix для камер</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Parameters Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Camera Presets */}
            <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Пресеты камер
                </h2>
                <button
                  onClick={() => setShowPresetForm(true)}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedPresetId === null && (
                  <div className="p-4 rounded-xl border bg-blue-500/20 border-blue-400/50">
                    <h3 className="font-medium text-white">Пользовательская камера</h3>
                    <p className="text-sm text-slate-300">Ручные настройки</p>
                  </div>
                )}
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedPresetId === preset.id
                        ? 'bg-blue-500/20 border-blue-400/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                    onClick={() => handlePresetSelect(preset)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-white">{preset.name}</h3>
                        <p className="text-sm text-slate-300">
                          {preset.resolution_width}×{preset.resolution_height}, {preset.pixel_size_um}μm
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditPreset(preset); }}
                          className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Parameters Form */}
            <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Ruler className="w-5 h-5" />
                Параметры расчета
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Разрешение камеры
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        value={params.resolutionWidth}
                        onChange={(e) => { setSelectedPresetId(null); setParams(prev => ({ ...prev, resolutionWidth: Number(e.target.value) })) }}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ширина"
                      />
                      <input
                        type="number"
                        value={params.resolutionHeight}
                        onChange={(e) => { setSelectedPresetId(null); setParams(prev => ({ ...prev, resolutionHeight: Number(e.target.value) })) }}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Высота"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Размер пикселя (μm)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={params.pixelSizeUm}
                      onChange={(e) => { const val = parseFloat(e.target.value); setSelectedPresetId(null); setParams(prev => ({ ...prev, pixelSizeUm: isNaN(val) ? 0 : Math.round(val * 1000) / 1000 })) }}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Фокусное расстояние объектива (мм)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={params.lensFocalLengthMm}
                      onChange={(e) => { const val = parseFloat(e.target.value); setSelectedPresetId(null); setParams(prev => ({ ...prev, lensFocalLengthMm: isNaN(val) ? 0 : Math.round(val * 1000) / 1000 })) }}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Поле зрения (мм)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={params.fovWidth}
                        onChange={(e) => { const val = parseFloat(e.target.value); setParams(prev => ({ ...prev, fovWidth: isNaN(val) ? 0 : Math.round(val * 1000) / 1000 })) }}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ширина"
                      />
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={params.fovHeight}
                        onChange={(e) => { const val = parseFloat(e.target.value); setParams(prev => ({ ...prev, fovHeight: isNaN(val) ? 0 : Math.round(val * 1000) / 1000 })) }}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Высота"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Расстояние до объекта (мм)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={params.distanceMm}
                      onChange={(e) => { const val = parseFloat(e.target.value); setParams(prev => ({ ...prev, distanceMm: isNaN(val) ? 0 : Math.round(val * 1000) / 1000 })) }}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Размер модуля DataMatrix (мм)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={params.moduleSizeMm}
                      onChange={(e) => { const val = parseFloat(e.target.value); setParams(prev => ({ ...prev, moduleSizeMm: isNaN(val) ? 0 : Math.round(val * 1000) / 1000 })) }}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Module Size Calculator */}
              <div className="mt-6 p-4 bg-white/5 rounded-lg">
                <h3 className="text-lg font-medium text-white mb-4">Калькулятор размера модуля</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Общий размер кода (мм)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={calcTotalSize}
                      onChange={(e) => { const val = parseFloat(e.target.value); setCalcTotalSize(isNaN(val) ? 0 : Math.round(val * 1000) / 1000) }}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Количество модулей
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={calcModuleCount}
                      onChange={(e) => setCalcModuleCount(Number(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Рассчитанный размер модуля (мм)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={calculatedModuleSize.toFixed(3)}
                      readOnly
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={applyCalculatedModuleSize}
                    className="px-6 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                  >
                    Применить
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {results && (
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 shadow-2xl">
                <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Результаты расчета
                </h2>

                <div className="space-y-4">
                  <div className="text-center p-4 bg-white/5 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400">{results.ppm.toFixed(3)}</div>
                    <div className="text-sm text-slate-300">PPM</div>
                  </div>

                  <div className={`p-4 rounded-lg border ${
                    results.reliabilityStatus === 'stable' ? 'bg-green-500/20 border-green-400/50' :
                    results.reliabilityStatus === 'acceptable' ? 'bg-yellow-500/20 border-yellow-400/50' :
                    'bg-red-500/20 border-red-400/50'
                  }`}>
                    <div className="flex items-center gap-2">
                      {results.reliabilityStatus === 'stable' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> :
                       results.reliabilityStatus === 'acceptable' ? <AlertCircle className="w-5 h-5 text-yellow-400" /> :
                       <X className="w-5 h-5 text-red-400" />}
                      <span className="font-medium text-white">{results.statusMessage}</span>
                    </div>
                  </div>

                  {results.discrepancy > 0.05 && (
                    <button
                      onClick={applyOpticalFov}
                      className="w-full px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Синхронизировать FOV с оптикой
                    </button>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Размер сенсора:</span>
                      <span className="text-white">{results.sensorWidthMm.toFixed(3)} × {results.sensorHeightMm.toFixed(3)} мм</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Увеличение:</span>
                      <span className="text-white">{results.magnification.toFixed(3)}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Оптическое FOV:</span>
                      <span className="text-white">{results.opticalFovW.toFixed(3)} мм</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Несоответствие:</span>
                      <span className="text-white">{(results.discrepancy * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {results && (
              <ModuleVisualizer ppm={results.ppm} />
            )}
          </div>
        </div>

        {/* Preset Form Modal */}
        {showPresetForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-2xl border border-white/20 p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-white mb-4">
                {editingPreset ? 'Редактировать пресет' : 'Новый пресет камеры'}
              </h3>

              <form onSubmit={handlePresetFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Название</label>
                  <input
                    type="text"
                    value={presetForm.name}
                    onChange={(e) => setPresetForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Разрешение Ширина</label>
                    <input
                      type="number"
                      value={presetForm.resolution_width}
                      onChange={(e) => setPresetForm(prev => ({ ...prev, resolution_width: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Высота</label>
                    <input
                      type="number"
                      value={presetForm.resolution_height}
                      onChange={(e) => setPresetForm(prev => ({ ...prev, resolution_height: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Размер пикселя (μm)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={presetForm.pixel_size_um}
                    onChange={(e) => setPresetForm(prev => ({ ...prev, pixel_size_um: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="hasBuiltInLens"
                    checked={presetForm.has_built_in_lens}
                    onChange={(e) => setPresetForm(prev => ({ ...prev, has_built_in_lens: e.target.checked }))}
                    className="rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                  />
                  <label htmlFor="hasBuiltInLens" className="text-sm text-slate-300">Встроенный объектив</label>
                </div>

                {presetForm.has_built_in_lens && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Фокусное расстояние (мм)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={presetForm.lens_focal_length_mm || ''}
                      onChange={(e) => setPresetForm(prev => ({ ...prev, lens_focal_length_mm: parseFloat(e.target.value) || null }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingPreset ? 'Сохранить' : 'Создать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPresetForm(false); setEditingPreset(null); resetPresetForm(); }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PpmCalculator;