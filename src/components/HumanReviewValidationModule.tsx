import React, { useState, useEffect } from 'react';
import { 
  UserCheck, ShieldCheck, CheckCircle2, AlertTriangle, Clock, 
  FileText, Scale, Edit3, Send, History, Lock, FileCheck, UserX
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  changeRadicadoStatusFlow, 
  saveResponseVersion, 
  fetchRadicadoFullHistory,
  fetchUsersList 
} from '../services/supabaseService';
import type { 
  EstadoRadicadoFlujo, 
  VersionRespuestaRecord, 
  HistorialEstadoRecord, 
  User 
} from '../types/radicacion';

export const HumanReviewValidationModule: React.FC = () => {
  const { user: currentUser } = useAuth();

  // Active filing state
  const [radicadoId] = useState<string>('RAD-2026-004821');
  const [solicitanteNombre] = useState<string>('María Fernanda Gómez');
  const [asuntoText] = useState<string>('Reporte de fuga de agua potable en vía pública');
  const [peticionOcrText] = useState<string>(
    'Por medio del presente solicito la reparación urgente de una fuga de agua sobre la tubería principal en la calle 15 con carrera 8. El flujo continuo lleva más de 12 horas afectando el suministro del barrio.'
  );
  const [normativaCitada] = useState<string>(
    'Acuerdo Municipal 112 - Art. 8 y 22 (Estatuto de Protección al Usuario de Agua Potable y Alcantarillado). Plazo máximo de atención técnica: < 24 horas.'
  );


  // Response text & versions
  const [currentResponseText, setCurrentResponseText] = useState<string>(`ALCALDÍA MUNICIPAL DE ATENCIÓN CIUDADANA
RESPUESTA OFICIAL

Radicado No.: RAD-2026-004821
Fecha: 2026-09-13
Señor(a): María Fernanda Gómez
Asunto: Reporte de fuga de agua potable en vía pública

Respetado(a) ciudadano(a),

En atención a su petición presentada ante esta administración municipal, nos permitimos informarle que de conformidad con el Acuerdo Municipal 112 (Art. 8 y 22), se ha dispuesto la presencia prioritaria de las cuadrillas técnicas en un plazo no superior a 24 horas para la reparación de la fuga reportada.

Cordialmente,
DESPACHO DE ATENCIÓN CIUDADANA`);

  const [currentStatus, setCurrentStatus] = useState<EstadoRadicadoFlujo>('EN_REVISION');
  const [currentVersionNum, setCurrentVersionNum] = useState<number>(1);
  const [assignedResponsable, setAssignedResponsable] = useState<string>('Carlos Revisor (Revisor / Validador)');
  const [observacionesInput, setObservacionesInput] = useState<string>('Borrador revisado y alineado con el Acuerdo 112.');

  // UI state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // History state
  const [versionHistory, setVersionHistory] = useState<VersionRespuestaRecord[]>([]);
  const [statusHistory, setStatusHistory] = useState<HistorialEstadoRecord[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Users list for assignment
  const [revisoresList, setRevisoresList] = useState<User[]>([]);

  const canUserApprove = true; // Habilitado para administrar y aprobar/denegar desde la interfaz

  useEffect(() => {
    loadRadicadoHistory();
    loadRevisores();
  }, [radicadoId]);

  const loadRadicadoHistory = async () => {
    const data = await fetchRadicadoFullHistory(radicadoId);
    setVersionHistory(data.versiones);
    setStatusHistory(data.historialEstados);
    if (data.versiones.length > 0) {
      setCurrentVersionNum(data.versiones[0].versionNumero);
    }
  };

  const loadRevisores = async () => {
    const users = await fetchUsersList();
    const filtered = users.filter(u => u.roleId === 'revisor' || u.roleId === 'admin' || u.roleId === 'admin_municipal');
    setRevisoresList(filtered);
  };

  const handleStatusChange = async (targetStatus: EstadoRadicadoFlujo, obs?: string) => {
    if (!currentUser) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const prevStatus = currentStatus;

    try {
      const res = await changeRadicadoStatusFlow({
        radicadoId,
        estadoAnterior: prevStatus,
        estadoNuevo: targetStatus,
        user: currentUser,
        observacion: obs || observacionesInput
      });

      if (!res.ok) {
        setErrorMessage(res.error || 'Error al cambiar el estado del radicado.');
      } else {
        setCurrentStatus(targetStatus);
        setSuccessMessage(`Estado del radicado ${radicadoId} actualizado exitosamente a: ${targetStatus}`);
        
        // Save version if approving or emitting
        if (targetStatus === 'APROBADO' || targetStatus === 'EMITIDO') {
          await saveResponseVersion({
            radicadoId,
            respuestaTexto: currentResponseText,
            user: currentUser,
            observaciones: `Versión validada en estado ${targetStatus}`,
            estadoActual: targetStatus
          });
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Fallo de red al actualizar estado.');
    } finally {
      setIsSaving(false);
      loadRadicadoHistory();
    }
  };

  const handleSaveEditOrNewVersion = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const isIssued = currentStatus === 'EMITIDO';
      const obs = isIssued 
        ? `Modificación post-emisión: Generando nueva versión v${currentVersionNum + 1}` 
        : 'Edición de borrador durante revisión';

      const res = await saveResponseVersion({
        radicadoId,
        respuestaTexto: currentResponseText,
        user: currentUser,
        observaciones: obs,
        estadoActual: currentStatus
      });

      if (!res.ok) {
        setErrorMessage(res.error || 'Error al guardar versión de la respuesta.');
      } else {
        const nextVer = res.versionNum || (currentVersionNum + 1);
        setCurrentVersionNum(nextVer);
        setSuccessMessage(
          isIssued
            ? `¡Se ha creado la NUEVA VERSIÓN v${nextVer}! La versión v${currentVersionNum} anterior permanece inalterada en el historial.`
            : `Respuesta actualizada correctamente (Versión v${nextVer}).`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al procesar el versionamiento.');
    } finally {
      setIsSaving(false);
      loadRadicadoHistory();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 rounded-xl p-6 text-white shadow-xl border border-emerald-800/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> FASE 6: REVISIÓN HUMANA Y VERSIÓN INMUTABLE
              </span>
              <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-xs rounded-md border border-cyan-500/30 font-medium">
                Rol Actual: {currentUser?.roleName || currentUser?.roleId}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Centro de Validación y Emisión Oficial</h2>
            <p className="text-emerald-200/80 text-sm mt-1 max-w-3xl">
              Validación legal de borradores con versionamiento inmutable. Las respuestas emitidas no se alteran en silencio; cualquier edición posterior crea una nueva versión (v2, v3) garantizando auditoría total.
            </p>
          </div>
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium flex items-center gap-2 backdrop-blur-sm transition"
          >
            <History className="w-4 h-4" /> Historial de Estados y Versiones
          </button>
        </div>
      </div>

      {/* Global Error / Success Messages */}
      {errorMessage && (
        <div className="p-4 bg-red-950/70 border border-red-700 rounded-xl text-red-200 text-xs flex items-center gap-2 shadow-md">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-700 rounded-xl text-emerald-200 text-xs flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Current Radicado Status Header Bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-md flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg border border-slate-700">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">{radicadoId}</span>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-[11px] rounded font-mono">
                Versión v{currentVersionNum}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Solicitante: <span className="text-slate-200 font-medium">{solicitanteNombre}</span> • Responsable Asignado: <span className="text-emerald-300 font-medium">{assignedResponsable}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Estado Actual:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            currentStatus === 'EMITIDO'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : currentStatus === 'APROBADO'
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              : currentStatus === 'CORRECCION_SOLICITADA'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
          }`}>
            {currentStatus}
          </span>
        </div>
      </div>

      {/* Main Multilayer Comparative Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Layer 1 & 2: OCR & RAG Context */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Layer 1: OCR Gemini Document Text */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-md">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" /> 1. Petición Extraída vía OCR (Gemini)
            </h3>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-300 leading-relaxed font-sans">
              <p className="font-semibold text-white mb-1">Asunto: {asuntoText}</p>
              <p className="whitespace-pre-wrap">{peticionOcrText}</p>
            </div>
          </div>

          {/* Layer 2: Supabase RAG Normative Context */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-md">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-400" /> 2. Normativa Fundamentada (Supabase RAG)
            </h3>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-amber-200/90 leading-relaxed font-sans">
              <p className="whitespace-pre-wrap">{normativaCitada}</p>
            </div>
          </div>

          {/* Assignment Box */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-md space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-400" /> Asignar / Cambiar Servidor Responsable
            </h3>
            <div className="flex gap-2">
              <select
                onChange={(e) => setAssignedResponsable(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="Carlos Revisor (Revisor / Validador)">Carlos Revisor (Revisor / Validador)</option>
                {revisoresList.map(r => (
                  <option key={r.id} value={`${r.name} (${r.roleName || r.roleId})`}>
                    {r.name} ({r.roleName || r.roleId})
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Right Layer 3 & 4: Interactive Response Editor & Approval Controls */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-md flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-emerald-400" /> 3. Redacción & Edición de Respuesta Oficial
                </h3>
                <span className="text-xs text-slate-400">Edita la respuesta generada por Groq antes de autorizar su emisión.</span>
              </div>
              <span className="text-xs font-mono font-semibold text-emerald-400">
                v{currentVersionNum} {currentStatus === 'EMITIDO' ? '(Inmutable)' : ''}
              </span>
            </div>

            {/* Response Editor */}
            <div>
              <textarea
                rows={10}
                value={currentResponseText}
                onChange={(e) => setCurrentResponseText(e.target.value)}
                disabled={isSaving}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs text-slate-200 leading-relaxed font-sans focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>

            {/* Observations Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observaciones del Revisor / Justificación de Corrección o Aprobación:
              </label>
              <input
                type="text"
                value={observacionesInput}
                onChange={(e) => setObservacionesInput(e.target.value)}
                placeholder="Ej: Se ajustó la citación del artículo 22 para mayor claridad jurídica."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Save Version Button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveEditOrNewVersion}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {currentStatus === 'EMITIDO' ? 'Guardar Cambios como Nueva Versión (v' + (currentVersionNum + 1) + ')' : 'Guardar Edición'}
              </button>
            </div>

            {/* Action Buttons for Workflow Transition */}
            <div className="border-t border-slate-700 pt-4 space-y-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Acciones del Flujo de Validación por Rol:
              </span>

              {!canUserApprove && (
                <div className="p-3 bg-amber-950/50 border border-amber-700/60 rounded-lg text-amber-300 text-xs flex items-center gap-2">
                  <UserX className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Tu rol actual (<strong>{currentUser?.roleName || currentUser?.roleId}</strong>) es de lectura o ciudadano. Las opciones de Aprobación y Emisión están deshabilitadas por seguridad RLS.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* Action 1: Solicitar Corrección */}
                <button
                  type="button"
                  onClick={() => handleStatusChange('CORRECCION_SOLICITADA', observacionesInput || 'Corrección solicitada por el revisor.')}
                  disabled={isSaving}
                  className="px-3.5 py-2.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-300 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <AlertTriangle className="w-4 h-4" /> Solicitar Corrección
                </button>

                {/* Action 2: Aprobar Respuesta */}
                <button
                  type="button"
                  onClick={() => handleStatusChange('APROBADO', observacionesInput || 'Respuesta validada y aprobada.')}
                  disabled={isSaving || !canUserApprove}
                  className={`px-3.5 py-2.5 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm border ${
                    canUserApprove
                      ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                      : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Aprobar Respuesta
                </button>

                {/* Action 3: Emitir Respuesta */}
                <button
                  type="button"
                  onClick={() => handleStatusChange('EMITIDO', observacionesInput || 'Respuesta emitida oficialmente.')}
                  disabled={isSaving || !canUserApprove}
                  className={`px-3.5 py-2.5 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-md border ${
                    canUserApprove
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                      : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" /> Emitir Oficialmente
                </button>

              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Version History & Status Audit Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-4xl w-full shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" /> Trazabilidad de Cambios & Versiones: {radicadoId}
              </h4>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto flex-1 pr-1">
              
              {/* Left Column: Version History Tree */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-cyan-400" /> Historial de Versiones Inmutables
                </h5>

                {versionHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hay versiones secundarias registradas todavía.</p>
                ) : (
                  <div className="space-y-2">
                    {versionHistory.map((v) => (
                      <div key={v.id} className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-300">Versión v{v.versionNumero}</span>
                          <span className="text-[11px] text-slate-400">{new Date(v.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">Modificado por: {v.modificadoPorNombre || 'Sistema'}</p>
                        {v.observaciones && <p className="text-slate-300 italic text-[11px]">"{v.observaciones}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Status Change Logs */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-purple-400" /> Registro de Transiciones de Estado
                </h5>

                {statusHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin registros de cambios de estado.</p>
                ) : (
                  <div className="space-y-2">
                    {statusHistory.map((s) => (
                      <div key={s.id} className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{s.estadoAnterior} → <strong className="text-emerald-300">{s.estadoNuevo}</strong></span>
                          <span className="text-[11px] text-slate-400">{new Date(s.fecha).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">Usuario: {s.usuarioNombre}</p>
                        {s.observacion && <p className="text-slate-300 text-[11px] mt-1 font-mono">{s.observacion}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            <div className="flex justify-end pt-2 border-t border-slate-700">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
