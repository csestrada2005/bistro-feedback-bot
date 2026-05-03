import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AdminRole = "cafeteria_admin" | "hr_viewer";

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AdminRole | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<AdminRole | null>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchRole(userId: string): Promise<AdminRole | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data?.length) return null;
  if (data.some((r) => r.role === "cafeteria_admin")) return "cafeteria_admin";
  return data[0].role as AdminRole;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);

  const loadRole = useCallback(async (uid: string | undefined | null) => {
    if (!uid) {
      setRole(null);
      return null;
    }
    const r = await fetchRole(uid);
    setRole(r);
    return r;
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setTimeout(() => {
        void loadRole(newSession?.user?.id);
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadRole(data.session?.user?.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRole(null);
  }, []);

  const refreshRole = useCallback(async () => {
    return loadRole(session?.user?.id);
  }, [loadRole, session?.user?.id]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      role,
      signIn,
      signOut,
      refreshRole,
    }),
    [loading, session, role, signIn, signOut, refreshRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
