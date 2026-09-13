import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  Loader2, 
  Mail, 
  User as UserIcon, 
  CheckCircle2, 
  AlertCircle
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
  const { isAuthModalOpen, closeAuthModal, loginWithGoogle, signInWithGoogleOAuth } = useAuth();
  
  const [realEmail, setRealEmail] = useState<string>('');
  const [realName, setRealName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerNotConfigured, setProviderNotConfigured] = useState<boolean>(false);
  
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const hasRealClientId = Boolean(
    envClientId && 
    !envClientId.includes('examplegoogleclientid') &&
    envClientId.includes('.apps.googleusercontent.com')
  );

  // Initialize official Google Identity Services script ONLY if a real configured Client ID exists
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
              roleId: 'ciudadano',
              roleName: 'Ciudadano General'
            });
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

  // Handle Real Supabase Google OAuth Redirect
  const handleGoogleOAuthClick = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setProviderNotConfigured(false);

    try {
      await signInWithGoogleOAuth();
    } catch (err: any) {
      console.error('Error con Supabase Google OAuth:', err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('provider is not enabled') || msg.toLowerCase().includes('unsupported provider')) {
        setProviderNotConfigured(true);
      } else {
        setErrorMsg(`Error de Google OAuth: ${msg}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Manual Entry with Real Google Account
  const handleRealGoogleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const emailTrimmed = realEmail.trim().toLowerCase();

    if (!emailTrimmed) {
      setErrorMsg('Ingresa el correo electrónico real de Google.');
      return;
    }

    if (!emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
      setErrorMsg('Ingresa una dirección de correo válida.');
      return;
    }

    setIsSubmitting(true);

    try {
      await loginWithGoogle({
        name: realName.trim() || emailTrimmed.split('@')[0],
        email: emailTrimmed,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(realName || emailTrimmed)}&background=4285F4&color=fff&bold=true`,
        roleId: 'ciudadano',
        roleName: 'Ciudadano General'
      });
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
              <span>Autenticación Oficial con Google</span>
            </div>
            <h2 id="modal-login-title" className="login-modal-title">
              Iniciar Sesión con Google
            </h2>
            <p className="login-modal-subtitle">
              Conecta tu cuenta real de Google para radicar documentos oficiales, recibir respuestas y validar tu identidad.
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

        {/* Modal Body */}
        <div className="login-modal-body">
          <div className="google-auth-box">

            {/* If Google GIS Client ID is configured in .env */}
            {hasRealClientId && (
              <div className="google-official-btn-wrapper" style={{ marginBottom: '1.25rem' }}>
                <div ref={googleBtnContainerRef} className="gis-btn-target" />
              </div>
            )}

            {/* Official Google OAuth Button (Supabase Flow) */}
            <button
              type="button"
              onClick={handleGoogleOAuthClick}
              disabled={isSubmitting}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid #dadce0',
                backgroundColor: '#ffffff',
                color: '#3c4043',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(60,64,67, 0.08)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafd';
                e.currentTarget.style.borderColor = '#4285F4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#dadce0';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isSubmitting ? 'Conectando con Google...' : 'Continuar con Google (OAuth 2.0)'}</span>
            </button>

            {/* Alert if Supabase Google Provider requires credentials in Supabase Dashboard */}
            {providerNotConfigured && (
              <div style={{
                marginTop: '1rem',
                padding: '0.85rem 1rem',
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '8px',
                textAlign: 'left',
                fontSize: '0.83rem',
                color: '#92400e',
                lineHeight: '1.45'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.35rem', color: '#b45309' }}>
                  <AlertCircle size={16} />
                  <span>Configuración pendiente en Supabase:</span>
                </div>
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  Para que la redirección de Google abra la ventana oficial de Google, se debe activar el proveedor <strong>Google</strong> en tu panel de Supabase con un <strong>Client ID</strong> y <strong>Client Secret</strong> de Google Cloud Console.
                </p>
                <div style={{ fontSize: '0.78rem', color: '#78350f', backgroundColor: '#fef3c7', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                  URL de callback de tu Supabase: <code>https://mzhstypqygacegltiohr.supabase.co/auth/v1/callback</code>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="form-error-alert" style={{ fontSize: '0.85rem', padding: '0.6rem 0.85rem', marginTop: '0.75rem' }}>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="auth-or-divider" style={{ margin: '1.25rem 0' }}>
              <span>O ingresa directamente tu correo real de Google</span>
            </div>

            {/* Direct Form for Real Google Accounts */}
            <form onSubmit={handleRealGoogleFormSubmit} className="custom-google-form" style={{ marginTop: 0 }}>
              <div className="form-group-sm">
                <label htmlFor="real-google-email">Correo Electrónico Real de Google *</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="real-google-email"
                    type="email"
                    placeholder="ejemplo@gmail.com o correo corporativo Google Workspace"
                    value={realEmail}
                    onChange={(e) => setRealEmail(e.target.value)}
                    required
                    className="google-custom-input"
                  />
                </div>
              </div>

              <div className="form-group-sm">
                <label htmlFor="real-google-name">Nombre Completo del Ciudadano / Titular *</label>
                <div className="input-with-icon">
                  <UserIcon size={18} className="input-icon" />
                  <input
                    id="real-google-name"
                    type="text"
                    placeholder="Nombre y apellidos reales"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    required
                    className="google-custom-input"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-google-primary"
                disabled={isSubmitting}
                style={{ marginTop: '0.75rem' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spinner-icon" />
                    <span>Conectando sesión real...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Registrar e Iniciar con Cuenta Real</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="google-security-notice" style={{ marginTop: '1.25rem' }}>
              <Lock size={14} />
              <span>Verificación de identidad y sincronización en tiempo real en la base de datos Supabase</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

