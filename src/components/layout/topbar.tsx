"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Building2, Languages, Menu, MessageSquareText, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { company, currentReviewer } from "@/lib/data/company";
import { policy } from "@/lib/data/policy";
import { formatAed } from "@/lib/format";
import { useAppStore } from "@/lib/store/app-store";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button, Chip } from "@/components/ui/primitives";
import { NotificationsPopover } from "./notifications";

interface SearchHit {
  href: string;
  title: string;
  subtitle: string;
  kind: string;
}

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const router = useRouter();
  const cases = useCases();
  const toggleLocale = useAppStore((s) => s.toggleLocale);
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const transactionHits = cases
      .filter(
        (c) =>
          c.transaction.id.toLowerCase().includes(q) ||
          c.transaction.merchant.toLowerCase().includes(q) ||
          c.transaction.merchantAr.includes(query.trim()) ||
          c.employee.name.toLowerCase().includes(q) ||
          c.employee.nameAr.includes(query.trim()),
      )
      .slice(0, 5)
      .map<SearchHit>((c) => ({
        href: `/transactions/${c.transaction.id}`,
        title: `${c.transaction.id} · ${L(c.transaction.merchant, c.transaction.merchantAr)}`,
        subtitle: `${L(c.employee.name, c.employee.nameAr)} · ${formatAed(c.transaction.amountAed, locale)}`,
        kind: t("queue.col.transaction"),
      }));

    const clauseHits = policy.clauses
      .filter(
        (clause) =>
          clause.id.toLowerCase().includes(q) ||
          clause.title.toLowerCase().includes(q) ||
          clause.text.toLowerCase().includes(q) ||
          clause.titleAr.includes(query.trim()),
      )
      .slice(0, 4)
      .map<SearchHit>((clause) => ({
        href: `/policy?clause=${clause.id}`,
        title: `${clause.id} · ${L(clause.title, clause.titleAr)}`,
        subtitle: L(clause.text, clause.textAr).slice(0, 78) + "…",
        kind: t("common.clause"),
      }));

    return [...transactionHits, ...clauseHits];
  }, [query, cases, locale, L, t]);

  const go = useCallback(
    (href: string) => {
      setQuery("");
      setFocused(false);
      router.push(href);
    },
    [router],
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4 lg:px-6">
        <button
          onClick={onOpenMobileNav}
          aria-label={t("nav.menu")}
          className="rounded-lg p-2 text-mist-300 transition-colors hover:bg-white/6 hover:text-mist-50 lg:hidden"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        {/* Global search */}
        <div className="relative min-w-0 flex-1 max-w-xl">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 140)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits[0]) go(hits[0].href);
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder={t("top.search")}
            aria-label={t("top.search")}
            className="h-9 w-full rounded-lg border border-white/10 bg-white/4 ps-9 pe-3 text-[0.8125rem] text-mist-100 placeholder:text-mist-500 transition-colors focus:border-white/20 focus:bg-white/6 focus:outline-none"
          />
          <AnimatePresence>
            {focused && query.trim().length >= 2 ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="panel-raised absolute inset-x-0 top-11 z-40 max-h-80 overflow-y-auto py-1.5 shadow-2xl"
              >
                {hits.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-mist-500">{t("top.noResults")}</p>
                ) : (
                  hits.map((hit) => (
                    <button
                      key={hit.href + hit.title}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(hit.href)}
                      className="flex w-full items-start gap-3 px-3 py-2 text-start transition-colors hover:bg-white/6"
                    >
                      <span className="mt-0.5 shrink-0 rounded border border-white/10 bg-white/4 px-1.5 py-0.5 text-[0.625rem] text-mist-400">
                        {hit.kind}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] text-mist-100">
                          {hit.title}
                        </span>
                        <span className="block truncate text-[0.6875rem] text-mist-500">
                          {hit.subtitle}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          <Chip tone="warn" className="hidden xl:inline-flex">
            {t("app.demoBadge")}
          </Chip>
          <Chip tone="warn" className="hidden sm:inline-flex xl:hidden">
            {t("app.demoBadgeShort")}
          </Chip>

          {/* Company selector — single tenant in this demo, shown for completeness */}
          <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 md:flex">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-mist-500" />
            <span className="max-w-[13rem] truncate text-[0.75rem] text-mist-200">
              {L(company.name, company.nameAr)}
            </span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCopilotOpen(true)}
            className="gap-1.5"
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{t("top.copilot")}</span>
          </Button>

          <button
            onClick={toggleLocale}
            aria-label={t("top.language")}
            title={t("top.language")}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-2.5 text-[0.75rem] font-medium text-mist-200 transition-colors hover:border-white/20 hover:bg-white/8"
          >
            <Languages className="h-3.5 w-3.5" />
            {t("top.language")}
          </button>

          <div className="relative">
            <button
              onClick={() => setNotificationsOpen((v) => !v)}
              aria-label={t("top.notifications")}
              className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/4 text-mist-300 transition-colors hover:border-white/20 hover:bg-white/8 hover:text-mist-50"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-escalate-500" />
            </button>
            <NotificationsPopover
              open={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
            />
          </div>

          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-1.5 py-1.5 transition-colors hover:border-white/20 hover:bg-white/8"
            title={`${currentReviewer.name} · ${currentReviewer.role}`}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-accent-500 to-info-500 text-[0.625rem] font-bold text-white">
              {currentReviewer.initials}
            </span>
            <span className="hidden min-w-0 pe-1 lg:block">
              <span className="block truncate text-[0.75rem] leading-tight text-mist-100">
                {L(currentReviewer.name, currentReviewer.nameAr)}
              </span>
              <span className="block truncate text-[0.625rem] leading-tight text-mist-500">
                {L(currentReviewer.role, currentReviewer.roleAr)}
              </span>
            </span>
          </Link>
        </div>
      </div>

      {/* Persistent synthetic-data notice for the narrow breakpoints */}
      <div className={cn("hairline-t px-4 py-1.5 sm:hidden")}>
        <p className="text-center text-[0.625rem] text-flag-400">{t("app.demoBadge")}</p>
      </div>
    </header>
  );
}
