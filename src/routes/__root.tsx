import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { syncIdentitiesFromBackend } from "@/lib/face-store";
import { syncLogFromBackend } from "@/lib/detection-log";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl tracking-widest text-foreground">404</h1>
        <p className="mt-2 text-sm uppercase tracking-[0.3em] text-muted-foreground">
          Signal lost
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "permissions-policy", content: "camera=*" },
      { title: "LENS — Identify. Enroll. Locate." },
      {
        name: "description",
        content:
          "LENS is a private, on-device face recognition tool. Enroll identities, identify faces live, and locate a target in a crowd.",
      },
      { name: "theme-color", content: "#0A0B0F" },
      { property: "og:title", content: "LENS — Identify. Enroll. Locate." },
      {
        property: "og:description",
        content: "Private, on-device face recognition. Nothing leaves your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "LENS — Identify. Enroll. Locate." },
      { name: "description", content: "LENS is a client-side face recognition web application for identity enrollment and live identification." },
      { property: "og:description", content: "LENS is a client-side face recognition web application for identity enrollment and live identification." },
      { name: "twitter:description", content: "LENS is a client-side face recognition web application for identity enrollment and live identification." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fdcadbd3-d669-4f28-ba46-14a3d9f78b55/id-preview-cafe816f--15f5a472-e8f2-4926-b3a0-e2afb15a9a54.lovable.app-1781357020689.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fdcadbd3-d669-4f28-ba46-14a3d9f78b55/id-preview-cafe816f--15f5a472-e8f2-4926-b3a0-e2afb15a9a54.lovable.app-1781357020689.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Cormorant+Garamond:wght@400;500;600&display=swap",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href:
          "data:image/svg+xml;utf8," +
          encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='#0A0B0F'/><circle cx='16' cy='16' r='9' fill='none' stroke='%234F8EF7' stroke-width='1.6'/><circle cx='16' cy='16' r='3' fill='%234F8EF7'/></svg>`,
          ),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <BackendBootstrap />
      <Outlet />
      <Toaster position="top-center" theme="dark" />
    </QueryClientProvider>
  );
}

function BackendBootstrap() {
  const { status } = useBackendHealth();

  useEffect(() => {
    if (status !== "insightface") return;
    void syncIdentitiesFromBackend();
    void syncLogFromBackend();
  }, [status]);

  return null;
}
