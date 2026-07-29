/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { baseCases } from "@/lib/engine/analysis";
import { STORAGE_KEY, applyDecisions, useAppStore } from "@/lib/store/app-store";

const cases = baseCases();
const hotel = cases.find((c) => c.transaction.id === "TXN-2041")!;

describe("localStorage persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      decisions: {},
      humanAuditEvents: [],
      approvedPrecedents: [],
      declinedPrecedents: [],
      copilotMessages: [],
      locale: "en",
      sidebarCollapsed: false,
      hydrated: false,
    });
  });

  it("writes reviewer decisions to the versioned key", () => {
    useAppStore.getState().recordDecision({
      record: hotel,
      action: "approve_exception",
      note: "Approved as a documented exception.",
      timestamp: "2026-07-24T10:00:00+04:00",
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.decisions["TXN-2041"].status).toBe("approved");
    expect(parsed.state.humanAuditEvents).toHaveLength(1);
  });

  it("restores decisions and audit events on rehydrate", async () => {
    useAppStore.getState().recordDecision({
      record: hotel,
      action: "approve_exception",
      note: "Approved as a documented exception.",
      timestamp: "2026-07-24T10:00:00+04:00",
    });
    const saved = localStorage.getItem(STORAGE_KEY)!;

    // Simulate a page refresh: wipe in-memory state, keep storage.
    useAppStore.setState({ decisions: {}, humanAuditEvents: [] });
    localStorage.setItem(STORAGE_KEY, saved);
    await useAppStore.persist.rehydrate();

    const state = useAppStore.getState();
    expect(state.decisions["TXN-2041"]?.status).toBe("approved");
    expect(state.humanAuditEvents).toHaveLength(1);

    const restored = applyDecisions(cases, state.decisions);
    expect(restored.find((c) => c.transaction.id === "TXN-2041")!.status).toBe("approved");
  });

  it("persists the locale and sidebar preference", async () => {
    useAppStore.getState().setLocale("ar");
    useAppStore.getState().setSidebarCollapsed(true);
    const saved = localStorage.getItem(STORAGE_KEY)!;

    useAppStore.setState({ locale: "en", sidebarCollapsed: false });
    localStorage.setItem(STORAGE_KEY, saved);
    await useAppStore.persist.rehydrate();

    expect(useAppStore.getState().locale).toBe("ar");
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
  });

  it("does not persist transient UI state", () => {
    useAppStore.getState().setCopilotOpen(true);
    useAppStore.getState().pushToast({ tone: "info", title: "hello" });
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(parsed.state.copilotOpen).toBeUndefined();
    expect(parsed.state.toasts).toBeUndefined();
  });

  it("clears storage-backed state when the demo is reset", async () => {
    useAppStore.getState().recordDecision({ record: hotel, action: "reject", note: "no" });
    useAppStore.getState().resetDemo();
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().decisions).toEqual({});
    expect(useAppStore.getState().humanAuditEvents).toHaveLength(0);
  });

  it("survives corrupt stored data without throwing", async () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    await expect(useAppStore.persist.rehydrate()).resolves.not.toThrow();
  });
});
