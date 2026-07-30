"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store/app-store";
import { useDirection, useT } from "@/lib/store/hooks";
import { Button } from "./primitives";

/** Portals only render after mount, which keeps SSR output identical. */
function useMounted(): boolean {
  const hydrated = useAppStore((s) => s.hydrated);
  return hydrated;
}

/* ── Modal ─────────────────────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const mounted = useMounted();
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            className="absolute inset-0 bg-ink-950/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-[0.25rem] border border-[--hairline-strong] bg-white shadow-xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="hairline-b flex items-start justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-[0.875rem] font-semibold text-ink-900">{title}</h2>
                {description ? (
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">{description}</p>
                ) : null}
              </div>
              <button
                onClick={onClose}
                aria-label={t("action.close")}
                className="-me-1 -mt-0.5 rounded-[0.1875rem] p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            ) : null}
            {footer ? <div className="hairline-t px-5 py-3">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Drawer ────────────────────────────────────────────────────────────── */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const mounted = useMounted();
  const direction = useDirection();
  const t = useT();
  const fromEnd = direction === "rtl" ? -1 : 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-ink-950/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col border-s border-[--hairline] bg-white shadow-xl"
            initial={{ x: 340 * fromEnd }}
            animate={{ x: 0 }}
            exit={{ x: 340 * fromEnd }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="hairline-b flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-[0.875rem] font-semibold text-ink-900">{title}</h2>
                {subtitle ? <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p> : null}
              </div>
              <button
                onClick={onClose}
                aria-label={t("action.close")}
                className="rounded-[0.1875rem] p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer ? <div className="hairline-t px-4 py-3">{footer}</div> : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Toasts ────────────────────────────────────────────────────────────── */

const toastTone = {
  success: "border-s-pass-600",
  info: "border-s-accent-600",
  warning: "border-s-flag-600",
} as const;

export function ToastViewport() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  const mounted = useMounted();

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) => setTimeout(() => dismiss(toast.id), 4200));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-5 end-5 z-[60] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-[0.1875rem] border border-[--hairline-strong] border-s-2 bg-white px-4 py-2.5 shadow-lg",
              toastTone[toast.tone],
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-medium text-ink-900">{toast.title}</p>
              {toast.body ? (
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{toast.body}</p>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 text-ink-400 transition-colors hover:text-ink-800"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/** Confirmation footer shared by every reviewer action modal. */
export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="ghost" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button variant="primary" onClick={onConfirm} disabled={disabled}>
        {confirmLabel}
      </Button>
    </div>
  );
}
