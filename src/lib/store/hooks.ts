"use client";

import { useEffect, useMemo } from "react";
import type { AuditEvent, CaseRecord, Locale } from "../types";
import { dictionary, type TranslationKey } from "../i18n/dictionary";
import { baseCases } from "../engine/analysis";
import { applyDecisions, seedAuditEvents, useAppStore } from "./app-store";

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function useLocale(): Locale {
  return useAppStore((s) => s.locale);
}

export function useDirection(): "rtl" | "ltr" {
  return useAppStore((s) => (s.locale === "ar" ? "rtl" : "ltr"));
}

export function useT(): Translate {
  const locale = useLocale();
  return useMemo(
    () => (key, params) => interpolate(dictionary[locale][key] ?? dictionary.en[key] ?? key, params),
    [locale],
  );
}

/** Picks the locale-appropriate string from an `x` / `xAr` pair. */
export function useLocalised(): (en: string, ar: string) => string {
  const locale = useLocale();
  return useMemo(() => (en: string, ar: string) => (locale === "ar" ? ar : en), [locale]);
}

export function localise(locale: Locale, en: string, ar: string): string {
  return locale === "ar" ? ar : en;
}

/** Every case, with any persisted human decision applied. */
export function useCases(): CaseRecord[] {
  const decisions = useAppStore((s) => s.decisions);
  return useMemo(() => applyDecisions(baseCases(), decisions), [decisions]);
}

export function useCase(id: string): CaseRecord | undefined {
  const cases = useCases();
  return useMemo(() => cases.find((c) => c.transaction.id === id), [cases, id]);
}

/** Engine and model events, plus every human decision, newest first. */
export function useAuditEvents(): AuditEvent[] {
  const humanEvents = useAppStore((s) => s.humanAuditEvents);
  return useMemo(() => {
    const seeded = seedAuditEvents();
    return [...humanEvents, ...seeded].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [humanEvents]);
}

/**
 * Rehydrates the persisted store after mount. Doing this in an effect (rather
 * than during render) keeps the first client render identical to the server
 * render, which is what prevents hydration mismatches.
 */
export function useHydrateStore(): boolean {
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated) return;
    void useAppStore.persist.rehydrate();
    useAppStore.getState().markHydrated();
  }, [hydrated]);

  return hydrated;
}
