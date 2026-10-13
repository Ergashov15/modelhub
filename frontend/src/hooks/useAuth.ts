import { useState, useEffect, useCallback } from 'react';
import type { User, AuthResponse } from '../types';

const TOKEN_KEY = 'modelhub_auth_token';
const USER_KEY = 'modelhub_auth_user';

// Shared module-level state for cross-component synchrony
let globalToken: string | null = (() => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
})();

let globalUser: User | null = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error(e);
    }
  });
}

function updateGlobalAuth(token: string | null, user: User | null) {
  globalToken = token;
  globalUser = user;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {}
  notifyListeners();
}

// Global cross-tab listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === TOKEN_KEY || e.key === USER_KEY) {
      try {
        const nextToken = localStorage.getItem(TOKEN_KEY);
        const rawUser = localStorage.getItem(USER_KEY);
        const nextUser = rawUser ? JSON.parse(rawUser) : null;
        globalToken = nextToken;
        globalUser = nextUser;
        notifyListeners();
      } catch {}
    }
  });
}

export function useAuth() {
  const [, setTick] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setTick((prev) => prev + 1);
    };
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  // Validate session on mount if token exists
  useEffect(() => {
    if (!globalToken) return;

    fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${globalToken}`,
      },
    })
      .then((res) => res.json())
      .then((data: AuthResponse) => {
        if (data.success && data.user) {
          updateGlobalAuth(globalToken, data.user);
        } else {
          // Token expired or invalid
          updateGlobalAuth(null, null);
        }
      })
      .catch(() => {
        // Network offline, keep cached credentials
      });
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data: AuthResponse = await res.json();
      if (data.success && data.token && data.user) {
        updateGlobalAuth(data.token, data.user);
        return data;
      }
      const msg = data.message || "Noto'g'ri foydalanuvchi nomi yoki parol.";
      setAuthError(msg);
      return { success: false, message: msg };
    } catch {
      const msg = "Server bilan aloqa o'rnatilmadi.";
      setAuthError(msg);
      return { success: false, message: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (
      username: string,
      password: string
    ): Promise<AuthResponse> => {
      setIsLoading(true);
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        });
        const data: AuthResponse = await res.json();
        if (data.success && data.token && data.user) {
          updateGlobalAuth(data.token, data.user);
          return data;
        }
        const msg = data.message || "Ro'yxatdan o'tishda xatolik yuz berdi.";
        setAuthError(msg);
        return { success: false, message: msg };
      } catch {
        const msg = "Server bilan aloqa o'rnatilmadi.";
        setAuthError(msg);
        return { success: false, message: msg };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    const currentToken = globalToken;
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch {}
    }
    updateGlobalAuth(null, null);
    setAuthError(null);
  }, []);

  return {
    user: globalUser,
    token: globalToken,
    isAuthenticated: Boolean(globalToken && globalUser),
    isLoading,
    authError,
    setAuthError,
    login,
    register,
    logout,
  };
}
