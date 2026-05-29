'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type AppRole = 'none' | 'viewer' | 'editor' | 'admin' | 'superadmin';

export interface AppUser {
  id: string;
  email: string;
  role: AppRole;
  display_name: string | null;
  avatar_url: string | null;
  last_login: string | null;
  created_at: string;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { displayName?: string | null; avatarUrl?: string | null }) => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canWrite: boolean;
  canRead: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function bootstrapUser(email: string, displayName?: string | null, avatarUrl?: string | null) {
    const { data, error } = await supabase.rpc('upsert_app_user', {
      p_email: email,
      p_display_name: displayName ?? null,
      p_avatar_url: avatarUrl ?? null,
    });
    if (!error && data) setUser(data as AppUser);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const { email, user_metadata } = session.user;
        bootstrapUser(email!, user_metadata?.full_name, user_metadata?.avatar_url).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const { email, user_metadata } = session.user;
        bootstrapUser(email!, user_metadata?.full_name, user_metadata?.avatar_url);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function updateProfile(updates: { displayName?: string | null; avatarUrl?: string | null }) {
    if (!user) return;
    const { data, error } = await supabase.rpc('upsert_app_user', {
      p_email: user.email,
      p_display_name: updates.displayName !== undefined ? updates.displayName : user.display_name,
      p_avatar_url: updates.avatarUrl !== undefined ? updates.avatarUrl : user.avatar_url,
    });
    if (!error && data) setUser(data as AppUser);
  }

  const role = user?.role ?? 'none';
  const value: AuthState = {
    user,
    loading,
    signInWithGoogle,
    signOut,
    updateProfile,
    isAdmin:      ['admin', 'superadmin'].includes(role),
    isSuperAdmin: role === 'superadmin',
    canWrite:     ['editor', 'admin', 'superadmin'].includes(role),
    canRead:      ['viewer', 'editor', 'admin', 'superadmin'].includes(role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
