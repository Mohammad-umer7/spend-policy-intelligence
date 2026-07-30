import type { Locale } from "./types";

/**
 * The application runs against a fixed "now" so every derived figure — case age,
 * month-to-date spend, forecast — is deterministic across reloads, machines
 * and between server and client rendering.
 */
export const REFERENCE_NOW = "2026-07-24T09:15:00+04:00";
export const REFERENCE_NOW_MS = Date.parse(REFERENCE_NOW);

/** All dates are presented in Gulf Standard Time to avoid hydration drift. */
const TIME_ZONE = "Asia/Dubai";

const localeTag: Record<Locale, string> = {
  en: "en-AE",
  ar: "ar-AE",
};

export function formatAed(amount: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    numberingSystem: "latn",
  }).format(amount);
}

export function formatAedPrecise(amount: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: "latn",
  }).format(amount);
}

export function formatNumber(value: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(localeTag[locale], {
    maximumFractionDigits: 0,
    numberingSystem: "latn",
  }).format(value);
}

export function formatPercent(fraction: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: "percent",
    maximumFractionDigits: 0,
    numberingSystem: "latn",
  }).format(fraction);
}

/** Compact axis labels, e.g. "AED 128k". */
export function formatAedCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${Math.round(amount / 1_000)}k`;
  }
  return String(Math.round(amount));
}

export function formatDate(iso: string, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
    numberingSystem: "latn",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
    numberingSystem: "latn",
  }).format(new Date(iso));
}

export function formatTime(iso: string, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
    numberingSystem: "latn",
  }).format(new Date(iso));
}

export function formatWeekday(iso: string, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    weekday: "long",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** Whole hours between a transaction timestamp and the fixed reference "now". */
export function hoursSince(iso: string): number {
  return Math.max(0, Math.round((REFERENCE_NOW_MS - Date.parse(iso)) / 3_600_000));
}

export function formatAge(hours: number, locale: Locale = "en"): string {
  if (hours < 24) {
    return locale === "ar" ? `${hours} ساعة` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return locale === "ar" ? `${days} يوم` : `${days}d`;
}

/** True for Saturday and Sunday, the UAE corporate weekend used by this policy. */
export function isWeekend(iso: string): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
  return weekday === "Sat" || weekday === "Sun";
}

/** Day-of-month key used for grouping the spend trend chart. */
export function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}
