"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { answerQuestion, localiseAnswer, suggestedQuestions } from "@/lib/ai/copilot";
import type { CopilotMessage } from "@/lib/types";
import { useAppStore } from "@/lib/store/app-store";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Drawer } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";

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

    // A short delay makes the retrieval step legible in a live walkthrough; the
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
            className="h-8 min-w-0 flex-1 rounded-[0.1875rem] border border-[--hairline] bg-white px-3 text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:border-[--hairline-strong] focus:outline-none"
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
          <p className="text-xs leading-relaxed text-ink-500">{t("copilot.empty")}</p>
        ) : null}

        {messages.map((message) =>
          message.role === "user" ? (
            <p
              key={message.id}
              className="self-end max-w-[85%] rounded-[0.1875rem] bg-ink-100 px-3 py-2 text-[0.8125rem] leading-relaxed text-ink-900"
            >
              {message.text}
            </p>
          ) : (
            <AnswerCard key={message.id} message={message} />
          ),
        )}

        {thinking ? <p className="text-xs text-ink-500">{t("copilot.thinking")}</p> : null}

        <div className="mt-auto pt-3">
          <p className="label mb-2">{t("copilot.suggested")}</p>
          <div className="flex flex-col items-start gap-1">
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => ask(L(q.en, q.ar))}
                disabled={thinking}
                className="text-start text-[0.75rem] leading-snug text-accent-600 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {L(q.en, q.ar)}
              </button>
            ))}
          </div>
          {messages.length > 0 ? (
            <button
              onClick={clear}
              className="mt-3 text-[0.6875rem] text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
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
      <p className="panel px-3 py-2.5 text-[0.8125rem] leading-relaxed text-ink-800">
        {message.text}
      </p>
    );
  }

  const answer = message.answer;
  const view = localiseAnswer(answer, locale);

  return (
    <div className="panel overflow-hidden">
      <p className="whitespace-pre-wrap px-3 py-2.5 text-[0.8125rem] leading-relaxed text-ink-900">
        {view.text}
      </p>

      {answer.figures.length > 0 ? (
        <div className="hairline-t px-3 py-2.5">
          <p className="label mb-1.5">{t("copilot.figures")}</p>
          <dl className="space-y-0.5">
            {answer.figures.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-[0.6875rem] text-ink-500">{L(f.label, f.labelAr)}</dt>
                <dd className="numeric text-[0.75rem] font-medium text-ink-900">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {answer.supportingTransactionIds.length > 0 || answer.citedClauseIds.length > 0 ? (
        <div className="hairline-t flex flex-wrap gap-x-4 gap-y-1 px-3 py-2.5">
          {[...new Set(answer.supportingTransactionIds)].map((id) => (
            <Link
              key={id}
              href={`/transactions/${id}`}
              className="numeric font-mono text-[0.6875rem] text-accent-600 hover:underline"
            >
              {id}
            </Link>
          ))}
          {[...new Set(answer.citedClauseIds)].map((id) => (
            <Link
              key={id}
              href={`/policy?clause=${id}`}
              className="numeric font-mono text-[0.6875rem] text-ink-600 hover:underline"
            >
              {id}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="hairline-t px-3 py-2.5">
        <p className="label mb-1">{t("copilot.missing")}</p>
        {view.missing.length === 0 ? (
          <p className="text-[0.75rem] text-ink-500">{t("copilot.noneMissing")}</p>
        ) : (
          <ul className="space-y-0.5">
            {view.missing.map((item) => (
              <li key={item} className="text-[0.75rem] leading-relaxed text-ink-700">
                — {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hairline-t bg-ink-50 px-3 py-2.5">
        <p className="label mb-1">{t("copilot.nextAction")}</p>
        <p className="text-[0.75rem] leading-relaxed text-ink-800">{view.nextAction}</p>
        <p className="mt-2 text-[0.625rem] text-ink-500">{t("copilot.draftNotice")}</p>
      </div>
    </div>
  );
}
