"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { company, currentReviewer } from "@/lib/data/company";
import { policy } from "@/lib/data/policy";
import { formatAed } from "@/lib/format";
import { useAppStore } from "@/lib/store/app-store";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button } from "@/components/ui/primitives";

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
    <header className="sticky top-0 z-30 border-b border-[--hairline] bg-white">
      <div className="flex h-12 items-center gap-3 px-4 lg:px-7">
        <button
          onClick={onOpenMobileNav}
          aria-label={t("nav.menu")}
          className="rounded-[0.1875rem] p-1.5 text-ink-600 transition-colors hover:bg-ink-100 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="relative min-w-0 flex-1 max-w-md">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
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
            className="h-8 w-full rounded-[0.1875rem] border border-[--hairline] bg-ink-50 ps-8 pe-3 text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:border-[--hairline-strong] focus:bg-white focus:outline-none"
          />
          {focused && query.trim().length >= 2 ? (
            <div className="absolute inset-x-0 top-9 z-40 max-h-80 overflow-y-auto rounded-[0.1875rem] border border-[--hairline-strong] bg-white py-1 shadow-lg">
              {hits.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-ink-500">{t("top.noResults")}</p>
              ) : (
                hits.map((hit) => (
                  <button
                    key={hit.href + hit.title}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(hit.href)}
                    className="flex w-full items-start gap-2.5 px-3 py-1.5 text-start transition-colors hover:bg-ink-50"
                  >
                    <span className="label mt-0.5 shrink-0">{hit.kind}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] text-ink-900">
                        {hit.title}
                      </span>
                      <span className="block truncate text-[0.6875rem] text-ink-500">
                        {hit.subtitle}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="ms-auto flex items-center gap-4">
          <span className="hidden max-w-[16rem] truncate text-[0.75rem] text-ink-600 md:block">
            {L(company.name, company.nameAr)}
          </span>

          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setCopilotOpen(true)}>
              {t("top.copilot")}
            </Button>
            <button
              onClick={toggleLocale}
              aria-label={t("top.language")}
              className="h-7 rounded-[0.1875rem] px-2 text-[0.75rem] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              {t("top.language")}
            </button>
          </div>

          <span className="hidden border-s border-[--hairline] ps-4 lg:block">
            <span className="block text-[0.75rem] leading-tight text-ink-900">
              {L(currentReviewer.name, currentReviewer.nameAr)}
            </span>
            <span className="block text-[0.6875rem] leading-tight text-ink-500">
              {L(currentReviewer.role, currentReviewer.roleAr)}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}
