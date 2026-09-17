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
  logout: () => Promise<void>;
  executeAfterAuth: (action: () => void) => void;
  switchRole: (roleId: string, roleName?: string) => Promise<void>;
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

    const realUser: User = {
      id: sessionUser.id,
      name: realName,
      email: realEmail,
      avatar: realAvatar,
      provider: 'google',
      googleSubId: sessionUser.id,
      roleId: 'ciudadano',
      roleName: 'Ciudadano General'
    };

    const synced = await upsertUser(realUser, 'ciudadano');
    saveUserSession(synced);
  };

  // Restore session and listen to Supabase OAuth redirects
  useEffect(() => {
    // 1. Check local storage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading Google session:', e);
    }

    // 2. Check Supabase active session (handles OAuth callback redirect)
    supabase.auth.getSession().then(({ data }: { data: { session: any } }) => {
      if (data?.session?.user) {
        syncSupabaseAuthUser(data.session.user);
      }
    }).catch((err: any) => {
      console.warn('Supabase getSession notice:', err);
    });

    // 3. Listen to real-time auth changes (OAuth login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (session?.user) {
        await syncSupabaseAuthUser(session.user);
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

  const loginWithGoogle = async (profile: GoogleProfileData) => {
    const avatarUrl = profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || profile.email)}&background=4285F4&color=fff&bold=true`;
    const targetRoleId = profile.roleId || 'ciudadano';
    const targetRoleName = profile.roleName || (targetRoleId === 'funcionario_alcaldia' ? 'Funcionario de Atención Ciudadana' : 'Ciudadano General');
    
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
      roleName: targetRoleName
    };

    // Save and sync with Supabase usuarios table
    const syncedUser = await upsertUser(initialUser, targetRoleId);

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

  const switchRole = async (roleId: string, roleName?: string) => {
    if (!user) return;
    const computedRoleName = roleName || (
      roleId === 'admin' || roleId === 'administrador' || roleId === 'admin_municipal' ? 'Administrador del Sistema' :
      roleId === 'funcionario_alcaldia' ? 'Funcionario de Atención Ciudadana' :
      roleId === 'analista_pqrs' ? 'Analista Técnico de Servicios' :
      roleId === 'secretario' ? 'Secretario Dependencia' : 'Ciudadano General'
    );

    const updatedUser: User = {
      ...user,
      roleId,
      roleName: computedRoleName
    };

    // Update in Supabase
    try {
      await supabase
        .from('usuarios')
        .update({ role_id: roleId, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch (e) {
      console.warn('Notice updating user role in Supabase:', e);
    }

    saveUserSession(updatedUser);
  };

  const executeAfterAuth = (action: () => void) => {
    if (user) {
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
        logout,
        executeAfterAuth,
        switchRole
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
