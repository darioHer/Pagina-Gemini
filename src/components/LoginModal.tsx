import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  Loader2, 
  Mail, 
  User as UserIcon, 
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Extend Window interface for Google Identity Services script
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement | null, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function parseGoogleJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding Google JWT:', e);
    return null;
  }
}

export const LoginModal: React.FC = () => {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    loginWithGoogle, 
    signInWithGoogleOAuth,
    signInWithEmail,
    signUpWithEmail,
    resetPassword
  } = useAuth();
  
  // Tab state: 'signin' | 'signup' | 'forgot'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Form states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [documentId, setDocumentId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDemoPicker, setShowDemoPicker] = useState<boolean>(false);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const hasRealClientId = Boolean(
    envClientId && 
    !envClientId.includes('examplegoogleclientid') &&
    envClientId.includes('.apps.googleusercontent.com')
  );

  useEffect(() => {
    if (!isAuthModalOpen || !hasRealClientId) return;

    const handleGoogleResponse = (response: { credential: string }) => {
      if (response && response.credential) {
        const payload = parseGoogleJwt(response.credential);
        if (payload && payload.email) {
          setIsSubmitting(true);
          setTimeout(() => {
            loginWithGoogle({
              name: payload.name || payload.given_name || payload.email.split('@')[0],
              email: payload.email,
              avatar: payload.picture,
              subId: payload.sub,
              roleId: 'usuario_normal',
              roleName: 'Usuario Normal'
            }).catch((err) => setErrorMsg(err.message));
            setIsSubmitting(false);
          }, 500);
        }
      }
    };

    if (window.google?.accounts?.id && envClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: envClientId,
          callback: handleGoogleResponse
        });

        if (googleBtnContainerRef.current) {
          googleBtnContainerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 320,
            locale: 'es'
          });
        }
      } catch (e) {
        console.warn('Google Identity Services init notice:', e);
      }
    }
  }, [isAuthModalOpen, hasRealClientId, envClientId]);

  if (!isAuthModalOpen) return null;

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor ingresa tu correo electrónico y contraseña.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim() || !name.trim()) {
      setErrorMsg('Por favor completa los campos obligatorios (*).');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signUpWithEmail(email, password, name, documentId, phone);
      setSuccessMsg('Cuenta creada exitosamente. Has iniciado sesión.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la cuenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Ingresa tu correo registrado para enviar las instrucciones.');
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setSuccessMsg('Se ha enviado un correo con instrucciones para restablecer tu contraseña.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al enviar correo de recuperación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (selectedRole: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const roleMap: Record<string, { name: string; email: string; roleName: string }> = {
      admin: { name: 'Carlos Administrador', email: 'admin.sistema@alcaldia.gov.co', roleName: 'Administrador' },
      gobernanza: { name: 'Elena Gobernanza', email: 'elena.gobernanza@alcaldia.gov.co', roleName: 'Gobernanza' },
      revisor: { name: 'Roberto Validador', email: 'roberto.revisor@alcaldia.gov.co', roleName: 'Revisor / Validador' },
      usuario_normal: { name: 'María Ciudadana', email: 'maria.ciudadana@gmail.com', roleName: 'Usuario Normal' }
    };

    const target = roleMap[selectedRole] || roleMap.usuario_normal;

    try {
      await loginWithGoogle({
        name: target.name,
        email: target.email,
        roleId: selectedRole,
        roleName: target.roleName,
        documentId: '1098765432',
        phone: '300 555 0192'
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al ingresar con perfil de prueba.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={closeAuthModal}>
      <div 
        className="login-modal-card" 
        onClick={(e) => e.stopPropagation()}
        role="dialog" 
        aria-modal="true"
        aria-labelledby="modal-login-title"
      >
        {/* Modal Header */}
        <div className="login-modal-header">
          <div className="login-modal-title-group">
            <div className="login-badge-institucional">
              <ShieldCheck size={16} />
              <span>Plataforma Oficial de Usuarios & Permisos</span>
            </div>
            <h2 id="modal-login-title" className="login-modal-title">
              {activeTab === 'signin' ? 'Iniciar Sesión' : activeTab === 'signup' ? 'Registro de Usuario' : 'Recuperar Contraseña'}
            </h2>
            <p className="login-modal-subtitle">
              Acceso seguro integrado con Supabase Auth y Google OAuth 2.0.
            </p>
          </div>
          <button 
            type="button" 
            className="login-close-btn" 
            onClick={closeAuthModal} 
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.75rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: 'none',
              borderBottom: activeTab === 'signin' ? '2px solid #2563eb' : '2px solid transparent',
              backgroundColor: activeTab === 'signin' ? '#ffffff' : 'transparent',
              color: activeTab === 'signin' ? '#2563eb' : '#6b7280',
              cursor: 'pointer'
            }}
            onClick={() => { setActiveTab('signin'); setErrorMsg(null); setSuccessMsg(null); }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.75rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: 'none',
              borderBottom: activeTab === 'signup' ? '2px solid #2563eb' : '2px solid transparent',
              backgroundColor: activeTab === 'signup' ? '#ffffff' : 'transparent',
              color: activeTab === 'signup' ? '#2563eb' : '#6b7280',
              cursor: 'pointer'
            }}
            onClick={() => { setActiveTab('signup'); setErrorMsg(null); setSuccessMsg(null); }}
          >
            Registrarse
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.75rem',
              fontWeight: 600,
              fontSize: '0.85rem',
              border: 'none',
              borderBottom: activeTab === 'forgot' ? '2px solid #2563eb' : '2px solid transparent',
              backgroundColor: activeTab === 'forgot' ? '#ffffff' : 'transparent',
              color: activeTab === 'forgot' ? '#2563eb' : '#6b7280',
              cursor: 'pointer'
            }}
            onClick={() => { setActiveTab('forgot'); setErrorMsg(null); setSuccessMsg(null); }}
          >
            Recuperar
          </button>
        </div>

        {/* Modal Body */}
        <div className="login-modal-body" style={{ padding: '1.25rem 1.5rem' }}>
          
          {errorMsg && (
            <div className="form-error-alert" style={{ fontSize: '0.85rem', padding: '0.65rem 0.85rem', marginBottom: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px' }}>
              <span>⚠️ {errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ fontSize: '0.85rem', padding: '0.65rem 0.85rem', marginBottom: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '6px' }}>
              <span>✅ {successMsg}</span>
            </div>
          )}

          {/* TAB 1: INICIAR SESIÓN */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group-sm">
                <label htmlFor="signin-email" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Correo Electrónico *</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="signin-email"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="google-custom-input"
                  />
                </div>
              </div>

              <div className="form-group-sm">
                <label htmlFor="signin-password" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Contraseña *</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="google-custom-input"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-google-primary"
                disabled={isSubmitting}
                style={{ marginTop: '0.5rem' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spinner-icon" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Ingresar a la Plataforma</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setActiveTab('forgot')}
                >
                  ¿Olvidaste tu contraseña? Restablécela aquí.
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTRARSE */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group-sm">
                <label htmlFor="signup-name" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Nombre Completo *</label>
                <div className="input-with-icon">
                  <UserIcon size={18} className="input-icon" />
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="Nombre y apellidos"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="google-custom-input"
                  />
                </div>
              </div>

              <div className="form-group-sm">
                <label htmlFor="signup-email" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Correo Electrónico *</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="signup-email"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="google-custom-input"
                  />
                </div>
              </div>

              <div className="form-group-sm">
                <label htmlFor="signup-password" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Contraseña * (mínimo 6 caracteres)</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="google-custom-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group-sm">
                  <label htmlFor="signup-doc" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Cédula / ID</label>
                  <input
                    id="signup-doc"
                    type="text"
                    placeholder="Ej: 1098765432"
                    value={documentId}
                    onChange={(e) => setDocumentId(e.target.value)}
                    className="google-custom-input"
                  />
                </div>
                <div className="form-group-sm">
                  <label htmlFor="signup-phone" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Teléfono</label>
                  <input
                    id="signup-phone"
                    type="text"
                    placeholder="Ej: 300 555 0192"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="google-custom-input"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-google-primary"
                disabled={isSubmitting}
                style={{ marginTop: '0.5rem' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spinner-icon" />
                    <span>Creando cuenta...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Crear Cuenta en Supabase Auth</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: RECUPERAR CONTRASEÑA */}
          {activeTab === 'forgot' && (
            <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.4' }}>
                Ingresa la dirección de correo electrónico asociada a tu cuenta. Te enviaremos un enlace oficial de Supabase Auth para restablecer tu contraseña.
              </p>

              <div className="form-group-sm">
                <label htmlFor="forgot-email" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Correo Registrado *</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="google-custom-input"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-google-primary"
                disabled={isSubmitting}
                style={{ marginTop: '0.5rem' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spinner-icon" />
                    <span>Enviando correo...</span>
                  </>
                ) : (
                  <>
                    <Mail size={18} />
                    <span>Enviar Enlace de Recuperación</span>
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer' }}
                  onClick={() => setActiveTab('signin')}
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </form>
          )}

          {/* DIVIDER & GOOGLE OAUTH */}
          <div className="auth-or-divider" style={{ margin: '1rem 0 0.75rem 0' }}>
            <span>O continuar con acceso directo</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={signInWithGoogleOAuth}
              disabled={isSubmitting}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: '6px',
                border: '1px solid #dadce0',
                backgroundColor: '#ffffff',
                color: '#3c4043',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continuar con Google OAuth 2.0</span>
            </button>

            {/* TOGGLE QUICK DEMO ROLES */}
            <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setShowDemoPicker(!showDemoPicker)}
              >
                {showDemoPicker ? '▲ Ocultar perfiles de prueba de roles' : '⚡ Probar roles rápidamente (Acceso Demo)'}
              </button>

              {showDemoPicker && (
                <div style={{ marginTop: '0.5rem', padding: '0.65rem', backgroundColor: '#f3f4f6', borderRadius: '6px', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.4rem' }}>
                    Selecciona un Rol para probar el sistema:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                    <button
                      type="button"
                      style={{ padding: '0.4rem', fontSize: '0.75rem', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => handleDemoLogin('admin')}
                    >
                      👑 Administrador
                    </button>
                    <button
                      type="button"
                      style={{ padding: '0.4rem', fontSize: '0.75rem', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => handleDemoLogin('gobernanza')}
                    >
                      ⚖️ Gobernanza
                    </button>
                    <button
                      type="button"
                      style={{ padding: '0.4rem', fontSize: '0.75rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => handleDemoLogin('revisor')}
                    >
                      🔍 Revisor/Validador
                    </button>
                    <button
                      type="button"
                      style={{ padding: '0.4rem', fontSize: '0.75rem', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => handleDemoLogin('usuario_normal')}
                    >
                      👤 Usuario Normal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

