"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  ChevronsLeft,
  ChevronsRight,
  FileClock,
  LayoutDashboard,
  ListChecks,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store/app-store";
import { useCases, useDirection, useT } from "@/lib/store/hooks";
import type { TranslationKey } from "@/lib/i18n/dictionary";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Shows the open-case count on the review queue. */
  badge?: "queue";
}

const navItems: NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: LayoutDashboard },
  { href: "/queue", labelKey: "nav.queue", icon: ListChecks, badge: "queue" },
  { href: "/policy", labelKey: "nav.policy", icon: BookOpenCheck },
  { href: "/brief", labelKey: "nav.brief", icon: Sparkles },
  { href: "/audit", labelKey: "nav.audit", icon: FileClock },
  { href: "/security", labelKey: "nav.security", icon: ShieldCheck },
  { href: "/settings", labelKey: "nav.settings", icon: Settings2 },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const direction = useDirection();
  const cases = useCases();
  const openCount = cases.filter((c) => c.status === "pending_review").length;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const Collapse = direction === "rtl" ? ChevronsRight : ChevronsLeft;
  const Expand = direction === "rtl" ? ChevronsLeft : ChevronsRight;

  return (
    <div className="flex h-full flex-col">
      <div className={cn("px-3 pb-2 pt-4", collapsed && "px-2")}>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent-500 to-info-500 text-[0.8125rem] font-bold text-white">
            SP
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] font-semibold leading-tight text-mist-50">
                {t("app.name")}
              </span>
              <span className="block truncate text-[0.6875rem] leading-tight text-mist-500">
                {t("app.tagline")}
              </span>
            </span>
          ) : null}
        </Link>
      </div>

      <nav className={cn("flex-1 space-y-0.5 px-3 py-2", collapsed && "px-2")}>
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? t(item.labelKey) : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[0.8125rem] transition-colors",
                active ? "text-mist-50" : "text-mist-400 hover:bg-white/5 hover:text-mist-100",
                collapsed && "justify-center px-0",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 -z-10 rounded-lg border border-white/10 bg-white/8"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              ) : null}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="flex-1 truncate">{t(item.labelKey)}</span> : null}
              {!collapsed && item.badge === "queue" && openCount > 0 ? (
                <span className="numeric rounded-md bg-escalate-500/15 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-escalate-400">
                  {openCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className={cn("hairline-t px-3 py-3", collapsed && "px-2")}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[0.8125rem] text-mist-400 transition-colors hover:bg-white/5 hover:text-mist-100",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <Expand className="h-4 w-4" /> : <Collapse className="h-4 w-4" />}
          {!collapsed ? <span className="truncate">{t("nav.collapse")}</span> : null}
        </button>
      </div>
    </div>
  );
}
