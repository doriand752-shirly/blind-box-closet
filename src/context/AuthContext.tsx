import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "../types/models";
import { api } from "../services/api";
import { localGetMap } from "../services/localCollection";

const GUEST_KEY = "bbc_guest";
const TOKEN_KEY = "bbc_token";

const LOCAL_USER: User = {
  id: "local",
  apple_sub: "local",
  email: null,
  display_name: "Collector",
  username: null,
  is_admin: false,
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  loading: boolean;
  startLocal: () => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    username: string;
  }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistToken(token: string | null) {
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    try {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {
      // SecureStore may be unavailable.
    }
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
    try {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // ignore
    }
  }
}

async function readToken() {
  try {
    const SecureStore = await import("expo-secure-store");
    const secure = await SecureStore.getItemAsync(TOKEN_KEY);
    if (secure) return secure;
  } catch {
    // ignore
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function pushLocalCollection(token: string) {
  const map = await localGetMap();
  const entries = Object.values(map);
  for (const entry of entries) {
    if (entry.owned_qty <= 0 && !entry.wishlist && entry.trade_qty <= 0) continue;
    await api.upsertCollection(token, {
      figureId: entry.figure_id,
      owned_qty: entry.owned_qty,
      wishlist: entry.wishlist,
      trade_qty: entry.trade_qty,
      notes: entry.notes,
    });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(async (nextToken: string, nextUser: User) => {
    await AsyncStorage.removeItem(GUEST_KEY);
    await persistToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    try {
      await pushLocalCollection(nextToken);
    } catch {
      // Sync best-effort; collection still usable from server.
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await readToken();
        if (saved) {
          try {
            const me = await api.me(saved);
            setToken(saved);
            setUser(me.user);
            await AsyncStorage.removeItem(GUEST_KEY);
            return;
          } catch {
            await persistToken(null);
          }
        }
        const guest = await AsyncStorage.getItem(GUEST_KEY);
        if (guest === "1") setUser(LOCAL_USER);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startLocal = useCallback(async () => {
    await persistToken(null);
    await AsyncStorage.setItem(GUEST_KEY, "1");
    setToken(null);
    setUser(LOCAL_USER);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; username: string }) => {
      const res = await api.register(input);
      await applySession(res.token, res.user);
    },
    [applySession],
  );

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const res = await api.login(input);
      await applySession(res.token, res.user);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    await persistToken(null);
    await AsyncStorage.removeItem(GUEST_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const clearLocalData = useCallback(async () => {
    await AsyncStorage.removeItem("bbc_local_collection");
    if (token) {
      // Keep account; wipe only local cache. Server remains source of truth.
      setUser((u) => u);
      return;
    }
    await AsyncStorage.setItem(GUEST_KEY, "1");
    setUser(LOCAL_USER);
  }, [token]);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    const me = await api.me(token);
    setUser(me.user);
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isGuest: Boolean(user) && !token,
      loading,
      startLocal,
      register,
      login,
      signOut,
      clearLocalData,
      refreshMe,
    }),
    [
      user,
      token,
      loading,
      startLocal,
      register,
      login,
      signOut,
      clearLocalData,
      refreshMe,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
