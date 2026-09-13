import React, { useState } from 'react';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Lock, 
  FileType2, 
  FileCode, 
  Eye, 
  PlusCircle, 
  FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { DocumentoRadicado } from '../types/radicacion';
import { ComprobanteRadicacionModal } from './ComprobanteRadicacionModal';

interface MisRadicadosPageProps {
  radicadosList: DocumentoRadicado[];
  onFileNew: () => void;
}

export const MisRadicadosPage: React.FC<MisRadicadosPageProps> = ({
  radicadosList,
  onFileNew
}) => {
  const { user, openAuthModal } = useAuth();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRadicadoForModal, setSelectedRadicadoForModal] = useState<DocumentoRadicado | null>(null);

  // If user is not logged in, prompt Google Login cleanly
  if (!user) {
    return (
      <div className="clean-auth-prompt-card">
        <Lock size={44} color="#003399" />
        <h3>Acceso a Mis Radicados</h3>
        <p>Para consultar el historial de tus solicitudes e imprimir tus comprobantes oficiales, ingresa con tu cuenta de Google.</p>
        <button 
          type="button" 
          className="btn-google-login-clean"
          onClick={() => openAuthModal()}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          <span>Ingresar con Google</span>
        </button>
      </div>
    );
  }

  // Filter user's filings (if empty, show full list so user can see all filings in session)
  const userFilingsMatches = radicadosList.filter(item => 
    item.emailSolicitante.toLowerCase() === user.email.toLowerCase() ||
    item.usuarioId === user.id ||
    item.solicitante.toLowerCase().includes(user.name.toLowerCase())
  );
  
  const userFilings = userFilingsMatches.length > 0 ? userFilingsMatches : radicadosList;

  const filteredFilings = userFilings.filter(item => 
    item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.asunto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mis-radicados-clean-wrapper">
      {/* Header Conciso */}
      <div className="page-header-clean">
        <div>
          <h2 className="page-title-clean">Mis Documentos Radicados</h2>
          <p className="page-subtitle-clean">
            Peticiones registradas a nombre de <strong>{user.name}</strong> ({user.email})
          </p>
        </div>

        <button type="button" className="btn-action-primary-clean" onClick={onFileNew}>
          <PlusCircle size={17} />
          <span>Radicar Nueva Petición</span>
        </button>
      </div>

      {/* Buscador Simple */}
      <div className="search-bar-clean">
        <Search size={18} className="search-icon-clean" />
        <input
          type="text"
          className="search-input-clean"
          placeholder="Buscar por radicado, asunto o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Lista / Grilla de Radicados */}
      {filteredFilings.length === 0 ? (
        <div className="empty-state-clean">
          <FileCheck size={42} color="#94a3b8" />
          <h4>No hay radicados encontrados</h4>
          <p>No se encontraron registros para tu búsqueda actual.</p>
          <button type="button" className="btn-action-primary-clean" onClick={onFileNew} style={{ marginTop: '0.75rem' }}>
            <PlusCircle size={16} />
            <span>Crear mi primer radicado</span>
          </button>
        </div>
      ) : (
        <div className="filings-grid-clean">
          {filteredFilings.map((item) => {
            const isResuelto = item.estado === 'Resuelto';

            return (
              <div key={item.id} className="filing-card-clean">
                <div className="filing-card-top">
                  <span className="filing-code-pill">{item.id}</span>
                  <span className={`status-pill ${isResuelto ? 'status-resuelto' : 'status-tramite'}`}>
                    {isResuelto ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    <span>{item.estado}</span>
                  </span>
                </div>

                <div className="filing-card-content">
                  <span className="filing-category-label">{item.categoria} • {item.tipoSolicitud}</span>
                  <h3 className="filing-title">{item.asunto}</h3>
                  <p className="filing-desc">{item.descripcion}</p>

                  {item.archivoAdjunto && (
                    <div className="filing-file-pill">
                      {item.archivoAdjunto.extension === 'pdf' ? (
                        <FileType2 size={15} color="#dc2626" />
                      ) : (
                        <FileCode size={15} color="#2563eb" />
                      )}
                      <span>{item.archivoAdjunto.nombre}</span>
                    </div>
                  )}
                </div>

                <div className="filing-card-bottom">
                  <span className="filing-date-text">
                    <Calendar size={13} />
                    <span>{item.fechaRadicacion}</span>
                  </span>

                  <button
                    type="button"
                    className="btn-view-cert-clean"
                    onClick={() => setSelectedRadicadoForModal(item)}
                  >
                    <Eye size={15} />
                    <span>Comprobante</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Comprobante Oficial */}
      {selectedRadicadoForModal && (
        <ComprobanteRadicacionModal
          radicado={selectedRadicadoForModal}
          onClose={() => setSelectedRadicadoForModal(null)}
          onViewMyFilings={() => setSelectedRadicadoForModal(null)}
          onFileNew={() => {
            setSelectedRadicadoForModal(null);
            onFileNew();
          }}
        />
      )}
    </div>
  );
};
export default MisRadicadosPage;
