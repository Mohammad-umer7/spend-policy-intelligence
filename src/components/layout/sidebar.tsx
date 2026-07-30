"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store/app-store";
import { useCases, useT } from "@/lib/store/hooks";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const navItems: { href: string; labelKey: TranslationKey; badge?: boolean }[] = [
  { href: "/", labelKey: "nav.overview" },
  { href: "/queue", labelKey: "nav.queue", badge: true },
  { href: "/policy", labelKey: "nav.policy" },
  { href: "/audit", labelKey: "nav.audit" },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  const cases = useCases();
  const resetAll = useAppStore((s) => s.resetAll);
  const openCount = cases.filter((c) => c.status === "pending_review").length;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b px-4 py-4">
        <Link href="/" onClick={onNavigate} className="block">
          <span className="block text-[0.8125rem] font-semibold leading-tight text-ink-900">
            {t("app.name")}
          </span>
          <span className="mt-0.5 block text-[0.6875rem] leading-tight text-ink-500">
            {t("app.tagline")}
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-[0.1875rem] px-2.5 py-1.5 text-[0.8125rem] transition-colors",
                active
                  ? "bg-ink-100 font-medium text-ink-900"
                  : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
              )}
            >
              <span className="flex-1 truncate">{t(item.labelKey)}</span>
              {item.badge && openCount > 0 ? (
                <span className="numeric text-[0.6875rem] font-medium text-ink-500">
                  {openCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="hairline-t px-4 py-3">
        <p className="text-[0.6875rem] text-ink-400">{t("app.dataNote")}</p>
        <button
          onClick={() => resetAll()}
          className="mt-1 text-[0.6875rem] text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
        >
          {t("app.resetData")}
        </button>
      </div>
    </div>
  );
}
