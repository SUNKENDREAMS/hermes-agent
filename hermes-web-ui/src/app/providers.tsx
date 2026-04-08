"use client";

import { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/Sidebar";
import { usePathname } from "next/navigation";

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-hermes-gold/10 flex items-center justify-center animate-pulse">
            <div className="h-6 w-6 rounded-md bg-hermes-gold/30" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Login page — no sidebar
  if (pathname === "/login" || pathname === "/login/") {
    return <>{children}</>;
  }

  // Not authenticated — redirect to login
  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  // Authenticated layout with sidebar
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[260px] transition-all duration-300">
        <div className="p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
