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

const GUEST_KEY = "bbc_guest";
const LEGACY_TOKEN_KEY = "bbc_token";

const LOCAL_USER: User = {
  id: "local",
  apple_sub: "local",
  email: null,
  display_name: "Collector",
  is_admin: false,
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  loading: boolean;
  startLocal: () => Promise<void>;
  signOut: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Drop any leftover cloud session from older builds.
        await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
        try {
          const SecureStore = await import("expo-secure-store");
          await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
        } catch {
          // SecureStore may be unavailable in some environments.
        }
        const guest = await AsyncStorage.getItem(GUEST_KEY);
        if (guest === "1") setUser(LOCAL_USER);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startLocal = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, "1");
    setUser(LOCAL_USER);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(GUEST_KEY);
    setUser(null);
  }, []);

  const clearLocalData = useCallback(async () => {
    await AsyncStorage.removeItem("bbc_local_collection");
    await AsyncStorage.setItem(GUEST_KEY, "1");
    setUser(LOCAL_USER);
  }, []);

  const refreshMe = useCallback(async () => {
    // Local-only: nothing to refresh from the server.
  }, []);

  const value = useMemo(
    () => ({
      user,
      token: null,
      isGuest: Boolean(user),
      loading,
      startLocal,
      signOut,
      clearLocalData,
      refreshMe,
    }),
    [user, loading, startLocal, signOut, clearLocalData, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
