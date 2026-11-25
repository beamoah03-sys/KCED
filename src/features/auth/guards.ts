import { redirect, type ParsedLocation } from "@tanstack/react-router";
import { getProfile, getSession, signOut } from "@/features/auth/services/auth.service";

/**
 * Route guards for `beforeLoad`. They read the Supabase session (and profile)
 * and throw a `redirect` to bounce the user. Mirrors the redirect logic in the
 * kced_mobile router: unauthenticated → login; authenticated but not yet
 * onboarded → account setup; otherwise into the app.
 */

/**
 * A signed-in user is "onboarded" once they've completed account setup, which
 * is when their profile has a phone number (see AccountSetupForm). Returns true
 * while setup is still pending (or the profile can't be read).
 */
async function accountState(userId: string): Promise<"ok" | "setup" | "suspended"> {
  const profile = await getProfile(userId);
  if (profile?.status === "suspended") return "suspended";
  return profile?.phone ? "ok" : "setup";
}

/**
 * Only allow same-origin, internal paths as post-login redirect targets, so a
 * crafted `?redirect=` can't bounce the user off-site (open redirect).
 */
export function safeRedirect(path: string | undefined): string | undefined {
  if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  return undefined;
}

/**
 * Require a signed-in, onboarded user; otherwise bounce to the right screen.
 * When sending an anonymous user to login, remember where they were headed so
 * they can be returned there after signing in.
 */
export async function requireAuth({ location }: { location: ParsedLocation }) {
  const session = await getSession();
  if (!session) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
  const state = await accountState(session.user.id);
  if (state === "suspended") {
    await signOut();
    throw redirect({ to: "/login", search: { suspended: true } });
  }
  if (state === "setup") {
    throw redirect({ to: "/account-setup" });
  }
}

/**
 * Route an already signed-in user away from the login page — to account setup
 * if they haven't finished onboarding, to their saved destination if they have
 * one, otherwise to the dashboard.
 *
 * Used only on the login page, NOT the whole `_auth` group: account-setup runs
 * on the invite session and forgot-password creates a recovery session, so both
 * must stay reachable while a session exists.
 */
export async function redirectIfAuthenticated({ search }: { search: { redirect?: string; suspended?: boolean } }) {
  const session = await getSession();
  if (!session) return;
  const state = await accountState(session.user.id);
  if (state === "suspended") {
    await signOut();
    return;
  }
  if (state === "setup") {
    throw redirect({ to: "/account-setup" });
  }
  throw redirect({ to: safeRedirect(search.redirect) ?? "/dashboard" });
}
