import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AdminRol = "admin" | "operador" | "cliente";

#Testing;
export type AdminProfile = {
  id: string;
  nombre: string;
  rol: AdminRol;
  comedor_id: string | null;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: AdminProfile | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<AdminProfile | null>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<AdminProfile | null> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, comedor_id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as AdminProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined | null) => {
    if (!uid) {
      setProfile(null);
      return null;
    }
    const p = await fetchProfile(uid);
    setProfile(p);
    return p;
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setTimeout(() => void loadProfile(newSession?.user?.id), 0);
      if (event === "PASSWORD_RECOVERY") {
        if (window.location.pathname !== "/reset-password") {
          window.location.replace("/reset-password");
        }
        return;
      }
      if (event === "TOKEN_REFRESHED" && !newSession) {
        // Sesión expirada
        if (window.location.pathname.startsWith("/admin")) {
          window.location.replace("/login?expired=1");
        }
      }
      if (event === "SIGNED_OUT" && window.location.pathname.startsWith("/admin")) {
        window.location.replace("/login");
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => loadProfile(session?.user?.id), [loadProfile, session?.user?.id]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      signIn,
      signOut,
      refreshProfile,
    }),
    [loading, session, profile, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
