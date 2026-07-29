"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { answerQuestion, localiseAnswer, suggestedQuestions } from "@/lib/ai/copilot";
import type { CopilotMessage } from "@/lib/types";
import { useAppStore } from "@/lib/store/app-store";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Drawer } from "@/components/ui/overlays";
import { Button, Chip } from "@/components/ui/primitives";

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

export function CopilotDrawer() {
  const t = useT();
  const L = useLocalised();
  const cases = useCases();
  const pathname = usePathname();

  const open = useAppStore((s) => s.copilotOpen);
  const setOpen = useAppStore((s) => s.setCopilotOpen);
  const messages = useAppStore((s) => s.copilotMessages);
  const append = useAppStore((s) => s.appendCopilotMessage);
  const clear = useAppStore((s) => s.clearCopilot);

  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** "This case" resolves to whatever transaction is open behind the drawer. */
  const focusTransactionId = useMemo(() => {
    const match = pathname.match(/^\/transactions\/([^/]+)/);
    return match?.[1];
  }, [pathname]);

  const questions = suggestedQuestions.filter((q) => !q.requiresFocus || focusTransactionId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || thinking) return;

    append({
      id: nextMessageId(),
      role: "user",
      text: trimmed,
      createdAt: new Date().toISOString(),
    });
    setInput("");
    setThinking(true);

    // A short delay makes the retrieval step legible in a live demo; the
    // answer itself is computed synchronously from the ledger.
    window.setTimeout(() => {
      const answer = answerQuestion(trimmed, { cases, focusTransactionId });
      const assistantMessage: CopilotMessage = {
        id: nextMessageId(),
        role: "assistant",
        text: answer ? "" : t("copilot.unknown"),
        answer: answer ?? undefined,
        createdAt: new Date().toISOString(),
      };
      append(assistantMessage);
      setThinking(false);
    }, 420);
  }

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      title={t("copilot.title")}
      subtitle={t("copilot.subtitle")}
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("copilot.placeholder")}
            aria-label={t("copilot.placeholder")}
            className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/4 px-3 text-[0.8125rem] text-mist-100 placeholder:text-mist-500 focus:border-white/20 focus:outline-none"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!input.trim() || thinking}>
            <ArrowUp className="h-3.5 w-3.5" />
            <span className="sr-only">{t("copilot.send")}</span>
          </Button>
        </form>
      }
    >
      <div ref={scrollRef} className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-white/8 bg-white/3 p-3.5">
            <div className="flex items-center gap-2 text-[0.8125rem] font-medium text-mist-100">
              <Sparkles className="h-3.5 w-3.5 text-accent-400" />
              {t("copilot.title")}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-mist-400">{t("copilot.empty")}</p>
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg rounded-ee-sm bg-accent-600/22 px-3 py-2 text-[0.8125rem] leading-relaxed text-mist-50">
                {message.text}
              </p>
            </div>
          ) : (
            <AnswerCard key={message.id} message={message} />
          ),
        )}

        {thinking ? (
          <div className="flex items-center gap-2 px-1 text-xs text-mist-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("copilot.thinking")}
          </div>
        ) : null}

        <div className="mt-auto pt-2">
          <p className="mb-2 text-[0.6875rem] uppercase tracking-wide text-mist-500">
            {t("copilot.suggested")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => ask(L(q.en, q.ar))}
                disabled={thinking}
                className="rounded-md border border-white/10 bg-white/4 px-2.5 py-1.5 text-start text-[0.6875rem] leading-snug text-mist-300 transition-colors hover:border-white/20 hover:bg-white/8 hover:text-mist-100 disabled:opacity-50"
              >
                {L(q.en, q.ar)}
              </button>
            ))}
          </div>
          {messages.length > 0 ? (
            <button
              onClick={clear}
              className="mt-2.5 text-[0.6875rem] text-mist-500 underline-offset-2 hover:text-mist-300 hover:underline"
            >
              {t("action.reset")}
            </button>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}

function AnswerCard({ message }: { message: CopilotMessage }) {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();

  if (!message.answer) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="panel px-3.5 py-3"
      >
        <p className="text-[0.8125rem] leading-relaxed text-mist-200">{message.text}</p>
      </motion.div>
    );
  }

  const answer = message.answer;
  const view = localiseAnswer(answer, locale);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="panel overflow-hidden"
    >
      <div className="px-3.5 py-3">
        <p className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-mist-100">
          {view.text}
        </p>
      </div>

      {answer.figures.length > 0 ? (
        <div className="hairline-t px-3.5 py-2.5">
          <p className="mb-1.5 text-[0.625rem] uppercase tracking-wide text-mist-500">
            {t("copilot.figures")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {answer.figures.map((f) => (
              <Chip key={f.label} tone="neutral">
                <span className="text-mist-500">{L(f.label, f.labelAr)}</span>
                <span className="numeric text-mist-100">{f.value}</span>
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {answer.supportingTransactionIds.length > 0 ? (
        <div className="hairline-t px-3.5 py-2.5">
          <p className="mb-1.5 text-[0.625rem] uppercase tracking-wide text-mist-500">
            {t("copilot.supporting")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(answer.supportingTransactionIds)].map((id) => (
              <Link
                key={id}
                href={`/transactions/${id}`}
                className="numeric rounded-md border border-info-500/25 bg-info-500/10 px-2 py-1 font-mono text-[0.6875rem] text-info-400 transition-colors hover:bg-info-500/20"
              >
                {id}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {answer.citedClauseIds.length > 0 ? (
        <div className="hairline-t px-3.5 py-2.5">
          <p className="mb-1.5 text-[0.625rem] uppercase tracking-wide text-mist-500">
            {t("copilot.clauses")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(answer.citedClauseIds)].map((id) => (
              <Link
                key={id}
                href={`/policy?clause=${id}`}
                className="rounded-md border border-white/10 bg-white/4 px-2 py-1 font-mono text-[0.6875rem] text-mist-300 transition-colors hover:border-white/20 hover:text-mist-100"
              >
                {id}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="hairline-t px-3.5 py-2.5">
        <p className="mb-1 text-[0.625rem] uppercase tracking-wide text-mist-500">
          {t("copilot.missing")}
        </p>
        {view.missing.length === 0 ? (
          <p className="text-[0.75rem] text-mist-400">{t("copilot.noneMissing")}</p>
        ) : (
          <ul className="space-y-1">
            {view.missing.map((item) => (
              <li key={item} className="flex gap-2 text-[0.75rem] leading-relaxed text-mist-300">
                <span className="text-flag-400">•</span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hairline-t bg-white/2 px-3.5 py-2.5">
        <p className="mb-1 text-[0.625rem] uppercase tracking-wide text-mist-500">
          {t("copilot.nextAction")}
        </p>
        <p className="text-[0.75rem] leading-relaxed text-mist-200">{view.nextAction}</p>
        <p className="mt-2 text-[0.625rem] text-flag-400">{t("copilot.draftNotice")}</p>
      </div>
    </motion.div>
  );
}
