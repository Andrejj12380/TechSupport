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
      lensFocalLengthMm: preset.lens_focal_length_mm || prev.lensFocalLengthMm
    }));
  };

  const calculate = useCallback(() => {
    const { resolutionWidth, resolutionHeight, fovWidth, fovHeight, pixelSizeUm, moduleSizeMm, distanceMm, lensFocalLengthMm } = params;

    // Validation
    if (fovWidth <= 0 || fovHeight <= 0 || moduleSizeMm <= 0 ||
      resolutionWidth <= 0 || resolutionHeight <= 0 ||
      pixelSizeUm <= 0 || distanceMm <= 0 || lensFocalLengthMm <= 0) {
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

    const magnification = (lensFocalLengthMm * distanceMm) / (distanceMm - lensFocalLengthMm);

    const discrepancy = opticalFovW > 0 ? Math.abs(fovWidth - opticalFovW) / opticalFovW : 0;

    let reliabilityStatus: 'low' | 'acceptable' | 'stable' = 'low';
    let statusMessage = 'Низкая надёжность декодирования';

    if (ppmW >= 3 && ppmH >= 3) {
      if (ppmW >= 5 && ppmH >= 5) {
        reliabilityStatus = 'stable';
        statusMessage = 'Стабильное декодирование';
      } else {
        reliabilityStatus = 'acceptable';
        statusMessage = 'Приемлемое декодирование';
      }
    }

    setResults({
      pixelsPerMmW,
      pixelsPerMmH,
      ppmW,
      ppmH,
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
                        onChange={(e) => setParams(prev => ({ ...prev, resolutionWidth: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ширина"
                      />
                      <input
                        type="number"
                        value={params.resolutionHeight}
                        onChange={(e) => setParams(prev => ({ ...prev, resolutionHeight: Number(e.target.value) }))}
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
                      step="0.01"
                      min="0"
                      value={params.pixelSizeUm}
                      onChange={(e) => setParams(prev => ({ ...prev, pixelSizeUm: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Фокусное расстояние объектива (мм)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={params.lensFocalLengthMm}
                      onChange={(e) => setParams(prev => ({ ...prev, lensFocalLengthMm: parseFloat(e.target.value) || 0 }))}
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
                        step="0.1"
                        min="0"
                        value={params.fovWidth}
                        onChange={(e) => setParams(prev => ({ ...prev, fovWidth: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ширина"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={params.fovHeight}
                        onChange={(e) => setParams(prev => ({ ...prev, fovHeight: parseFloat(e.target.value) || 0 }))}
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
                      step="0.1"
                      min="0"
                      value={params.distanceMm}
                      onChange={(e) => setParams(prev => ({ ...prev, distanceMm: parseFloat(e.target.value) || 0 }))}
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
                      onChange={(e) => setParams(prev => ({ ...prev, moduleSizeMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-blue-400">{results.ppmW.toFixed(2)}</div>
                      <div className="text-sm text-slate-300">PPM Ширина</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-blue-400">{results.ppmH.toFixed(2)}</div>
                      <div className="text-sm text-slate-300">PPM Высота</div>
                    </div>
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

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Размер сенсора:</span>
                      <span className="text-white">{results.sensorWidthMm.toFixed(2)} × {results.sensorHeightMm.toFixed(2)} мм</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Увеличение:</span>
                      <span className="text-white">{results.magnification.toFixed(2)}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Оптическое FOV:</span>
                      <span className="text-white">{results.opticalFovW.toFixed(2)} мм</span>
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
              <ModuleVisualizer ppm={Math.min(results.ppmW, results.ppmH)} />
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