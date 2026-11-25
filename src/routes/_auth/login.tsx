import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { redirectIfAuthenticated } from "@/features/auth/guards";

export const Route = createFileRoute("/_auth/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; suspended?: boolean } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    suspended: search.suspended === true || search.suspended === "true" ? true : undefined,
  }),
  beforeLoad: redirectIfAuthenticated,
  component: LoginForm,
});
