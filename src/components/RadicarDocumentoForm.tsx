import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  FileCode, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  FileType2, 
  Trash2, 
  Send, 
  Clock, 
  Building2,
  FileCheck,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { DocumentoRadicado, RadicacionMode, TipoSolicitud } from '../types/radicacion';
import { checkDuplicatePetition, savePetitionToSupabase } from '../services/supabaseService';
import { ocrExtractText } from '../services/aiService';

interface RadicarDocumentoFormProps {
  onSuccessRadicado: (radicado: DocumentoRadicado) => void;
  initialMode?: RadicacionMode;
  initialCategory?: string;
}

export const RadicarDocumentoForm: React.FC<RadicarDocumentoFormProps> = ({
  onSuccessRadicado,
  initialMode = 'escrito',
  initialCategory = 'Agua y Alcantarillado'
}) => {
  const { user, openAuthModal, executeAfterAuth } = useAuth();

  // Mode state: 'escrito' | 'pdf' | 'word'
  const [modoRadicacion, setModoRadicacion] = useState<RadicacionMode>(initialMode);

  // Form states
  const [tipoSolicitud, setTipoSolicitud] = useState<TipoSolicitud>('Derecho de Petición');
  const [categoria, setCategoria] = useState<string>(initialCategory);
  const [asunto, setAsunto] = useState<string>('');
  const [descripcionTexto, setDescripcionTexto] = useState<string>('');

  useEffect(() => {
    if (initialMode) setModoRadicacion(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialCategory) setCategoria(initialCategory);
  }, [initialCategory]);

  // File states
  const [uploadedFile, setUploadedFile] = useState<{
    file: File;
    name: string;
    size: string;
    extension: string;
  } | null>(null);

  // Citizen contact states
  const [cedulaInput, setCedulaInput] = useState<string>(user?.documentId || '1098765432');
  const [telefonoInput, setTelefonoInput] = useState<string>(user?.phone || '300 555 0192');
  const [aceptaTerminos, setAceptaTerminos] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick templates
  const handleInsertTemplate = (type: 'peticion' | 'queja' | 'informacion') => {
    if (type === 'peticion') {
      if (!asunto) setAsunto('Solicitud de intervención prioritaria por fallas en el servicio público');
      setDescripcionTexto(
        `RESPECTADOS SEÑORES DEL GOBIERNO MUNICIPAL:\n\n` +
        `En ejercicio del Derecho Fundamental de Petición consagrado en la Constitución Política, solicito comedidamente la solución oportuna a la siguiente problemática:\n\n` +
        `1. HECHOS: Se han presentado anomalías e interrupciones en el servicio que afectan directamente a la comunidad.\n` +
        `2. SOLICITUD: Programar visita técnica de inspección y brindar respuesta formal a mi correo electrónico registrado.\n\n` +
        `Agradezco de antemano su atención a la presente solicitud.`
      );
    } else if (type === 'queja') {
      if (!asunto) setAsunto('Queja formal por irregularidades y retraso en el servicio');
      setDescripcionTexto(
        `SEÑORES ATENCIÓN CIUDADANA MUNICIPAL:\n\n` +
        `Por medio de la presente radico QUEJA FORMAL por la falta de oportunidad y deficiencias en la prestación del servicio público.\n\n` +
        `SOLICITUD: Solicito formalmente se investigue la situación, se tomen las medidas correctivas pertinentes y se me notifique por escrito el resultado.`
      );
    } else {
      if (!asunto) setAsunto('Solicitud de copia de documentos e informe técnico');
      setDescripcionTexto(
        `SEÑORES ALCALDÍA Y DIRECCIÓN MUNICIPAL:\n\n` +
        `Solicito respetuosamente me sea suministrada copia íntegra del informe técnico y actos administrativos correspondientes a las obras y servicios asignados a nuestro sector.`
      );
    }
  };

  const [isOcrExtracting, setIsOcrExtracting] = useState<boolean>(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string | null>(null);

  // Drag and drop / file upload
  const handleFileDrop = (
    e: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>, 
    expectedExt: 'pdf' | 'word'
  ) => {
    let files: FileList | null = null;
    if ('dataTransfer' in e) {
      e.preventDefault();
      files = e.dataTransfer.files;
    } else if (e.target.files) {
      files = e.target.files;
    }

    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    const validPdfAndImages = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    if (expectedExt === 'pdf' && !validPdfAndImages.includes(ext)) {
      setErrorMsg('Por favor selecciona un archivo PDF o imagen (.pdf, .png, .jpg, .webp)');
      return;
    }

    if (expectedExt === 'word' && ext !== 'doc' && ext !== 'docx') {
      setErrorMsg('Por favor selecciona un documento de Word válido (.doc o .docx)');
      return;
    }

    setErrorMsg(null);
    setOcrSuccessMsg(null);
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    setUploadedFile({
      file,
      name: file.name,
      size: sizeInMb,
      extension: ext
    });
  };

  const handleRunOCR = async () => {
    if (!uploadedFile) return;
    setIsOcrExtracting(true);
    setErrorMsg(null);
    setOcrSuccessMsg(null);
    try {
      const result = await ocrExtractText(uploadedFile.file);
      if (result.success && result.text) {
        setDescripcionTexto(prev => prev ? `${prev}\n\n[Texto extraído por Gemini OCR de ${uploadedFile.name}]:\n${result.text}` : result.text);
        setOcrSuccessMsg(`✅ Texto extraído exitosamente con Gemini OCR (${result.text.length} caracteres).`);
      } else {
        setErrorMsg(result.error || 'No se pudo extraer texto del archivo mediante OCR.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(`Error ejecutando OCR: ${msg}`);
    } finally {
      setIsOcrExtracting(false);
    }
  };

  // Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!asunto.trim()) {
      setErrorMsg('Por favor ingresa el asunto principal de la petición.');
      return;
    }

    if (modoRadicacion === 'escrito' && !descripcionTexto.trim()) {
      setErrorMsg('Por favor redacta los hechos y el contenido de tu petición.');
      return;
    }

    if ((modoRadicacion === 'pdf' || modoRadicacion === 'word') && !uploadedFile) {
      setErrorMsg(`Debes adjuntar el archivo ${modoRadicacion.toUpperCase()} antes de radicar.`);
      return;
    }

    if (!aceptaTerminos) {
      setErrorMsg('Debes autorizar el tratamiento de datos y confirmar la veracidad de la información.');
      return;
    }

    setIsSubmitting(true);

    executeAfterAuth(async () => {
      try {
        const fileHash = uploadedFile ? uploadedFile.name : (asunto + descripcionTexto).slice(0, 16);
        
        // Verification of Duplicate Document in Supabase
        const duplicateRes = await checkDuplicatePetition(cedulaInput, asunto, fileHash);
        if (duplicateRes.esDuplicado) {
          setErrorMsg(
            `⚠️ ATENCIÓN DUPLICADO: ${duplicateRes.motivo || 'Ya existe un radicado previo registrado con este mismo asunto.'}`
          );
          setIsSubmitting(false);
          return;
        }

        const randomId = 'RAD-2026-' + Math.floor(10000 + Math.random() * 90000);
        const hash = Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

        const newRadicado: DocumentoRadicado = {
          id: randomId,
          solicitante: user?.name || 'Ciudadano Google',
          emailSolicitante: user?.email || 'usuario@gmail.com',
          cedulaSolicitante: cedulaInput,
          telefonoSolicitante: telefonoInput,
          categoria: categoria,
          tipoSolicitud: tipoSolicitud,
          modoRadicacion: modoRadicacion,
          asunto: asunto,
          descripcion: modoRadicacion === 'escrito' 
            ? descripcionTexto 
            : `Documento adjunto (${uploadedFile?.name}) con asunto: ${asunto}`,
          archivoAdjunto: uploadedFile ? {
            nombre: uploadedFile.name,
            tipo: uploadedFile.extension.toUpperCase(),
            tamano: uploadedFile.size,
            extension: uploadedFile.extension
          } : undefined,
          estado: 'En trámite',
          fechaRadicacion: new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          plazoLegal: tipoSolicitud === 'Solicitud de Información' ? '10 días hábiles' : '15 días hábiles',
          respuestaOficial: 'Solicitud radicada con éxito. En proceso de asignación a la dependencia municipal correspondiente.',
          hashSeguridad: hash,
          usuarioId: user?.id,
          proveedorAuth: 'google'
        };

        // Save to Supabase DB asynchronously
        await savePetitionToSupabase(newRadicado);
        onSuccessRadicado(newRadicado);
      } catch (err) {
        console.error('Error in radicacion process:', err);
        setErrorMsg('Ocurrió un error inesperado al radicar. Intenta nuevamente.');
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  return (
    <div className="radicar-clean-wrapper">
      {/* 1. Header Conciso y Limpio */}
      <div className="radicar-clean-header">
        <div className="radicar-header-titles">
          <h2 className="radicar-main-title">Radicar Petición Oficial</h2>
          <p className="radicar-main-subtitle">
            Diligencia el formulario para radicar tu trámite con firma electrónica y seguimiento en tiempo real.
          </p>
        </div>

        {/* Indicador Discreto de Sesión */}
        <div className="radicar-auth-pill-bar">
          {user ? (
            <div className="user-verified-badge" title="Sesión de Google activa">
              <UserCheck size={16} />
              <span>{user.name}</span>
            </div>
          ) : (
            <button
              type="button"
              className="btn-quick-login-header"
              onClick={() => openAuthModal()}
            >
              <Lock size={15} />
              <span>Ingresar con Google</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Selector de Modalidad (Segmented Control Elegante) */}
      <div className="radicar-mode-selector-bar">
        <button
          type="button"
          className={`mode-segment-btn ${modoRadicacion === 'escrito' ? 'active' : ''}`}
          onClick={() => {
            setModoRadicacion('escrito');
            setUploadedFile(null);
          }}
        >
          <FileText size={18} />
          <span>Redactar en Línea</span>
        </button>

        <button
          type="button"
          className={`mode-segment-btn ${modoRadicacion === 'pdf' ? 'active' : ''}`}
          onClick={() => {
            setModoRadicacion('pdf');
            setUploadedFile(null);
            setOcrSuccessMsg(null);
          }}
        >
          <FileType2 size={18} />
          <span>Adjuntar PDF / Imagen</span>
        </button>

        <button
          type="button"
          className={`mode-segment-btn ${modoRadicacion === 'word' ? 'active' : ''}`}
          onClick={() => {
            setModoRadicacion('word');
            setUploadedFile(null);
          }}
        >
          <FileCode size={18} />
          <span>Adjuntar Word (.docx)</span>
        </button>
      </div>

      {/* 3. Formulario en 2 Columnas Despejadas */}
      <form onSubmit={handleSubmit} className="radicar-clean-form">
        <div className="radicar-columns-grid">
          {/* COLUMNA 1: Datos del Trámite y del Solicitante */}
          <div className="radicar-col-card">
            <div className="col-header-bar">
              <Building2 size={18} />
              <h3>1. Información del Trámite</h3>
            </div>

            <div className="form-group-clean">
              <label htmlFor="input-asunto">Asunto Principal del Trámite *</label>
              <input
                id="input-asunto"
                type="text"
                className="input-clean"
                placeholder="Ej: Fuga de agua en red pública de Calle 45..."
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                required
              />
            </div>

            <div className="form-row-compact">
              <div className="form-group-clean">
                <label htmlFor="select-tipo-solicitud">Tipo de Solicitud *</label>
                <select
                  id="select-tipo-solicitud"
                  className="select-clean"
                  value={tipoSolicitud}
                  onChange={(e) => setTipoSolicitud(e.target.value as TipoSolicitud)}
                >
                  <option value="Derecho de Petición">Derecho de Petición (15 días)</option>
                  <option value="Queja">Queja por Servicio (15 días)</option>
                  <option value="Reclamo">Reclamo Técnico (15 días)</option>
                  <option value="Solicitud de Información">Solicitud de Información (10 días)</option>
                  <option value="Sugerencia">Sugerencia Comunitaria</option>
                </select>
              </div>

              <div className="form-group-clean">
                <label htmlFor="select-categoria">Dependencia Municipal *</label>
                <select
                  id="select-categoria"
                  className="select-clean"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="Agua y Alcantarillado">Agua y Alcantarillado</option>
                  <option value="Alumbrado Público">Alumbrado Público</option>
                  <option value="Recolección de Basura">Recolección de Basura</option>
                  <option value="Tránsito y Movilidad">Tránsito y Movilidad</option>
                  <option value="Derecho de Petición">Peticiones Generales (CAM)</option>
                </select>
              </div>
            </div>

            <div className="form-row-compact">
              <div className="form-group-clean">
                <label htmlFor="input-cedula">Cédula o Identificación *</label>
                <input
                  id="input-cedula"
                  type="text"
                  className="input-clean"
                  placeholder="Ej: 1098765432"
                  value={cedulaInput}
                  onChange={(e) => setCedulaInput(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-clean">
                <label htmlFor="input-telefono">Teléfono Celular *</label>
                <input
                  id="input-telefono"
                  type="text"
                  className="input-clean"
                  placeholder="Ej: 300 555 0192"
                  value={telefonoInput}
                  onChange={(e) => setTelefonoInput(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="legal-notice-chip">
              <Clock size={15} />
              <span>Plazo legal de respuesta: <strong>{tipoSolicitud === 'Solicitud de Información' ? '10' : '15'} días hábiles</strong> (Ley 1755).</span>
            </div>
          </div>

          {/* COLUMNA 2: Contenido o Archivo Adjunto */}
          <div className="radicar-col-card">
            <div className="col-header-bar">
              <FileCheck size={18} />
              <h3>2. Documento o Exposición de Motivos</h3>
            </div>

            {modoRadicacion === 'escrito' ? (
              <div className="content-escrito-pane">
                <div className="templates-quick-row">
                  <span className="templates-tag">Plantillas rápidas:</span>
                  <button
                    type="button"
                    className="template-btn"
                    onClick={() => handleInsertTemplate('peticion')}
                  >
                    + Petición General
                  </button>
                  <button
                    type="button"
                    className="template-btn"
                    onClick={() => handleInsertTemplate('queja')}
                  >
                    + Queja
                  </button>
                  <button
                    type="button"
                    className="template-btn"
                    onClick={() => handleInsertTemplate('informacion')}
                  >
                    + Copias
                  </button>
                </div>

                <div className="form-group-clean">
                  <textarea
                    className="textarea-clean"
                    rows={8}
                    placeholder="Escribe aquí los hechos, fechas, dirección y solicitudes puntuales dirigidas a la administración municipal..."
                    value={descripcionTexto}
                    onChange={(e) => setDescripcionTexto(e.target.value)}
                    required
                  />
                  <div className="textarea-footer-info">
                    <span>{descripcionTexto.length} caracteres</span>
                    <span>{descripcionTexto.trim() ? descripcionTexto.trim().split(/\s+/).length : 0} palabras</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="content-upload-pane">
                {!uploadedFile ? (
                  <div
                    className={`clean-dropzone ${modoRadicacion === 'pdf' ? 'dropzone-pdf-clean' : 'dropzone-word-clean'}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleFileDrop(e, modoRadicacion === 'pdf' ? 'pdf' : 'word')}
                  >
                    {modoRadicacion === 'pdf' ? (
                      <FileType2 size={38} className="dropzone-icon pdf-color" />
                    ) : (
                      <FileCode size={38} className="dropzone-icon word-color" />
                    )}
                    <h4>Arrastra tu archivo {modoRadicacion === 'pdf' ? 'PDF o Imagen (PDF, PNG, JPG, WEBP)' : 'Word (.docx)'} aquí</h4>
                    <p>o selecciona desde tu dispositivo (máximo 20 MB)</p>

                    <label className="btn-browse-clean">
                      <Upload size={16} />
                      <span>Examinar {modoRadicacion === 'pdf' ? 'PDF / Imagen' : 'WORD'}</span>
                      <input
                        type="file"
                        accept={modoRadicacion === 'pdf' ? '.pdf,.png,.jpg,.jpeg,.webp' : '.doc,.docx'}
                        className="hidden-file-input"
                        onChange={(e) => handleFileDrop(e, modoRadicacion === 'pdf' ? 'pdf' : 'word')}
                      />
                    </label>
                  </div>
                ) : (
                  <div>
                    <div className="file-attached-preview">
                      <div className="file-attached-info">
                        <div className="file-attached-icon">
                          {['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(uploadedFile.extension) ? <FileType2 size={24} /> : <FileCode size={24} />}
                        </div>
                        <div>
                          <strong className="file-attached-name">{uploadedFile.name}</strong>
                          <span className="file-attached-meta">{uploadedFile.size} • Archivo validado</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-file-attached-remove"
                        onClick={() => {
                          setUploadedFile(null);
                          setOcrSuccessMsg(null);
                        }}
                        title="Quitar archivo adjunto"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(uploadedFile.extension) && (
                      <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={handleRunOCR}
                          disabled={isOcrExtracting}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            borderRadius: '0.5rem',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            cursor: isOcrExtracting ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <span>{isOcrExtracting ? '⏳ Ejecutando Gemini OCR...' : '🔍 Extraer texto con Gemini OCR'}</span>
                        </button>
                        {ocrSuccessMsg && (
                          <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 500, backgroundColor: '#f0fdf4', padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #bbf7d0' }}>
                            {ocrSuccessMsg}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group-clean" style={{ marginTop: '0.85rem' }}>
                  <label htmlFor="input-resumen">Texto extraído / Notas u observaciones complementarias</label>
                  <textarea
                    id="input-resumen"
                    className="textarea-clean-sm"
                    rows={4}
                    placeholder="El texto extraído por Gemini OCR o detalles complementarios aparecerán aquí..."
                    value={descripcionTexto}
                    onChange={(e) => setDescripcionTexto(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alerta de Error */}
        {errorMsg && (
          <div className="radicar-error-box" role="alert">
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 4. Footer y Botón de Radicación */}
        <div className="radicar-form-footer">
          <label className="terms-checkbox-label">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
            />
            <span>
              Certifico la veracidad de la información aportada y autorizo las notificaciones oficiales a mi cuenta de Google (Habeas Data Ley 1581 de 2012).
            </span>
          </label>

          <div className="footer-action-row">
            <div className="footer-security-note">
              <ShieldCheck size={16} color="#16a34a" />
              <span>Firma electrónica SHA-256 • Radicación con validez jurídica</span>
            </div>

            <button
              type="submit"
              className="btn-submit-radicacion-clean"
              disabled={isSubmitting}
            >
              <Send size={18} />
              <span>{isSubmitting ? 'Procesando Radicado...' : 'Radicar Petición Oficial'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
export default RadicarDocumentoForm;
