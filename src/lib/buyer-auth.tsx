"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buyerAuthFetch,
  buyerFetch,
  clearBuyerToken,
  getBuyerToken,
  setBuyerToken,
} from "./buyer-api";
import type { BuyerUser } from "@/types";

interface BuyerAuthContextValue {
  user: BuyerUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    address?: Record<string, string>;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  isLoggedIn: boolean;
}

const BuyerAuthContext = createContext<BuyerAuthContextValue | null>(null);

export function BuyerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BuyerUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getBuyerToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await buyerAuthFetch<BuyerUser>("/auth/me");
      setUser(me);
    } catch {
      clearBuyerToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await buyerFetch<{ token: string; user: BuyerUser }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    setBuyerToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      password: string;
      phone: string;
      address?: Record<string, string>;
    }) => {
      const res = await buyerFetch<{ token: string; user: BuyerUser }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      );
      setBuyerToken(res.token);
      setUser(res.user);
    },
    []
  );

  const logout = useCallback(() => {
    clearBuyerToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      isLoggedIn: !!user,
    }),
    [user, loading, login, register, logout, refresh]
  );

  return (
    <BuyerAuthContext.Provider value={value}>
      {children}
    </BuyerAuthContext.Provider>
  );
}

export function useBuyerAuth() {
  const ctx = useContext(BuyerAuthContext);
  if (!ctx) throw new Error("useBuyerAuth must be used within BuyerAuthProvider");
  return ctx;
}
