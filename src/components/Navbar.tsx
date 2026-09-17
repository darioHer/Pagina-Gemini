import React, { useState } from 'react';
import { 
  Building2, 
  Search, 
  LogOut, 
  PlusCircle, 
  FolderOpen,
  ChevronDown,
  BookOpen,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: 'inicio' | 'radicar' | 'mis-radicados' | 'consultas' | 'normativas' | 'admin';
  setActiveTab: (tab: 'inicio' | 'radicar' | 'mis-radicados' | 'consultas' | 'normativas' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, openAuthModal, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);

  return (
    <header className="navbar-institucional-wrapper">
      {/* Top Banner Bar */}
      <div className="top-bar-institucional">
        <div className="top-bar-branding">
          <Building2 size={15} />
          <span>Alcaldía Municipal • Ventanilla Única de Atención</span>
        </div>
        <div className="top-bar-right">
          <span className="top-bar-badge">Portal Oficial</span>
        </div>
      </div>

      {/* Main Header Container */}
      <div className="header-institucional-main">
        <div className="header-main-content">
          {/* Logo & Title */}
          <div className="header-branding-group">
            <h1 className="header-main-title">
              Portal de Trámites y Radicación
            </h1>
          </div>

          {/* User Auth Action & Profile Pill */}
          <div className="header-auth-section">
            {!user ? (
              <button 
                type="button" 
                className="btn-header-login" 
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
            ) : (
              <div className="user-profile-dropdown-wrapper">
                <button
                  type="button"
                  className="user-profile-pill"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                  <img src={user.avatar} alt={user.name} className="user-avatar-img" />
                  <div className="user-pill-info">
                    <span className="user-pill-name">{user.name}</span>
                    <span className="user-pill-provider">
                      Rol: {user.roleName || 'Ciudadano General'}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`chevron-icon ${showProfileMenu ? 'rotate' : ''}`} />
                </button>

                {showProfileMenu && (
                  <div className="profile-dropdown-menu">
                    <div className="menu-user-header">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                      <span className="menu-badge-provider" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
                        <Shield size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        Rol: {user.roleName || 'Ciudadano General'}
                      </span>
                    </div>

                    <div className="menu-divider" />

                    <button
                      type="button"
                      className="menu-item-btn"
                      onClick={() => {
                        setActiveTab('mis-radicados');
                        setShowProfileMenu(false);
                      }}
                    >
                      <FolderOpen size={16} />
                      <span>Mis Documentos Radicados</span>
                    </button>

                    <button
                      type="button"
                      className="menu-item-btn"
                      onClick={() => {
                        setActiveTab('radicar');
                        setShowProfileMenu(false);
                      }}
                    >
                      <PlusCircle size={16} />
                      <span>Radicar Nueva Petición</span>
                    </button>

                    <button
                      type="button"
                      className="menu-item-btn"
                      onClick={() => {
                        setActiveTab('normativas');
                        setShowProfileMenu(false);
                      }}
                    >
                      <BookOpen size={16} />
                      <span>Normativas y Políticas Supabase</span>
                    </button>

                    {(user?.roleId === 'admin' || user?.roleId === 'administrador' || user?.roleId === 'admin_municipal') && (
                      <button
                        type="button"
                        className="menu-item-btn"
                        style={{ color: '#b45309', fontWeight: 600 }}
                        onClick={() => {
                          setActiveTab('admin');
                          setShowProfileMenu(false);
                        }}
                      >
                        <Shield size={16} color="#b45309" />
                        <span>Panel Administrativo</span>
                      </button>
                    )}

                    <div className="menu-divider" />

                    <button
                      type="button"
                      className="menu-item-btn btn-menu-logout"
                      onClick={() => {
                        logout();
                        setShowProfileMenu(false);
                      }}
                    >
                      <LogOut size={16} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Primary Navigation Bar */}
        <nav className="header-nav-bar" aria-label="Navegación principal">
          <button
            type="button"
            className={`nav-link-btn ${activeTab === 'inicio' ? 'active' : ''}`}
            onClick={() => setActiveTab('inicio')}
          >
            <Building2 size={17} />
            <span>Inicio</span>
          </button>

          <button
            type="button"
            className={`nav-link-btn nav-link-highlight ${activeTab === 'radicar' ? 'active' : ''}`}
            onClick={() => setActiveTab('radicar')}
          >
            <PlusCircle size={17} />
            <span>Radicar Petición</span>
          </button>

          <button
            type="button"
            className={`nav-link-btn ${activeTab === 'mis-radicados' ? 'active' : ''}`}
            onClick={() => setActiveTab('mis-radicados')}
          >
            <FolderOpen size={17} />
            <span>Mis Radicados</span>
          </button>

          <button
            type="button"
            className={`nav-link-btn ${activeTab === 'normativas' ? 'active' : ''}`}
            onClick={() => setActiveTab('normativas')}
          >
            <BookOpen size={17} color={activeTab === 'normativas' ? '#003399' : '#ffffff'} />
            <span>Normatividad</span>
          </button>

          <button
            type="button"
            className={`nav-link-btn ${activeTab === 'consultas' ? 'active' : ''}`}
            onClick={() => setActiveTab('consultas')}
          >
            <Search size={17} />
            <span>Consultar Estado</span>
          </button>

          {(user?.roleId === 'admin' || user?.roleId === 'administrador' || user?.roleId === 'admin_municipal') && (
            <button
              type="button"
              className={`nav-link-btn ${activeTab === 'admin' ? 'active' : ''}`}
              style={{ backgroundColor: activeTab === 'admin' ? '#ffffff' : 'rgba(255, 193, 7, 0.25)', color: activeTab === 'admin' ? '#b45309' : '#fff', fontWeight: 600 }}
              onClick={() => setActiveTab('admin')}
            >
              <Shield size={17} />
              <span>Panel Admin</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
