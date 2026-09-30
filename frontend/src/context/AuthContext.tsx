'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type User = {
  id: string;
  email: string;
};

type Auth = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then(({ user: current }) => setUser(current))
      .catch((error) => {
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.error(error);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api<{ user: User }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      0
    );
    setUser(result.user);
  };

  const register = async (email: string, password: string) => {
    const result = await api<{ user: User }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      0
    );
    setUser(result.user);
  };

  const logout = async () => {
    await api<void>('/auth/logout', { method: 'POST' }, 0);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}