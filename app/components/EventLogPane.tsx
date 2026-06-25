"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { LogEvent } from "../hooks/useSSEChat";

interface EventLogPaneProps {
  events: LogEvent[];
}

export default function EventLogPane({ events }: EventLogPaneProps) {
  const { t, i18n } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <section
      className="flex flex-col h-full border border-terminal-border rounded-lg overflow-hidden"
      aria-labelledby="log-heading"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-terminal-surface border-b border-terminal-border">
        <h2
          id="log-heading"
          className="text-sm font-semibold text-terminal-blue uppercase tracking-widest"
        >
          ◈ {t("log.heading", { defaultValue: "Agent Internals" })}
        </h2>
        <span className="text-xs text-terminal-muted">
          {t("log.eventsCount", {
            count: events.length,
            defaultValue: `${events.length} ${events.length !== 1 ? "events" : "event"}`,
          })}
        </span>
      </header>

      {/* Log entries */}
      <div
        role="log"
        aria-live="polite"
        aria-label={t("log.heading", { defaultValue: "Agent event log" })}
        className="flex-1 overflow-y-auto p-4 space-y-2 text-xs font-mono"
      >
        {events.length === 0 && (
          <p className="text-terminal-muted text-center mt-8">
            {t("log.placeholder", {
              defaultValue: "Events will appear here when you send a message.",
            })}
          </p>
        )}

        {events.map((event) => (
          <LogEntry key={event.id} event={event} locale={i18n.language} t={t} />
        ))}

        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </section>
  );
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

function formatTime(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LogEntry({ event, locale, t }: { event: LogEvent; locale: string; t: TFn }) {
  const ts = (
    <span className="text-terminal-muted select-none mr-2">
      [{formatTime(event.timestamp, locale)}]
    </span>
  );

  switch (event.type) {
    case "thinking":
      return (
        <div className="text-terminal-muted">
          {ts}
          <span aria-hidden="true">→ </span>
          {t("log.userMessageReceived", { defaultValue: "User message received" })}
        </div>
      );

    case "tool_call":
      return (
        <div className="space-y-0.5">
          <div className="text-terminal-amber">
            {ts}
            <span aria-hidden="true">⚡ </span>
            {t("log.callingTool", { defaultValue: "Calling tool:" })}{" "}
            <span className="text-terminal-green">{event.toolName}</span>
          </div>
          {event.toolInput && Object.keys(event.toolInput).length > 0 && (
            <div className="pl-[10ch] text-terminal-muted">
              {t("log.toolInput", { defaultValue: "input:" })}{" "}
              <span className="text-terminal-text">
                {JSON.stringify(event.toolInput)}
              </span>
            </div>
          )}
        </div>
      );

    case "tool_result":
      return (
        <div className="text-terminal-green-dim">
          {ts}
          <span aria-hidden="true">← </span>
          {t("log.resultFrom", { defaultValue: "Result from" })}{" "}
          <span className="text-terminal-green">{event.toolName}</span>
          {": "}
          <span className="text-terminal-text">{event.content}</span>
        </div>
      );

    case "response_start":
      return (
        <div className="text-terminal-blue">
          {ts}
          <span aria-hidden="true">→ </span>
          {t("log.generating", { defaultValue: "Generating response…" })}
        </div>
      );

    case "stats":
      return (
        <div className="text-terminal-green border-t border-terminal-border pt-2 mt-2">
          {ts}
          <span aria-hidden="true">✓ </span>
          {t("log.done", { defaultValue: "Done" })}{" "}
          {event.elapsedMs !== undefined && (
            <span className="text-terminal-muted">
              ({(event.elapsedMs / 1000).toFixed(1)}s
              {event.tokens !== undefined ? `, ~${event.tokens} tokens` : ""})
            </span>
          )}
        </div>
      );

    case "error":
      return (
        <div role="alert" className="text-terminal-red">
          {ts}
          <span aria-hidden="true">✗ </span>
          {t("log.errorPrefix", { defaultValue: "Error:" })} {event.content}
        </div>
      );

    case "done":
      return null;

    default:
      return null;
  }
}
