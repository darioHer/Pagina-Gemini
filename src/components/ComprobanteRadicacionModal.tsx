import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  Printer, 
  FileText, 
  Building2, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  User as UserIcon, 
  FileSpreadsheet, 
  QrCode, 
  ExternalLink,
  X
} from 'lucide-react';
import type { DocumentoRadicado } from '../types/radicacion';

interface ComprobanteRadicacionModalProps {
  radicado: DocumentoRadicado;
  onClose: () => void;
  onViewMyFilings: () => void;
  onFileNew: () => void;
}

export const ComprobanteRadicacionModal: React.FC<ComprobanteRadicacionModalProps> = ({
  radicado,
  onClose,
  onViewMyFilings,
  onFileNew
}) => {
  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getModeLabel = (modo: string) => {
    switch (modo) {
      case 'word': return 'Archivo Microsoft Word (.docx)';
      case 'pdf': return 'Archivo PDF Digitalizado (.pdf)';
      case 'escrito': return 'Petición Escrita Directa en Línea';
      default: return modo;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="comprobante-modal-card print-target" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Actions header (hidden when printing) */}
        <div className="no-print modal-top-actions">
          <div className="success-badge-title">
            <CheckCircle2 size={20} color="#16a34a" />
            <span>¡Radicación Exitosa en el Sistema Oficial!</span>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        {/* Certificate Header */}
        <div className="comprobante-certificate-header">
          <div className="cert-header-left">
            <div className="cert-logo-box">
              <Building2 size={28} color="#003399" />
            </div>
            <div>
              <h3 className="cert-gob-title">Gobierno Municipal de Atención Ciudadana</h3>
              <p className="cert-gob-subtitle">Ventanilla Única de Radicación Electrónica • Portal Oficial</p>
            </div>
          </div>
          <div className="cert-radicado-badge">
            <span className="cert-radicado-label">N° DE RADICADO</span>
            <span className="cert-radicado-code">{radicado.id}</span>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="comprobante-body">
          <div className="cert-stamp-bar">
            <div className="stamp-item">
              <Calendar size={15} />
              <span>Fecha y Hora: <strong>{radicado.fechaRadicacion}</strong></span>
            </div>
            <div className="stamp-item">
              <Clock size={15} />
              <span>Plazo Máximo Legal de Respuesta: <strong>{radicado.plazoLegal}</strong></span>
            </div>
            <div className="stamp-item">
              <ShieldCheck size={15} color="#003399" />
              <span>Estado: <strong style={{ color: '#d97706' }}>{radicado.estado}</strong></span>
            </div>
          </div>

          <div className="cert-grid-info">
            {/* Citizens Info */}
            <div className="cert-section-box">
              <h4 className="cert-section-title">
                <UserIcon size={16} />
                <span>Datos del Solicitante Autenticado</span>
              </h4>
              <div className="cert-data-list">
                <p><strong>Nombre completo:</strong> {radicado.solicitante}</p>
                <p><strong>Correo electrónico:</strong> {radicado.emailSolicitante}</p>
                <p><strong>Cédula / Identificación:</strong> {radicado.cedulaSolicitante}</p>
                <p><strong>Teléfono de contacto:</strong> {radicado.telefonoSolicitante}</p>
                <p>
                  <strong>Autenticación:</strong>{' '}
                  <span className="provider-tag">Google OAuth 2.0</span>
                </p>
              </div>
            </div>

            {/* Document / Petition Specs */}
            <div className="cert-section-box">
              <h4 className="cert-section-title">
                <FileText size={16} />
                <span>Detalles de la Petición o Documento</span>
              </h4>
              <div className="cert-data-list">
                <p><strong>Tipo de Solicitud:</strong> {radicado.tipoSolicitud}</p>
                <p><strong>Categoría / Área:</strong> {radicado.categoria}</p>
                <p><strong>Modalidad de Entrega:</strong> {getModeLabel(radicado.modoRadicacion)}</p>
                {radicado.archivoAdjunto ? (
                  <p className="attached-file-info">
                    <FileSpreadsheet size={15} />
                    <strong>Adjunto:</strong> {radicado.archivoAdjunto.nombre} ({radicado.archivoAdjunto.tamano})
                  </p>
                ) : (
                  <p><strong>Documento escrito:</strong> Generado e ingresado en el portal</p>
                )}
                <p className="hash-info">
                  <strong>Hash de Firma Digital:</strong> <code>{radicado.hashSeguridad}</code>
                </p>
              </div>
            </div>
          </div>

          {/* Subject & Summary */}
          <div className="cert-asunto-box">
            <h4 className="cert-asunto-header">Asunto de la solicitud:</h4>
            <p className="cert-asunto-title">{radicado.asunto}</p>
            <div className="cert-descripcion-snippet">
              <strong>Síntesis del contenido:</strong>
              <p>{radicado.descripcion}</p>
            </div>
          </div>

          {/* Footer Barcode / Verification */}
          <div className="cert-footer-verification">
            <div className="qr-box">
              <QrCode size={56} color="#003399" />
              <span className="qr-sub">Escanear para verificar con Google Identity</span>
            </div>
            <div className="barcode-box">
              <div className="barcode-lines">
                ||||| | |||| || | ||||| || |||||| | ||| ||||
              </div>
              <span className="barcode-text">{radicado.id} • HASH-{radicado.hashSeguridad.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* Buttons Action Bar */}
        <div className="no-print comprobante-footer-actions">
          <button 
            type="button" 
            className="btn-cert-secondary"
            onClick={handlePrint}
          >
            <Printer size={18} />
            <span>Imprimir / Guardar Comprobante PDF</span>
          </button>

          <button 
            type="button" 
            className="btn-cert-primary"
            onClick={onViewMyFilings}
          >
            <ExternalLink size={18} />
            <span>Ver mis Radicados</span>
          </button>

          <button 
            type="button" 
            className="btn-cert-text"
            onClick={onFileNew}
          >
            <span>Radicar otro documento</span>
          </button>
        </div>
      </div>
    </div>
  );
};
