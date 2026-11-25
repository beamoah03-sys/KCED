import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { fetchProfile, type Profile, type UserRole } from "@/features/profile/services/profile.service";

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  role: UserRole | null;
  jurisdictionId: number | null;
  /** Re-read the profile, e.g. after the user edits their name. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  profile: null,
  loading: true,
  role: null,
  jurisdictionId: null,
  refresh: async () => {},
});

/**
 * Holds the signed-in user's profile (role, jurisdiction) for the whole app.
 *
 * Phase I loaded the profile once at start-up, so after an in-app login the
 * role stayed null until a full page refresh (admin buttons hidden, queries
 * unscoped), and switching accounts kept the previous user's profile. This
 * version reloads whenever the signed-in user actually changes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserId = useRef<string | null | undefined>(undefined);

  const load = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProfile(await fetchProfile());
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      // Supabase re-emits SIGNED_IN when the tab regains focus; only reload
      // when the identity changes (or the user record itself was updated).
      if (nextUserId !== currentUserId.current || event === "USER_UPDATED") {
        currentUserId.current = nextUserId;
        // Defer: calling Supabase inside this callback can deadlock the client.
        setTimeout(() => void load(nextUserId), 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(() => load(currentUserId.current ?? null), [load]);

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        role: profile?.role ?? null,
        jurisdictionId: profile?.jurisdictionId ?? null,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
