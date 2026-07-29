"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store/app-store";
import { useHydrateStore, useLocale } from "@/lib/store/hooks";
import { ToastViewport } from "@/components/ui/overlays";
import { CopilotDrawer } from "@/components/copilot/copilot-drawer";
import { SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Application chrome. Everything below the topbar is a route; the sidebar,
 * search, copilot and toasts persist across navigation.
 */
export function AppShell({ children }: { children: ReactNode }) {
  useHydrateStore();
  const pathname = usePathname();
  const locale = useLocale();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Keep the document in sync with the reviewer's language choice. Doing this
  // in an effect (not during render) is what keeps hydration clean.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  // The drawer closes from the nav links themselves (onNavigate), so no effect
  // is needed to react to the route change.

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-e border-white/8 bg-ink-900/60 backdrop-blur-xl transition-[width] duration-200 lg:block",
          collapsed ? "w-[4.25rem]" : "w-60",
        )}
      >
        <SidebarNav />
      </aside>

      {/* Tablet / mobile drawer */}
      <AnimatePresence>
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              initial={{ x: locale === "ar" ? 260 : -260 }}
              animate={{ x: 0 }}
              exit={{ x: locale === "ar" ? 260 : -260 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 start-0 w-60 border-e border-white/10 bg-ink-900"
            >
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="min-w-0 flex-1 px-3 pb-10 pt-4 sm:px-4 lg:px-6 lg:pt-6">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-[110rem]"
          >
            {children}
          </motion.div>
        </main>
      </div>

      <CopilotDrawer />
      <ToastViewport />
    </div>
  );
}
