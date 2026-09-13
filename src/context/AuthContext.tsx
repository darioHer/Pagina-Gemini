import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types/radicacion';
import { upsertUser } from '../services/supabaseService';
import { supabase } from '../lib/supabase';

interface GoogleProfileData {
  name: string;
  email: string;
  avatar?: string;
  subId?: string;
  documentId?: string;
  phone?: string;
  roleId?: string;
  roleName?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthModalOpen: boolean;
  openAuthModal: (onSuccessCallback?: () => void) => void;
  closeAuthModal: () => void;
  loginWithGoogle: (profile: GoogleProfileData) => Promise<void>;
  signInWithGoogleOAuth: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, documentId?: string, phone?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  executeAfterAuth: (action: () => void) => void;
  refreshUserSession: () => Promise<void>;
}

const STORAGE_KEY = 'portal_municipal_google_user_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  // Helper to sync Supabase Auth session user
  const syncSupabaseAuthUser = async (sessionUser: any) => {
    const userMeta = sessionUser.user_metadata || {};
    const realEmail = sessionUser.email || '';
    const realName = userMeta.full_name || userMeta.name || realEmail.split('@')[0];
    const realAvatar = userMeta.avatar_url || userMeta.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(realName)}&background=4285F4&color=fff&bold=true`;

    const initialUser: User = {
      id: sessionUser.id,
      name: realName,
      email: realEmail,
      avatar: realAvatar,
      provider: sessionUser.app_metadata?.provider === 'google' ? 'google' : 'email',
      documentId: userMeta.document_id || '',
      phone: userMeta.phone || '',
      googleSubId: sessionUser.id,
      roleId: 'usuario_normal',
      roleName: 'Usuario Normal',
      estado: 'activo'
    };

    const synced = await upsertUser(initialUser, 'usuario_normal');

    if (synced.estado === 'inactivo') {
      await supabase.auth.signOut();
      saveUserSession(null);
      throw new Error('Su cuenta ha sido desactivada por el administrador. Póngase en contacto con soporte.');
    }

    saveUserSession(synced);
    return synced;
  };

  // Refresh user session from database
  const refreshUserSession = async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncSupabaseAuthUser(session.user);
      }
    } catch (e) {
      console.warn('Notice refreshing session:', e);
    }
  };

  // Restore session and listen to Supabase OAuth redirects
  useEffect(() => {
    // 1. Check local storage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: User = JSON.parse(saved);
        if (parsed.estado === 'inactivo') {
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
        } else {
          setUser(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading session:', e);
    }

    // 2. Check Supabase active session (handles OAuth callback redirect)
    supabase.auth.getSession().then(({ data }: { data: { session: any } }) => {
      if (data?.session?.user) {
        syncSupabaseAuthUser(data.session.user).catch((err) => {
          console.warn('Session sync notice:', err.message);
        });
      }
    }).catch((err: any) => {
      console.warn('Supabase getSession notice:', err);
    });

    // 3. Listen to real-time auth changes (OAuth login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (session?.user) {
        syncSupabaseAuthUser(session.user).catch((err) => {
          console.warn('Auth state change notice:', err.message);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const saveUserSession = (userData: User | null) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const openAuthModal = (onSuccessCallback?: () => void) => {
    if (onSuccessCallback) {
      setPendingCallback(() => onSuccessCallback);
    } else {
      setPendingCallback(null);
    }
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setPendingCallback(null);
  };

  // Signup with Email / Password via Supabase Auth
  const signUpWithEmail = async (email: string, password: string, name: string, documentId?: string, phone?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          document_id: documentId || '',
          phone: phone || ''
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      const newUser: User = {
        id: data.user.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4285F4&color=fff&bold=true`,
        provider: 'email',
        documentId: documentId || '',
        phone: phone || '',
        roleId: 'usuario_normal',
        roleName: 'Usuario Normal',
        estado: 'activo'
      };

      const synced = await upsertUser(newUser, 'usuario_normal');
      saveUserSession(synced);
      setIsAuthModalOpen(false);

      if (pendingCallback) {
        pendingCallback();
        setPendingCallback(null);
      }
    }
  };

  // Sign in with Email / Password via Supabase Auth
  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) {
      throw new Error(error.message === 'Invalid login credentials' ? 'Correo electrónico o contraseña incorrectos.' : error.message);
    }

    if (data.user) {
      await syncSupabaseAuthUser(data.user);
      setIsAuthModalOpen(false);

      if (pendingCallback) {
        pendingCallback();
        setPendingCallback(null);
      }
    }
  };

  // Password Recovery via Supabase Auth
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const loginWithGoogle = async (profile: GoogleProfileData) => {
    const avatarUrl = profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || profile.email)}&background=4285F4&color=fff&bold=true`;
    const targetRoleId = profile.roleId || 'usuario_normal';
    const targetRoleName = profile.roleName || (targetRoleId === 'admin' ? 'Administrador' : targetRoleId === 'gobernanza' ? 'Gobernanza' : targetRoleId === 'revisor' ? 'Revisor / Validador' : 'Usuario Normal');
    
    const initialUser: User = {
      id: 'g_user_' + (profile.subId || Math.floor(100000 + Math.random() * 900000)),
      name: profile.name || profile.email.split('@')[0],
      email: profile.email.toLowerCase().trim(),
      avatar: avatarUrl,
      provider: 'google',
      documentId: profile.documentId || '1098765432',
      phone: profile.phone || '300 555 0192',
      googleSubId: profile.subId,
      roleId: targetRoleId,
      roleName: targetRoleName,
      estado: 'activo'
    };

    // Save and sync with Supabase usuarios table
    const syncedUser = await upsertUser(initialUser, targetRoleId);

    if (syncedUser.estado === 'inactivo') {
      throw new Error('Esta cuenta ha sido desactivada por el administrador.');
    }

    saveUserSession(syncedUser);
    setIsAuthModalOpen(false);

    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  };

  const signInWithGoogleOAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });
    if (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Notice signing out from Supabase:', e);
    }
    saveUserSession(null);
  };

  const executeAfterAuth = (action: () => void) => {
    if (user) {
      if (user.estado === 'inactivo') {
        openAuthModal();
        return;
      }
      action();
    } else {
      openAuthModal(action);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        loginWithGoogle,
        signInWithGoogleOAuth,
        signUpWithEmail,
        signInWithEmail,
        resetPassword,
        logout,
        executeAfterAuth,
        refreshUserSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
