"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  const locale = useLocale();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Keep the document in sync with the reviewer's language choice. Doing this
  // in an effect (not during render) is what keeps hydration clean.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 border-e border-[--hairline] bg-white lg:block">
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
              transition={{ duration: 0.12 }}
              className="absolute inset-0 bg-ink-950/25"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              initial={{ x: locale === "ar" ? 220 : -220 }}
              animate={{ x: 0 }}
              exit={{ x: locale === "ar" ? 220 : -220 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 start-0 w-52 border-e border-[--hairline] bg-white"
            >
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="min-w-0 flex-1 px-4 pb-8 pt-5 lg:px-7">
          <div className="mx-auto w-full max-w-[104rem]">{children}</div>
        </main>
      </div>

      <CopilotDrawer />
      <ToastViewport />
    </div>
  );
}
