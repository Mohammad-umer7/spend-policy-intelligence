"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, FileWarning, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { departmentBudgets } from "@/lib/engine/budget";
import { formatAed, formatAge } from "@/lib/format";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";

/**
 * Notifications are derived from the same case data as everything else, so the
 * counts here can never drift from the queue.
 */
export function NotificationsPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const cases = useCases();

  const items = useMemo(() => {
    const escalations = cases
      .filter((c) => c.status === "pending_review" && c.analysis.verdict === "escalate")
      .map((c) => ({
        id: c.transaction.id,
        href: `/transactions/${c.transaction.id}`,
        icon: AlertTriangle,
        tone: "text-escalate-400",
        title: L(c.analysis.headline, c.analysis.headlineAr),
        body: `${c.transaction.id} · ${L(c.transaction.merchant, c.transaction.merchantAr)} · ${formatAed(c.transaction.amountAed, locale)}`,
        meta: formatAge(c.ageHours, locale),
      }));

    const overBudget = departmentBudgets()
      .filter((b) => b.isForecastOverBudget)
      .map((b) => ({
        id: `budget-${b.department.id}`,
        href: "/brief",
        icon: TrendingUp,
        tone: "text-flag-400",
        title: `${L(b.department.name, b.department.nameAr)} — ${t("overview.forecastOver")}`,
        body: `${formatAed(b.forecastAed, locale)} ${t("common.of")} ${formatAed(b.department.monthlyBudgetAed, locale)}`,
        meta: `+${formatAed(b.varianceAed, locale)}`,
      }));

    const missingEvidence = cases.filter(
      (c) => c.status === "pending_review" && c.analysis.evidence.missing.length > 0,
    );
    const evidenceItem = missingEvidence.length
      ? [
          {
            id: "missing-evidence",
            href: "/queue?filter=missingEvidence",
            icon: FileWarning,
            tone: "text-info-400",
            title: t("overview.missingEvidence"),
            body: t("overview.acrossTransactions", { count: missingEvidence.length }),
            meta: String(missingEvidence.length),
          },
        ]
      : [];

    return [...escalations, ...overBudget, ...evidenceItem];
  }, [cases, locale, L, t]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="panel-raised absolute end-0 top-11 z-40 w-80 overflow-hidden shadow-2xl"
          >
            <div className="hairline-b px-3.5 py-2.5">
              <p className="text-[0.8125rem] font-semibold text-mist-50">
                {t("top.notifications")}
              </p>
            </div>
            <div className="max-h-80 divide-y divide-white/6 overflow-y-auto">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onClose}
                    className="flex items-start gap-2.5 px-3.5 py-3 transition-colors hover:bg-white/5"
                  >
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.tone}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] leading-snug text-mist-100">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.6875rem] text-mist-500">
                        {item.body}
                      </span>
                    </span>
                    <span className="numeric shrink-0 text-[0.6875rem] text-mist-500">
                      {item.meta}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
