import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { api } from "../services/api";
import type { User } from "../types/models";

const TOKEN_KEY = "bbc_token";
const GUEST_KEY = "bbc_guest";

const GUEST_USER: User = {
  id: "guest",
  apple_sub: "guest",
  email: null,
  display_name: "Invité",
  is_admin: false,
};

/** Empty string when the user dismissed the Apple sheet. */
export function appleAuthErrorMessage(e: unknown, fallback = "Connexion impossible"): string {
  const err = e as { code?: string; message?: string } | null;
  if (err?.code === "ERR_REQUEST_CANCELED") return "";
  return err?.message || fallback;
}

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  loading: boolean;
  continueAsGuest: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signInDev: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback(
    async (next: {
      token: string | null;
      user: User | null;
      guest: boolean;
    }) => {
      setToken(next.token);
      setUser(next.user);
      setIsGuest(next.guest);
      if (next.token) await SecureStore.setItemAsync(TOKEN_KEY, next.token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
      if (next.guest) await AsyncStorage.setItem(GUEST_KEY, "1");
      else await AsyncStorage.removeItem(GUEST_KEY);
    },
    [],
  );

  const refreshMe = useCallback(async () => {
    if (!token || isGuest) return;
    const { user: me } = await api.me(token);
    setUser(me);
  }, [token, isGuest]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          const { user: me } = await api.me(saved);
          setToken(saved);
          setUser(me);
          setIsGuest(false);
          return;
        }
        const guest = await AsyncStorage.getItem(GUEST_KEY);
        if (guest === "1") {
          setUser(GUEST_USER);
          setIsGuest(true);
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const continueAsGuest = useCallback(async () => {
    await persistSession({ token: null, user: GUEST_USER, guest: true });
  }, [persistSession]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== "ios") {
      throw new Error("Sign in with Apple is only available on iOS");
    }
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      throw new Error("Sign in with Apple n’est pas disponible sur cet appareil.");
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error("Apple n’a pas renvoyé de jeton.");
    }

    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(" ");
    const res = await api.appleAuth({
      identityToken: credential.identityToken,
      email: credential.email,
      fullName: fullName || null,
    });
    await persistSession({ token: res.token, user: res.user, guest: false });
  }, [persistSession]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email, password });
      await persistSession({ token: res.token, user: res.user, guest: false });
    },
    [persistSession],
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string) => {
      const res = await api.register({ email, password });
      await persistSession({ token: res.token, user: res.user, guest: false });
    },
    [persistSession],
  );

  const signInDev = useCallback(async () => {
    const res = await api.appleAuth({
      identityToken: `dev:dorian-local-${Platform.OS}`,
      email: "doriandood.pro@gmail.com",
      fullName: "Dorian Dood",
    });
    await persistSession({ token: res.token, user: res.user, guest: false });
  }, [persistSession]);

  const signOut = useCallback(async () => {
    await persistSession({ token: null, user: null, guest: false });
  }, [persistSession]);

  const deleteAccount = useCallback(async () => {
    if (token && !isGuest) {
      try {
        await api.deleteMe(token);
      } catch {
        // Account may already be gone — still clear local session.
      }
    }
    await persistSession({ token: null, user: null, guest: false });
  }, [persistSession, token, isGuest]);

  const value = useMemo(
    () => ({
      user,
      token,
      isGuest,
      loading,
      continueAsGuest,
      signInWithApple,
      signInWithEmail,
      registerWithEmail,
      signInDev,
      signOut,
      deleteAccount,
      refreshMe,
    }),
    [
      user,
      token,
      isGuest,
      loading,
      continueAsGuest,
      signInWithApple,
      signInWithEmail,
      registerWithEmail,
      signInDev,
      signOut,
      deleteAccount,
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
