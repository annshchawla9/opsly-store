// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * TEMP escape hatch until Supabase types are regenerated
 */
const sb = supabase as any;

/**
 * Matches your DB:
 * public.users: id, auth_user_id, name, role (TEXT)
 * public.user_store_access: user_id, store_id
 * public.stores: id, code, name, region
 */
type AppRole = "hq_admin" | "store_manager";

interface AppUser {
  id: string;
  auth_user_id: string;
  name: string;
  role: AppRole;
}

interface Store {
  id: string;
  code: string;
  name: string;
  region: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;

  appUser: AppUser | null;
  role: AppRole | null;

  store: Store | null; // Store manager gets exactly ONE store
  loading: boolean;

  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent race conditions: ignore old hydrate runs
  const hydrateTokenRef = useRef(0);

  // Pretty log helper
  const L = (...args: any[]) => console.log("%c[Auth]", "color:#6d28d9;font-weight:700", ...args);
  const W = (...args: any[]) => console.warn("%c[Auth]", "color:#b45309;font-weight:700", ...args);
  const E = (...args: any[]) => console.error("%c[Auth]", "color:#b91c1c;font-weight:700", ...args);

  useEffect(() => {
    L("AuthProvider mounted");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      L("onAuthStateChange:", event, "hasSession=", !!session, "uid=", session?.user?.id);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user?.id) {
        // Defer to next tick so session is fully set
        setTimeout(() => hydrateContext(session.user.id, "onAuthStateChange"), 0);
      } else {
        resetState();
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      L("getSession:", "hasSession=", !!session, "uid=", session?.user?.id);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user?.id) {
        hydrateContext(session.user.id, "getSession");
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetState() {
    L("resetState()");
    setAppUser(null);
    setRole(null);
    setStore(null);
  }

  async function hydrateContext(authUserId: string, source: string) {
    const myToken = ++hydrateTokenRef.current;
    setLoading(true);

    L("hydrateContext start", { myToken, source, authUserId });

    try {
      /**
       * 1) Fetch public.users row by auth_user_id (auth UID)
       */
      const { data: userRow, error: userErr } = await sb
        .from("users")
        .select("id, auth_user_id, name, role")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      L("STEP1 public.users result", { myToken, userRow, userErr });

      if (myToken !== hydrateTokenRef.current) {
        W("stale hydrate run (after STEP1) - ignoring", { myToken, current: hydrateTokenRef.current });
        return;
      }

      if (userErr) throw userErr;

      if (!userRow) {
        W("No public.users row for this auth UID -> store will be null", { authUserId });
        resetState();
        return;
      }

      const u = userRow as AppUser;
      setAppUser(u);
      setRole(u.role);

      L("STEP1 set appUser/role", { appUserId: u.id, role: u.role, name: u.name });

      /**
       * 2) If not store_manager, stop here (HQ can use appUser/role without store)
       */
      if (u.role !== "store_manager") {
        W("Role is not store_manager -> skipping store hydration", { role: u.role });
        setStore(null);
        return;
      }

      /**
       * 3) Fetch store_id from user_store_access using public.users.id
       */
      let accessRow: { store_id: string } | null = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        L("STEP3 user_store_access attempt", { attempt, user_id: u.id });

        const { data, error: accessErr } = await sb
          .from("user_store_access")
          .select("store_id")
          .eq("user_id", u.id)
          .maybeSingle();

        L("STEP3 user_store_access result", { attempt, data, accessErr });

        if (myToken !== hydrateTokenRef.current) {
          W("stale hydrate run (after STEP3) - ignoring", { myToken, current: hydrateTokenRef.current });
          return;
        }

        if (accessErr) throw accessErr;

        accessRow = data ?? null;
        if (accessRow?.store_id) break;

        await new Promise((r) => setTimeout(r, 200));
      }

      if (!accessRow?.store_id) {
        W("No store_id mapping found in user_store_access", { public_user_id: u.id });
        setStore(null);
        return;
      }

      L("STEP3 mapping OK", { store_id: accessRow.store_id });

      /**
       * 4) Fetch store details
       */
      const { data: storeRow, error: storeErr } = await sb
        .from("stores")
        .select("id, code, name, region")
        .eq("id", accessRow.store_id)
        .maybeSingle();

      L("STEP4 stores result", { storeRow, storeErr });

      if (myToken !== hydrateTokenRef.current) {
        W("stale hydrate run (after STEP4) - ignoring", { myToken, current: hydrateTokenRef.current });
        return;
      }

      if (storeErr) throw storeErr;

      setStore((storeRow || null) as Store | null);

      L("hydrateContext DONE ✅", {
        store: storeRow
          ? { id: storeRow.id, code: storeRow.code, name: storeRow.name, region: storeRow.region }
          : null,
      });
    } catch (err) {
      E("hydrateContext ERROR ❌", err);

      if (myToken === hydrateTokenRef.current) {
        resetState();
      }
    } finally {
      if (myToken === hydrateTokenRef.current) {
        setLoading(false);
        L("hydrateContext finished (loading=false)", { myToken });
      }
    }
  }

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    L("signIn()", email);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        W("signIn error:", error.message);
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          return { error: "Invalid email or password. Please try again." };
        }
        return { error: error.message };
      }

      L("signIn success");
      return { error: null };
    } catch (error: any) {
      E("signIn unexpected error:", error);
      return { error: error.message || "An unexpected error occurred" };
    }
  };

  const signOut = async () => {
    L("signOut()");
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    resetState();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        appUser,
        role,
        store,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};