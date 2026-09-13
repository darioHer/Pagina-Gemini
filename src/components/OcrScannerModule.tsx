import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, CheckCircle2, AlertTriangle, Clock, RefreshCw, 
  FileCheck, ShieldAlert, Sparkles, FileType, Info, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { processDocumentOcr, fetchOcrDocumentsHistory } from '../services/supabaseService';
import type { OcrStatus, OcrExtractionResult, OcrDocumentRecord } from '../types/radicacion';

export const OcrScannerModule: React.FC = () => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<OcrStatus | null>(null);
  const [extractionResult, setExtractionResult] = useState<OcrExtractionResult | null>(null);
  const [extractedRawText, setExtractedRawText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'structured' | 'raw_text'>('structured');
  const [history, setHistory] = useState<OcrDocumentRecord[]>([]);
  const [selectedRecordModal, setSelectedRecordModal] = useState<OcrDocumentRecord | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const records = await fetchOcrDocumentsHistory();
    setHistory(records);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
      setExtractionResult(null);
      setExtractedRawText(null);
      setCurrentStatus(null);
    }
  };

  const executeOcrProcess = async (fileToProcess: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setExtractionResult(null);
    setExtractedRawText(null);
    
    // Status 1: RECIBIDO
    setCurrentStatus('RECIBIDO');

    // Simulate small status transition delay for visual feedback
    await new Promise(r => setTimeout(r, 600));
    
    // Status 2: OCR_EN_PROCESO
    setCurrentStatus('OCR_EN_PROCESO');

    try {
      const result = await processDocumentOcr(fileToProcess, user);
      
      if (result.estado_ocr === 'OCR_ERROR' || result.error) {
        setCurrentStatus('OCR_ERROR');
        setErrorMessage(result.error || 'Error no especificado al procesar el archivo mediante OCR Gemini.');
      } else {
        setCurrentStatus('OCR_COMPLETADO');
        setExtractionResult(result.resultado_json || null);
        setExtractedRawText(result.texto_extraido || null);
      }
    } catch (err: any) {
      setCurrentStatus('OCR_ERROR');
      setErrorMessage(err?.message || 'Fallo inesperado al ejecutar el análisis de OCR.');
    } finally {
      setIsProcessing(false);
      loadHistory();
    }
  };

  // Preset Test File Helper (Creates synthetic test files for live testing PNG, JPG, WEBP, PDF, Invalid, Error)
  const createMockFile = (name: string, mime: string, _sizeBytes: number, content: string) => {
    const blob = new Blob([content], { type: mime });
    return new File([blob], name, { type: mime });
  };

  const handleRunPresetTest = (testType: 'png' | 'jpg' | 'webp' | 'pdf' | 'invalid' | 'error') => {
    let testFile: File;

    if (testType === 'png') {
      testFile = createMockFile('peticion_ciudadana_muestra.png', 'image/png', 245000, 'PNG SAMPLE IMAGE DATA');
    } else if (testType === 'jpg') {
      testFile = createMockFile('radicado_oficial_2026.jpg', 'image/jpeg', 312000, 'JPG SAMPLE IMAGE DATA');
    } else if (testType === 'webp') {
      testFile = createMockFile('escaneo_derecho_peticion.webp', 'image/webp', 189000, 'WEBP SAMPLE IMAGE DATA');
    } else if (testType === 'pdf') {
      testFile = createMockFile('solicitud_intervencion_vial.pdf', 'application/pdf', 540000, '%PDF-1.4 SAMPLE DOCUMENT DATA');
    } else if (testType === 'invalid') {
      testFile = createMockFile('ejecutable_no_permitido.exe', 'application/x-msdownload', 1024000, 'INVALID BINARY DATA');
    } else {
      // Over size limit file test
      testFile = createMockFile('archivo_demasiado_grande.pdf', 'application/pdf', 15 * 1024 * 1024, 'OVERSIZED DATA CONTENT');
    }

    setSelectedFile(testFile);
    executeOcrProcess(testFile);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-xl p-6 text-white shadow-xl border border-blue-700/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> FASE 4: OCR Y EXTRACCIÓN CON GEMINI
              </span>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-md border border-amber-500/30 font-medium">
                Sin Generación Normativa (Exclusivo OCR)
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Procesador OCR e Inteligencia de Documentos</h2>
            <p className="text-blue-200/80 text-sm mt-1 max-w-3xl">
              Carga documentos en formato PNG, JPG, WEBP o PDF. Gemini es utilizado exclusivamente para digitalización OCR y estructuración JSON de metadatos sin generar respuestas ni alucinar datos.
            </p>
          </div>
          <button
            onClick={loadHistory}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium flex items-center gap-2 backdrop-blur-sm transition"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar Historial
          </button>
        </div>
      </div>

      {/* Quick Testing Bar */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileType className="w-4 h-4 text-cyan-400" /> Pruebas Rápidas de Archivos y Validaciones
          </span>
          <span className="text-xs text-slate-400">Formatos: PNG, JPG, JPEG, WEBP, PDF (Máx 10MB)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <button
            onClick={() => handleRunPresetTest('png')}
            disabled={isProcessing}
            className="px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> 1. Prueba PNG
          </button>
          <button
            onClick={() => handleRunPresetTest('jpg')}
            disabled={isProcessing}
            className="px-3 py-2 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-700/50 text-blue-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> 2. Prueba JPG
          </button>
          <button
            onClick={() => handleRunPresetTest('webp')}
            disabled={isProcessing}
            className="px-3 py-2 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/50 text-purple-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> 3. Prueba WEBP
          </button>
          <button
            onClick={() => handleRunPresetTest('pdf')}
            disabled={isProcessing}
            className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-700/50 text-rose-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> 4. Prueba PDF
          </button>
          <button
            onClick={() => handleRunPresetTest('invalid')}
            disabled={isProcessing}
            className="px-3 py-2 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/50 text-amber-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> 5. Archivo Inválido
          </button>
          <button
            onClick={() => handleRunPresetTest('error')}
            disabled={isProcessing}
            className="px-3 py-2 bg-red-950/60 hover:bg-red-900/60 border border-red-700/50 text-red-300 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> 6. Error Tamaño
          </button>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Upload & Status Box */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-md">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" /> Cargar Documento para OCR
            </h3>

            <div className="border-2 border-dashed border-slate-600 hover:border-cyan-500/70 transition rounded-xl p-6 text-center bg-slate-900/40 relative">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleFileChange}
                disabled={isProcessing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center">
                <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-full mb-3 border border-cyan-500/20">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-200">
                  Haz clic o arrastra un archivo aquí
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PNG, JPG, WEBP o PDF hasta 10 MB
                </p>
              </div>
            </div>

            {selectedFile && (
              <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-700/80 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-white truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Tipo desconocido'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => executeOcrProcess(selectedFile)}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-xs font-medium transition shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Procesar
                </button>
              </div>
            )}

            {/* Live Status Flow Progress */}
            {currentStatus && (
              <div className="mt-5 p-4 rounded-xl border bg-slate-900/60 border-slate-700/80 space-y-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Estado del Procesamiento OCR:
                </span>
                
                <div className="grid grid-cols-4 gap-1.5">
                  <div className={`p-2 rounded text-center text-[11px] font-semibold flex flex-col items-center gap-1 ${
                    currentStatus === 'RECIBIDO' || currentStatus === 'OCR_EN_PROCESO' || currentStatus === 'OCR_COMPLETADO'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}>
                    <Clock className="w-3.5 h-3.5" /> RECIBIDO
                  </div>

                  <div className={`p-2 rounded text-center text-[11px] font-semibold flex flex-col items-center gap-1 ${
                    currentStatus === 'OCR_EN_PROCESO'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      : currentStatus === 'OCR_COMPLETADO'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}>
                    <RefreshCw className={`w-3.5 h-3.5 ${currentStatus === 'OCR_EN_PROCESO' ? 'animate-spin' : ''}`} /> EN PROCESO
                  </div>

                  <div className={`p-2 rounded text-center text-[11px] font-semibold flex flex-col items-center gap-1 ${
                    currentStatus === 'OCR_COMPLETADO'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> COMPLETADO
                  </div>

                  <div className={`p-2 rounded text-center text-[11px] font-semibold flex flex-col items-center gap-1 ${
                    currentStatus === 'OCR_ERROR'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}>
                    <AlertTriangle className="w-3.5 h-3.5" /> ERROR
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/50 border border-red-700/60 rounded-lg text-red-300 text-xs flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-200">Error en el archivo / OCR</p>
                      <p className="mt-0.5">{errorMessage}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Output Viewer */}
        <div className="lg:col-span-7">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-md h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" /> Resultado Estructurado (Gemini JSON)
              </h3>
              
              <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button
                  onClick={() => setActiveTab('structured')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    activeTab === 'structured' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  JSON Estructurado
                </button>
                <button
                  onClick={() => setActiveTab('raw_text')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    activeTab === 'raw_text' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Texto Completo OCR
                </button>
              </div>
            </div>

            {!extractionResult && !isProcessing && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/30">
                <Info className="w-10 h-10 text-slate-500 mb-2" />
                <p className="text-sm text-slate-300 font-medium">Ningún resultado OCR cargado</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Selecciona o arrastra un archivo en el panel izquierdo o utiliza una de las pruebas rápidas para ejecutar la digitalización con Gemini.
                </p>
              </div>
            )}

            {isProcessing && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
                <p className="text-sm text-cyan-200 font-medium">Digitalizando documento mediante Gemini OCR...</p>
                <p className="text-xs text-slate-400 mt-1">Extrayendo radicado, fechas, partes, asunto, petición y normas mencionadas.</p>
              </div>
            )}

            {extractionResult && !isProcessing && activeTab === 'structured' && (
              <div className="space-y-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700/80">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Radicado Extraído</span>
                    <p className="text-sm font-semibold text-cyan-300 mt-0.5">
                      {extractionResult.radicado || <span className="text-slate-500 italic">null (No detectado)</span>}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700/80">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Fecha del Documento</span>
                    <p className="text-sm font-medium text-white mt-0.5">
                      {extractionResult.fecha || <span className="text-slate-500 italic">null (No detectada)</span>}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700/80">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Remitente</span>
                    <p className="text-sm font-medium text-white mt-0.5">
                      {extractionResult.remitente || <span className="text-slate-500 italic">null (No especificado)</span>}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700/80">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Destinatario / Entidad</span>
                    <p className="text-sm font-medium text-white mt-0.5">
                      {extractionResult.destinatario || extractionResult.entidad || <span className="text-slate-500 italic">null (No especificado)</span>}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-700/80">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Asunto Principal</span>
                  <p className="text-sm text-slate-200 font-medium mt-1">
                    {extractionResult.asunto || <span className="text-slate-500 italic">null (No detectado)</span>}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-700/80">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Petición / Solicitud del Ciudadano</span>
                  <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                    {extractionResult.peticion || <span className="text-slate-500 italic">null (No detectada)</span>}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-700/80">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Normas Mencionadas ({extractionResult.normas_mencionadas.length})
                  </span>
                  {extractionResult.normas_mencionadas.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {extractionResult.normas_mencionadas.map((norma, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-md">
                          📜 {norma}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 italic text-xs">[] (Sin leyes o normas citadas explícitamente)</span>
                  )}
                </div>
              </div>
            )}

            {extractionResult && !isProcessing && activeTab === 'raw_text' && (
              <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed max-h-[420px]">
                {extractedRawText || extractionResult.texto_extraido || 'Sin texto transcrito.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OCR Documents History Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-md">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" /> Historial de Documentos Procesados por OCR
        </h3>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No hay registros de documentos procesados en la base de datos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 uppercase text-[11px] font-semibold text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Archivo</th>
                  <th className="py-3 px-4">Tipo MIME</th>
                  <th className="py-3 px-4">Tamaño</th>
                  <th className="py-3 px-4">Estado OCR</th>
                  <th className="py-3 px-4">Radicado Extraído</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-700/30 transition">
                    <td className="py-3 px-4 font-medium text-white max-w-[200px] truncate">
                      {record.nombre_archivo}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{record.tipo_mime}</td>
                    <td className="py-3 px-4 text-slate-400">{(record.tamano_bytes / 1024).toFixed(1)} KB</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        record.estado_ocr === 'OCR_COMPLETADO'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : record.estado_ocr === 'OCR_ERROR'
                          ? 'bg-red-500/20 text-red-300 border-red-500/30'
                          : record.estado_ocr === 'OCR_EN_PROCESO'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      }`}>
                        {record.estado_ocr}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-cyan-300">
                      {record.resultado_json?.radicado || 'null'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(record.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedRecordModal(record)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] font-medium inline-flex items-center gap-1 transition"
                      >
                        <Eye className="w-3 h-3" /> Ver JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal viewer for history JSON */}
      {selectedRecordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" /> {selectedRecordModal.nombre_archivo}
              </h4>
              <button
                onClick={() => setSelectedRecordModal(null)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p><strong className="text-slate-400">Estado OCR:</strong> {selectedRecordModal.estado_ocr}</p>
              <p><strong className="text-slate-400">Tipo MIME:</strong> {selectedRecordModal.tipo_mime}</p>
              {selectedRecordModal.error_mensaje && (
                <p className="text-red-300 bg-red-950/60 p-2 rounded border border-red-700">
                  <strong>Error:</strong> {selectedRecordModal.error_mensaje}
                </p>
              )}
            </div>

            <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-y-auto font-mono text-xs text-emerald-400">
              <pre>{JSON.stringify(selectedRecordModal.resultado_json || selectedRecordModal.error_mensaje || {}, null, 2)}</pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRecordModal(null)}
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
