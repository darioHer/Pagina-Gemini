import React, { useState, useEffect } from 'react';
import { 
  Bot, Cpu, Sparkles, BookOpen, ShieldCheck, Clock, RefreshCw, 
  FileText, CheckCircle2, AlertTriangle, Eye, Scale, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { generateGroqDraftResponse, fetchBorradoresRespuestasHistory, fetchSystemAIConfig } from '../services/supabaseService';
import type { DraftStatus, BorradorRespuestaRecord, OcrExtractionResult, SystemAIConfig } from '../types/radicacion';

export const GroqDraftGeneratorModule: React.FC = () => {
  const { user } = useAuth();
  const [aiConfig, setAiConfig] = useState<SystemAIConfig | null>(null);

  // Form input state
  const [radicadoInput, setRadicadoInput] = useState<string>('RAD-2026-004821');
  const [remitenteInput, setRemitenteInput] = useState<string>('María Fernanda Gómez');
  const [asuntoInput, setAsuntoInput] = useState<string>('Reporte de fuga de agua potable en vía pública');
  const [peticionInput, setPeticionInput] = useState<string>(
    'Por medio del presente solicito la reparación urgente de una fuga de agua sobre la tubería principal en la calle 15 con carrera 8. El flujo continuo lleva más de 12 horas afectando el suministro del barrio.'
  );

  // Process & status state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<DraftStatus | null>(null);
  const [generatedDraftText, setGeneratedDraftText] = useState<string | null>(null);
  const [citedNormatives, setCitedNormatives] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // History state
  const [history, setHistory] = useState<BorradorRespuestaRecord[]>([]);
  const [selectedDraftModal, setSelectedDraftModal] = useState<BorradorRespuestaRecord | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const [cfg, drafts] = await Promise.all([
      fetchSystemAIConfig(),
      fetchBorradoresRespuestasHistory()
    ]);
    setAiConfig(cfg);
    setHistory(drafts);
  };

  const handleGenerateDraftSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing(true);
    setErrorMessage(null);
    setGeneratedDraftText(null);
    setCitedNormatives([]);

    // Estado 1: CONSULTANDO_NORMATIVA
    setCurrentStatus('CONSULTANDO_NORMATIVA');

    await new Promise(r => setTimeout(r, 600));

    const peticionData: OcrExtractionResult = {
      radicado: radicadoInput.trim(),
      fecha: new Date().toISOString().split('T')[0],
      entidad: 'Alcaldía Municipal',
      remitente: remitenteInput.trim(),
      destinatario: 'Despacho de Atención Ciudadana',
      asunto: asuntoInput.trim(),
      peticion: peticionInput.trim(),
      normas_mencionadas: [],
      texto_extraido: peticionInput.trim()
    };

    try {
      const res = await generateGroqDraftResponse(peticionData, radicadoInput, user);

      if (res.estado === 'BORRADOR_ERROR' || res.error) {
        setErrorMessage(res.error || 'Error al generar el borrador mediante Groq.');
        setCurrentStatus(null);
      } else {
        setCurrentStatus('BORRADOR_GENERADO');
        setGeneratedDraftText(res.respuesta_borrador || null);
        setCitedNormatives(res.normativa_utilizada || []);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error inesperado en el servicio RAG Groq.');
      setCurrentStatus(null);
    } finally {
      setIsProcessing(false);
      loadAllData();
    }
  };

  // Preset Scenario Handlers
  const applyPresetScenario = (scenario: 'agua' | 'basura' | 'alumbrado' | 'sin_norma') => {
    if (scenario === 'agua') {
      setRadicadoInput(`RAD-${Date.now().toString().slice(-6)}`);
      setRemitenteInput('Carlos Eduardo Mendoza');
      setAsuntoInput('Reporte de suspensión no programada y fuga de agua potable');
      setPeticionInput('Solicito la intervención urgente de la cuadrilla técnica por una fuga en la red principal de agua potable que lleva más de 24 horas desbordándose.');
    } else if (scenario === 'basura') {
      setRadicadoInput(`RAD-${Date.now().toString().slice(-6)}`);
      setRemitenteInput('Junta de Acción Comunal Barrio Centro');
      setAsuntoInput('Acumulación inusual de escombros en esquina pública');
      setPeticionInput('Solicitamos operativo especial de limpia pública por acumulación prohibida de escombros y muebles abandonados en la esquina del parque principal.');
    } else if (scenario === 'alumbrado') {
      setRadicadoInput(`RAD-${Date.now().toString().slice(-6)}`);
      setRemitenteInput('Lucía Ramírez');
      setAsuntoInput('Luminaria apagada e inclinación de poste en vía principal');
      setPeticionInput('Reporto luminaria LED apagada e inclinación peligrosa del poste en la avenida central que representa riesgo a peatones.');
    } else {
      // Scenario with insufficient normatives
      setRadicadoInput(`RAD-${Date.now().toString().slice(-6)}`);
      setRemitenteInput('Empresa Aeroespacial de Innovación');
      setAsuntoInput('Solicitud de permiso para lanzamiento de cohetes espaciales comerciales');
      setPeticionInput('Por medio del presente solicitamos la autorización municipal para instalar una plataforma de despegue de cohetes suborbitales en la plaza de mercado.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-xl p-6 text-white shadow-xl border border-purple-800/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> FASE 5: GROQ RAG & GENERACIÓN DE BORRADORES
              </span>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-md border border-amber-500/30 font-medium">
                Estado Estricto BORRADOR (Sin auto-aprobar)
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Motor de Generación Jurídica Groq RAG</h2>
            <p className="text-purple-200/80 text-sm mt-1 max-w-3xl">
              Groq redacta borradores institucionales consultando exclusivamente las normativas recuperadas de Supabase. Posee reglas anti-alucinación estrictas: si la normativa no es suficiente, lo declara expresamente.
            </p>
          </div>
          <button
            onClick={loadAllData}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium flex items-center gap-2 backdrop-blur-sm transition"
          >
            <RefreshCw className="w-4 h-4" /> Recargar Datos
          </button>
        </div>
      </div>

      {/* Preset Test Scenarios Bar */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-purple-400" /> Cargar Escenarios de Prueba Normativa (RAG)
          </span>
          <span className="text-xs text-slate-400">Modelo Activo: {aiConfig?.groqModel || 'llama-3.3-70b-versatile'}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => applyPresetScenario('agua')}
            disabled={isProcessing}
            className="px-3 py-2.5 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-700/50 text-blue-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> 1. Agua (Acuerdo 112)
          </button>
          <button
            onClick={() => applyPresetScenario('basura')}
            disabled={isProcessing}
            className="px-3 py-2.5 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> 2. Basuras (Resolución 089)
          </button>
          <button
            onClick={() => applyPresetScenario('alumbrado')}
            disabled={isProcessing}
            className="px-3 py-2.5 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/50 text-amber-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> 3. Alumbrado (Decreto 204)
          </button>
          <button
            onClick={() => applyPresetScenario('sin_norma')}
            disabled={isProcessing}
            className="px-3 py-2.5 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-700/50 text-rose-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" /> 4. Sin Normativa Suficiente
          </button>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-md">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" /> Petición Entrada (Post OCR Gemini)
            </h3>

            <form onSubmit={handleGenerateDraftSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Número de Radicado</label>
                <input
                  type="text"
                  value={radicadoInput}
                  onChange={(e) => setRadicadoInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Remitente</label>
                <input
                  type="text"
                  value={remitenteInput}
                  onChange={(e) => setRemitenteInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Asunto de la Petición</label>
                <input
                  type="text"
                  value={asuntoInput}
                  onChange={(e) => setAsuntoInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Transcripción de la Solicitud / Petición</label>
                <textarea
                  rows={4}
                  value={peticionInput}
                  onChange={(e) => setPeticionInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 leading-relaxed"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg shadow-md transition flex items-center justify-center gap-2"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isProcessing ? 'Consultando RAG & Generando...' : 'Generar Borrador RAG con Groq'}
              </button>
            </form>

            {/* Live Progress Flow */}
            {currentStatus && (
              <div className="mt-5 p-4 rounded-xl border bg-slate-900/60 border-slate-700/80 space-y-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Estado del Proceso RAG:
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2.5 rounded text-center text-[11px] font-semibold flex items-center justify-center gap-1.5 ${
                    currentStatus === 'CONSULTANDO_NORMATIVA'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    <BookOpen className="w-3.5 h-3.5" /> 1. CONSULTANDO NORMATIVA
                  </div>

                  <div className={`p-2.5 rounded text-center text-[11px] font-semibold flex items-center justify-center gap-1.5 ${
                    currentStatus === 'BORRADOR_GENERADO'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
                      : 'bg-slate-800 text-slate-500'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 2. BORRADOR GENERADO
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/50 border border-red-700/60 rounded-lg text-red-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-200">Error en Generación Groq</p>
                      <p className="mt-0.5">{errorMessage}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Generated Draft Output Column */}
        <div className="lg:col-span-7">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-md h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" /> Borrador Oficial Generado (Groq RAG)
                </h3>
                <span className="text-xs text-slate-400">Estado obligatorio: BORRADOR (Requiere revisión humana)</span>
              </div>

              {currentStatus === 'BORRADOR_GENERADO' && (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-full flex items-center gap-1">
                  📝 BORRADOR
                </span>
              )}
            </div>

            {!generatedDraftText && !isProcessing && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/30">
                <Bot className="w-10 h-10 text-slate-500 mb-2" />
                <p className="text-sm text-slate-300 font-medium">Sin borrador de respuesta generado</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Completa los datos de la petición o selecciona uno de los escenarios de prueba para consultar Supabase y redactar la respuesta con Groq.
                </p>
              </div>
            )}

            {isProcessing && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <RefreshCw className="w-10 h-10 text-purple-400 animate-spin mb-3" />
                <p className="text-sm text-purple-200 font-medium">Buscando normativas en Supabase y generando Borrador con Groq...</p>
                <p className="text-xs text-slate-400 mt-1">Aplicando restricciones anti-alucinación de contexto normativo.</p>
              </div>
            )}

            {generatedDraftText && !isProcessing && (
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Cited Normatives Badges */}
                <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-700/80">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Normativas Recuperadas desde Supabase ({citedNormatives.length})
                  </span>
                  {citedNormatives.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {citedNormatives.map((n: any, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs rounded-md font-medium">
                          ⚖️ {n.titulo} ({n.tipo_norma || 'Norma'})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-amber-300 italic text-xs flex items-center gap-1">
                      ⚠️ No se recuperaron normativas de la base de datos (Groq indicará normativa insuficiente).
                    </span>
                  )}
                </div>

                {/* Draft Document Box */}
                <div className="flex-1 bg-slate-950 p-5 rounded-xl border border-slate-800 overflow-y-auto text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap max-h-[440px] shadow-inner">
                  {generatedDraftText}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Groq Drafts Audit History Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-md">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" /> Historial de Borradores Generados (Groq)
        </h3>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No hay borradores registrados en el historial de la base de datos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 uppercase text-[11px] font-semibold text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Radicado</th>
                  <th className="py-3 px-4">Modelo Groq</th>
                  <th className="py-3 px-4">Normas Utilizadas</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-700/30 transition">
                    <td className="py-3 px-4 font-semibold text-purple-300">
                      {record.radicado_id || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{record.modelo_utilizado}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {record.normativa_utilizada && record.normativa_utilizada.length > 0 ? (
                        <span className="text-purple-300 font-medium">{record.normativa_utilizada.length} norma(s) citada(s)</span>
                      ) : (
                        <span className="text-amber-400 italic">Normativa insuficiente</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-amber-500/20 text-amber-300 border-amber-500/30">
                        {record.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(record.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedDraftModal(record)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] font-medium inline-flex items-center gap-1 transition"
                      >
                        <Eye className="w-3 h-3" /> Ver Borrador
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Draft Modal Inspection */}
      {selectedDraftModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" /> Borrador Radicado: {selectedDraftModal.radicado_id}
                </h4>
                <span className="text-xs text-amber-300 font-semibold">Estado: {selectedDraftModal.estado}</span>
              </div>
              <button
                onClick={() => setSelectedDraftModal(null)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <p><strong className="text-slate-400">Modelo Groq:</strong> {selectedDraftModal.modelo_utilizado}</p>
              <p><strong className="text-slate-400">Normativas Citadas:</strong> {selectedDraftModal.normativa_utilizada?.map(n => n.titulo).join(', ') || 'Ninguna'}</p>
            </div>

            <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-y-auto font-sans text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
              {selectedDraftModal.respuesta_borrador}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedDraftModal(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
