"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "OWNER";
  businessId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionExpired: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setUserDirectly: (user: AuthUser | null) => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  sessionExpired: false,
  logout: async () => {},
  refreshAuth: async () => {},
  setUserDirectly: () => {},
  clearSessionExpired: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setSessionExpired(false);
      } else {
        // If user was previously authenticated, this means session expired
        if (user) {
          setSessionExpired(true);
        }
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch auth state once on initial mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const setUserDirectly = useCallback((newUser: AuthUser | null) => {
    setUser(newUser);
    setIsLoading(false);
    setSessionExpired(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue with local cleanup even if API fails
    }
    setUser(null);
    setSessionExpired(false);
    router.push("/login");
    router.refresh();
  }, [router]);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    await fetchUser();
  }, [fetchUser]);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        sessionExpired,
        logout,
        refreshAuth,
        setUserDirectly,
        clearSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
