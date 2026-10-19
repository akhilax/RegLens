import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig } from "motion/react";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/overlay";
import { router } from "./routes";
import { applyTheme, useUI } from "./store/ui";

const loadFeatures = () => import("./lib/motion-features").then((m) => m.default);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: 1 } },
});

applyTheme(useUI.getState().theme);

function ThemedToaster() {
  const theme = useUI((s) => s.theme);
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{ className: "!rounded-xl !border-border-strong !shadow-lift" }}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={loadFeatures} strict>
          <TooltipProvider>
            <Suspense fallback={<div className="app-backdrop min-h-dvh" />}>
              <RouterProvider router={router} />
            </Suspense>
            <ThemedToaster />
          </TooltipProvider>
        </LazyMotion>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
