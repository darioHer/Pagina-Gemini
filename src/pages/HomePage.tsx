import React, { useState } from 'react';
import { 
  Building2, 
  Search, 
  PlusCircle, 
  ArrowRight, 
  FileType2, 
  FileCode, 
  Droplets, 
  Trash2, 
  Lightbulb, 
  Car, 
  Scale, 
  Clock, 
  FolderOpen, 
  Phone, 
  Lock,
  FileText,
  Shield,
  CheckCircle
} from 'lucide-react';
import type { RadicacionMode } from '../types/radicacion';
import { useAuth } from '../context/AuthContext';

export interface HomePageProps {
  onNavigateTab: (
    tab: 'inicio' | 'radicar' | 'mis-radicados' | 'consultas' | 'normativas' | 'admin', 
    options?: { mode?: RadicacionMode; category?: string; query?: string }
  ) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigateTab }) => {
  const { user, switchRole, openAuthModal } = useAuth();
  const [trackerInput, setTrackerInput] = useState<string>('');
  const [roleSwitching, setRoleSwitching] = useState(false);
  const [roleToast, setRoleToast] = useState<string | null>(null);

  const testRoles = [
    { id: 'admin', nombre: 'Administrador del Sistema', icon: '🛡️', badge: 'Acceso Total + APIs' },
    { id: 'funcionario_alcaldia', nombre: 'Funcionario de Atención', icon: '🏛️', badge: 'Revisión PQRS' },
    { id: 'analista_pqrs', nombre: 'Analista Técnico', icon: '🔧', badge: 'Gestión Servicios' },
    { id: 'secretario', nombre: 'Secretario Dependencia', icon: '📋', badge: 'Validación' },
    { id: 'ciudadano', nombre: 'Ciudadano General', icon: '👤', badge: 'Radicación Estándar' },
  ];

  const handleRoleChange = async (newRoleId: string, roleName: string) => {
    if (!user) {
      openAuthModal();
      return;
    }
    setRoleSwitching(true);
    await switchRole(newRoleId, roleName);
    setRoleSwitching(false);
    setRoleToast(`Rol cambiado a: ${roleName}`);
    setTimeout(() => setRoleToast(null), 3500);
  };

  const handleTrackerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = trackerInput.trim();
    if (query) {
      onNavigateTab('consultas', { query });
    } else {
      onNavigateTab('consultas');
    }
  };

  const categories = [
    {
      id: 'derecho_peticion',
      titulo: 'Derecho de Petición',
      categoriaDb: 'Derecho de Petición',
      icon: Scale,
      plazo: '15 días',
      descripcion: 'Acceso a información pública, expedientes y trámites administrativos generales.',
      colorClass: 'cat-peticion'
    },
    {
      id: 'agua_alcantarillado',
      titulo: 'Agua y Alcantarillado',
      categoriaDb: 'Agua y Alcantarillado',
      icon: Droplets,
      plazo: '15 días',
      descripcion: 'Reporte de fugas en la red matriz, suspensión del suministro y mantenimiento.',
      colorClass: 'cat-agua'
    },
    {
      id: 'recoleccion_basura',
      titulo: 'Recolección de Basura',
      categoriaDb: 'Recolección de Basura',
      icon: Trash2,
      plazo: '8 días',
      descripcion: 'Rutas de limpia, reporte de acumulación de residuos y escombros en vía pública.',
      colorClass: 'cat-basura'
    },
    {
      id: 'alumbrado_publico',
      titulo: 'Alumbrado Público',
      categoriaDb: 'Alumbrado Público',
      icon: Lightbulb,
      plazo: '10 días',
      descripcion: 'Mantenimiento de luminarias apagadas, fotoceldas y postes con riesgo estructural.',
      colorClass: 'cat-alumbrado'
    },
    {
      id: 'transito_movilidad',
      titulo: 'Tránsito y Movilidad',
      categoriaDb: 'Tránsito y Movilidad',
      icon: Car,
      plazo: '15 días',
      descripcion: 'Peticiones sobre malla vial, bacheo, señalización y semaforización de calles.',
      colorClass: 'cat-transito'
    }
  ];

  return (
    <div className="home-clean-layout">
      {/* NOTIFICACIÓN TOAST DE CAMBIO DE ROL */}
      {roleToast && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '1.5rem',
          zIndex: 9999,
          background: '#003399',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle size={18} color="#4ade80" />
          <span>{roleToast}</span>
        </div>
      )}

      {/* BANNER DE PRUEBAS: CAMBIO RÁPIDO DE ROL DEL USUARIO */}
      <section style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
        border: '1px solid #bfdbfe',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 6px rgba(0, 51, 153, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🧪</span>
            <div>
              <strong style={{ fontSize: '0.95rem', color: '#1e3a8a' }}>Selector de Roles para Pruebas (Gobernanza)</strong>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                {user ? (
                  <>Usuario activo: <strong>{user.name}</strong> • Rol actual: <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>{user.roleName || user.roleId}</span></>
                ) : (
                  <>Inicia sesión para alternar y probar los permisos de cada rol en Supabase</>
                )}
              </div>
            </div>
          </div>

          {user && (user.roleId === 'admin' || user.roleId === 'administrador' || user.roleId === 'admin_municipal') && (
            <button
              type="button"
              onClick={() => onNavigateTab('admin')}
              style={{
                background: '#003399',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Shield size={14} />
              <span>Abrir Panel Admin</span>
            </button>
          )}
        </div>

        {/* Botones de roles para pruebas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
          {testRoles.map((r) => {
            const isActive = user?.roleId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                disabled={roleSwitching}
                onClick={() => handleRoleChange(r.id, r.nombre)}
                style={{
                  padding: '0.6rem 0.75rem',
                  borderRadius: '8px',
                  border: isActive ? '2px solid #003399' : '1px solid #cbd5e1',
                  background: isActive ? '#ffffff' : '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: isActive ? '0 2px 8px rgba(0,51,153,0.15)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{r.icon}</span>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.83rem', fontWeight: isActive ? 700 : 600, color: isActive ? '#003399' : '#334155', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {r.nombre}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: isActive ? '#2563eb' : '#64748b' }}>
                    {r.badge}
                  </div>
                </div>
                {isActive && <span style={{ marginLeft: 'auto', color: '#003399', fontWeight: 'bold' }}>✓</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* 1. HERO COMPACTO Y MODERNO */}
      <section className="hero-clean-card">
        <div className="hero-clean-header-badge">
          <Building2 size={15} />
          <span>Ventanilla Única de Radicación Ciudadana</span>
        </div>

        <h1 className="hero-clean-title">
          Atención y Radicación Oficial de Peticiones
        </h1>

        <p className="hero-clean-subtitle">
          Presenta tus derechos de petición, quejas y reclamos de manera 100% digital, con firma electrónica verificable y seguimiento en tiempo real.
        </p>

        {/* Buscador Rápido de Estado */}
        <form className="hero-tracker-box" onSubmit={handleTrackerSubmit}>
          <div className="hero-tracker-inner">
            <Search size={18} className="tracker-search-icon" />
            <input
              type="text"
              className="hero-tracker-field"
              placeholder="Ingresa tu número de radicado (ej: RAD-2026-...) o cédula..."
              value={trackerInput}
              onChange={(e) => setTrackerInput(e.target.value)}
            />
            <button type="submit" className="hero-tracker-submit-btn">
              <span>Consultar</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>

        {/* Botones de Acción Primaria */}
        <div className="hero-buttons-group">
          <button
            type="button"
            className="hero-cta-btn primary"
            onClick={() => onNavigateTab('radicar')}
          >
            <PlusCircle size={18} />
            <span>Radicar Petición</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            className="hero-cta-btn secondary"
            onClick={() => onNavigateTab('mis-radicados')}
          >
            <FolderOpen size={18} />
            <span>Mis Radicados</span>
          </button>
        </div>
      </section>

      {/* 2. CATÁLOGO DE SERVICIOS MUNICIPALES (5 DEPENDENCIAS) */}
      <section className="home-section-clean">
        <div className="section-title-clean-row">
          <div>
            <h2 className="section-title-clean">Servicios y Dependencias</h2>
            <p className="section-subtitle-clean">Selecciona el área para radicar directamente tu solicitud:</p>
          </div>
        </div>

        <div className="services-grid-clean">
          {categories.map((cat) => {
            const IconComp = cat.icon;
            return (
              <div key={cat.id} className="service-card-clean">
                <div className="service-card-top-row">
                  <div className="service-icon-box">
                    <IconComp size={22} />
                  </div>
                  <span className="service-term-pill">
                    <Clock size={12} />
                    <span>{cat.plazo}</span>
                  </span>
                </div>

                <h3 className="service-card-title">{cat.titulo}</h3>
                <p className="service-card-desc">{cat.descripcion}</p>

                <button
                  type="button"
                  className="service-card-action-btn"
                  onClick={() => onNavigateTab('radicar', { category: cat.categoriaDb })}
                >
                  <span>Radicar aquí</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. FORMATOS DE PRESENTACIÓN Y RUTA EN 4 PASOS */}
      <div className="home-dual-cards-row">
        {/* Formatos */}
        <div className="clean-info-box">
          <h3 className="info-box-title">Formatos Admitidos</h3>
          <p className="info-box-desc">Puedes radicar tu petición en cualquiera de estas 3 modalidades:</p>

          <div className="format-pills-list">
            <div 
              className="format-pill-item"
              onClick={() => onNavigateTab('radicar', { mode: 'escrito' })}
            >
              <FileText size={18} color="#003399" />
              <div>
                <strong>Redactar en Línea</strong>
                <span>Formulario guiado con plantillas oficiales</span>
              </div>
            </div>

            <div 
              className="format-pill-item"
              onClick={() => onNavigateTab('radicar', { mode: 'pdf' })}
            >
              <FileType2 size={18} color="#dc2626" />
              <div>
                <strong>Archivo PDF (.pdf)</strong>
                <span>Documentos firmados o escaneados</span>
              </div>
            </div>

            <div 
              className="format-pill-item"
              onClick={() => onNavigateTab('radicar', { mode: 'word' })}
            >
              <FileCode size={18} color="#2563eb" />
              <div>
                <strong>Archivo Word (.docx)</strong>
                <span>Documentos editables con anexos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Proceso en 4 Pasos */}
        <div className="clean-info-box">
          <h3 className="info-box-title">¿Cómo Funciona?</h3>
          <p className="info-box-desc">Ruta ágil de atención ciudadana:</p>

          <div className="steps-compact-list">
            <div className="step-compact-item">
              <span className="step-num">1</span>
              <div>
                <strong>Identificación</strong>
                <span>Ingresa con Google o tus datos personales</span>
              </div>
            </div>

            <div className="step-compact-item">
              <span className="step-num">2</span>
              <div>
                <strong>Radicación</strong>
                <span>Carga tu archivo o redacta el contenido</span>
              </div>
            </div>

            <div className="step-compact-item">
              <span className="step-num">3</span>
              <div>
                <strong>Comprobante</strong>
                <span>Recibe tu número de radicado con firma SHA-256</span>
              </div>
            </div>

            <div className="step-compact-item">
              <span className="step-num">4</span>
              <div>
                <strong>Respuesta Oficial</strong>
                <span>Seguimiento y notificación dentro del plazo legal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. BARRA DISCRETA DE CONTACTO Y SEGURIDAD */}
      <footer className="home-clean-footer-strip">
        <div className="footer-strip-item">
          <Phone size={16} />
          <span>Línea Gratuita: <strong>01-8000-911-MUNICIPIO</strong></span>
        </div>
        <div className="footer-strip-item">
          <Building2 size={16} />
          <span>Atención Presencial: <strong>CAM - Torre A</strong> (8:00 AM - 5:00 PM)</span>
        </div>
        <div className="footer-strip-item">
          <Lock size={16} />
          <span>Protección de Datos conforme a la Ley 1581</span>
        </div>
      </footer>
    </div>
  );
};
export default HomePage;
