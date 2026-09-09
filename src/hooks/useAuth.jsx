// Client-side replacement for the old server-side session helpers
// (lib/auth/session.ts: getCurrentUser, getCurrentProfile, requireAdmin).
// Since there is no server rendering anymore, auth state lives in a
// React context that reads the Supabase session in the browser and
// keeps it in sync as the user logs in or out.
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const AuthContext = createContext({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(currentUser) {
    if (!currentUser) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, role, created_at")
      .eq("id", currentUser.id)
      .single();
    setProfile(data ?? null);
  }

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      await loadProfile(session?.user ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      await loadProfile(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = {
    user,
    profile,
    isAdmin: profile?.role === "admin",
    loading,
    refreshProfile: () => loadProfile(user),
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
