import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import nProgress from "nprogress";
import { routeTree } from "./routeTree.gen";
import { AuthProvider } from "@/lib/auth-context";
import { envMissing } from "@/lib/env";
import { AppError, MissingEnv } from "@/components/AppError";
import "./styles.css";

const router = createRouter({
  routeTree,
  defaultErrorComponent: AppError,
  defaultPreload: "intent",
  scrollRestoration: true,
});

nProgress.configure({ showSpinner: false });
router.subscribe("onBeforeNavigate", () => nProgress.start());
router.subscribe("onLoad", () => nProgress.done());
router.subscribe("onResolved", () => nProgress.done());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {envMissing.length > 0 ? (
      <MissingEnv />
    ) : (
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    )}
  </StrictMode>,
);
