import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, setCsrfToken, ensureCsrfToken, ApiError } from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Check for the session cookie before hitting the API. If there's no
    // session cookie, we know /auth/me will 401 — so skip the request
    // entirely and just set the user to null. This avoids a noisy 401 in
    // the browser console on every page load for logged-out visitors.
    const hasSessionCookie =
      typeof document !== 'undefined' &&
      document.cookie.split(';').some((c) => c.trim().startsWith('medexplain_session='));

    if (!hasSessionCookie) {
      setUser(null);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const u = await api.me();
        if (cancelled) return;
        setUser(u);
        await ensureCsrfToken();
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    setCsrfToken(res.csrf_token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await api.register(email, password);
    setCsrfToken(res.csrf_token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setCsrfToken('');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
