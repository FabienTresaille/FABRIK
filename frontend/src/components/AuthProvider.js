'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

// Pages publiques (pas de redirection vers login)
const PUBLIC_PATHS = ['/login', '/register', '/audit'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Charger le token au démarrage
  useEffect(() => {
    const storedToken = localStorage.getItem('fabrik_token');
    const storedUser = localStorage.getItem('fabrik_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));

      // Vérifier que le token est toujours valide
      verifyToken(storedToken).then((valid) => {
        if (!valid) {
          logout();
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  // Redirection si non authentifié sur page protégée
  useEffect(() => {
    if (!loading && !user) {
      const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
      if (!isPublic && pathname !== '/') {
        router.push('/login');
      }
    }
  }, [loading, user, pathname, router]);

  const verifyToken = async (tkn) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${tkn}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const login = useCallback((tokenData, userData) => {
    localStorage.setItem('fabrik_token', tokenData);
    localStorage.setItem('fabrik_user', JSON.stringify(userData));
    setToken(tokenData);
    setUser(userData);
    router.push('/');
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('fabrik_token');
    localStorage.removeItem('fabrik_user');
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
