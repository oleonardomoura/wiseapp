import React, { createContext, useContext } from 'react';
import { useAuth, type AppRole, type Profile } from '@/hooks/useAuth';
import type { User, Session } from '@supabase/supabase-js';

type AuthErrorLike = { message: string };
type AuthDataLike = { user: User | null; session: Session | null };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ data: AuthDataLike; error: AuthErrorLike | null }>;
  signIn: (email: string, password: string) => Promise<{ data: AuthDataLike; error: AuthErrorLike | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
