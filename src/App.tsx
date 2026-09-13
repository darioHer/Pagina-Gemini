import { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar, type NavTab } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { RadicarDocumentoForm } from './components/RadicarDocumentoForm';
import { ComprobanteRadicacionModal } from './components/ComprobanteRadicacionModal';
import { MisRadicadosPage } from './components/MisRadicadosPage';
import { AdminPanelPage } from './components/AdminPanelPage';
import { HomePage } from './pages/HomePage';
import { ConsultasPage } from './pages/ConsultasPage';
import { NormativasPage } from './pages/NormativasPage';
import { DetalleConsultaPage } from './pages/DetalleConsultaPage';
import type { DocumentoRadicado, RadicacionMode } from './types/radicacion';

const STORAGE_RADICADOS_KEY = 'portal_municipal_radicados_db';

function MainAppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>('inicio');
  const [selectedRadicadoId, setSelectedRadicadoId] = useState<string | null>(null);
  const [preselectedMode, setPreselectedMode] = useState<RadicacionMode>('escrito');
  const [preselectedCategory, setPreselectedCategory] = useState<string>('Agua y Alcantarillado');
  const [consultasSearchTerm, setConsultasSearchTerm] = useState<string>('');
  
  // Custom radicados list
  const [radicadosList, setRadicadosList] = useState<DocumentoRadicado[]>([]);
  const [recentCompletedRadicado, setRecentCompletedRadicado] = useState<DocumentoRadicado | null>(null);

  // Initial demo data + localStorage loading
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_RADICADOS_KEY);
      if (saved) {
        setRadicadosList(JSON.parse(saved));
      } else {
        // Sample default filing
        const initialSample: DocumentoRadicado[] = [
          {
            id: 'RAD-2026-10492',
            solicitante: 'Carlos Mendoza',
            emailSolicitante: 'carlos.mendoza@gmail.com',
            cedulaSolicitante: '1098765432',
            telefonoSolicitante: '300 555 0192',
            categoria: 'Agua y Alcantarillado',
            tipoSolicitud: 'Derecho de Petición',
            modoRadicacion: 'pdf',
            asunto: 'Solicitud de intervención por fuga de agua en Calle 45',
            descripcion: 'Adjunto documento PDF firmado solicitando mantenimiento preventivo de la tubería colectora.',
            archivoAdjunto: {
              nombre: 'Solicitud_Fuga_Agua_Firmada.pdf',
              tipo: 'PDF',
              tamano: '1.45 MB',
              extension: 'pdf'
            },
            estado: 'En trámite',
            fechaRadicacion: '2026-09-10 09:30',
            plazoLegal: '15 días hábiles',
            respuestaOficial: 'Solicitud asignada a la Dirección de Servicios Públicos y Alcantarillado.',
            hashSeguridad: '8F9A2B3C1D',
            proveedorAuth: 'google'
          },
          {
            id: 'RAD-2026-10493',
            solicitante: 'Carlos Mendoza',
            emailSolicitante: 'carlos.mendoza@gmail.com',
            cedulaSolicitante: '1098765432',
            telefonoSolicitante: '300 555 0192',
            categoria: 'Alumbrado Público',
            tipoSolicitud: 'Queja',
            modoRadicacion: 'word',
            asunto: 'Reporte técnico por fallo en circuito de luminarias LED',
            descripcion: 'Adjunto archivo de Word con el informe fotográfico del estado de los postes.',
            archivoAdjunto: {
              nombre: 'Reporte_Alumbrado_Luminarias.docx',
              tipo: 'DOCX',
              tamano: '2.10 MB',
              extension: 'docx'
            },
            estado: 'Resuelto',
            fechaRadicacion: '2026-09-02 14:15',
            plazoLegal: '10 días hábiles',
            respuestaOficial: 'Cuadrilla sustituyó fotocelda y restableció iluminación.',
            hashSeguridad: '7A4B1C9D2E',
            proveedorAuth: 'google'
          }
        ];
        setRadicadosList(initialSample);
        localStorage.setItem(STORAGE_RADICADOS_KEY, JSON.stringify(initialSample));
      }
    } catch (e) {
      console.error('Error initializing radicados store:', e);
    }
  }, []);

  // Sync to local storage
  const saveRadicados = (newList: DocumentoRadicado[]) => {
    setRadicadosList(newList);
    try {
      localStorage.setItem(STORAGE_RADICADOS_KEY, JSON.stringify(newList));
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  };

  const handleRadicacionSuccess = (newRadicado: DocumentoRadicado) => {
    const updated = [newRadicado, ...radicadosList];
    saveRadicados(updated);
    setRecentCompletedRadicado(newRadicado);
  };

  const handleNavigateTab = (
    tab: NavTab,
    options?: { mode?: RadicacionMode; category?: string; query?: string }
  ) => {
    if (options?.mode) setPreselectedMode(options.mode);
    if (options?.category) setPreselectedCategory(options.category);
    if (options?.query !== undefined) setConsultasSearchTerm(options.query);
    setSelectedRadicadoId(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      {/* Global Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={(tab) => {
        handleNavigateTab(tab);
      }} />

      {/* Global Auth Modal for Google & Email/Password */}
      <LoginModal />

      {/* Main Content Area */}
      <main className="main-content">
        {selectedRadicadoId ? (
          <DetalleConsultaPage 
            id={selectedRadicadoId} 
            onBack={() => setSelectedRadicadoId(null)} 
          />
        ) : activeTab === 'radicar' ? (
          <RadicarDocumentoForm 
            onSuccessRadicado={handleRadicacionSuccess} 
            initialMode={preselectedMode}
            initialCategory={preselectedCategory}
          />
        ) : activeTab === 'mis-radicados' ? (
          <MisRadicadosPage 
            radicadosList={radicadosList} 
            onFileNew={() => handleNavigateTab('radicar')} 
          />
        ) : activeTab === 'normativas' ? (
          <NormativasPage />
        ) : activeTab === 'consultas' ? (
          <ConsultasPage 
            initialSearchTerm={consultasSearchTerm}
            onSelectRadicado={(id) => setSelectedRadicadoId(id)} 
          />
        ) : activeTab === 'admin-usuarios' ? (
          <AdminPanelPage />
        ) : (
          <HomePage onNavigateTab={handleNavigateTab} />
        )}
      </main>

      {/* Certificate Modal if a filing was just completed */}
      {recentCompletedRadicado && (
        <ComprobanteRadicacionModal
          radicado={recentCompletedRadicado}
          onClose={() => setRecentCompletedRadicado(null)}
          onViewMyFilings={() => {
            setRecentCompletedRadicado(null);
            handleNavigateTab('mis-radicados');
          }}
          onFileNew={() => {
            setRecentCompletedRadicado(null);
            handleNavigateTab('radicar');
          }}
        />
      )}

      {/* Footer */}
      <footer className="footer-institucional">
        <div className="footer-content">
          <p className="footer-branding">Alcaldía Municipal • Ventanilla Única de Atención Ciudadana</p>
          <p>© 2026 Todos los derechos reservados. Plataforma Oficial de Radicación y Trámites Electrónicos.</p>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

export default App;
