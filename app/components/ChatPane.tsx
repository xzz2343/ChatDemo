"use client";

import { useEffect, useRef, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Message } from "../hooks/useSSEChat";

interface ChatPaneProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;
  chatsUsed: number;
  maxChats: number;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
}

export default function ChatPane({
  messages,
  streamingContent,
  isStreaming,
  error,
  chatsUsed,
  maxChats,
  onSend,
  onStop,
  onClear,
}: ChatPaneProps) {
  const { t } = useTranslation();
  const limitReached = chatsUsed >= maxChats;
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const text = (fd.get("message") as string).trim();
    if (!text || isStreaming) return;
    form.reset();
    onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section
      className="flex flex-col h-full border border-terminal-border rounded-lg overflow-hidden"
      aria-labelledby="chat-heading"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-terminal-surface border-b border-terminal-border">
        <h2
          id="chat-heading"
          className="text-sm font-semibold text-terminal-green uppercase tracking-widest"
        >
          ● {t("chat.heading", { defaultValue: "Chat" })}
        </h2>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs tabular-nums ${
              limitReached
                ? "text-terminal-red"
                : chatsUsed >= maxChats - 1
                ? "text-terminal-amber"
                : "text-terminal-muted"
            }`}
            aria-live="polite"
            aria-label={`${chatsUsed} of ${maxChats} chats used`}
          >
            {t("chat.chatsCounter", { used: chatsUsed, max: maxChats, defaultValue: `${chatsUsed}/${maxChats} chats` })}
          </span>
          <button
            onClick={onClear}
            className="text-xs text-terminal-muted hover:text-terminal-text transition-colors focus-visible:outline-2 focus-visible:outline-terminal-green rounded px-2 py-1"
            aria-label={t("chat.clearLabel", { defaultValue: "Clear conversation" })}
          >
            {t("chat.clear", { defaultValue: "clear" })}
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        role="log"
        aria-live="polite"
        aria-label={t("chat.heading", { defaultValue: "Chat messages" })}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && !isStreaming && (
          <p className="text-terminal-muted text-sm text-center mt-8">
            {t("chat.placeholder", {
              defaultValue: "Ask anything — try \"What's the weather in Paris?\" or \"What is 1337 × 42?\"",
            })}
          </p>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && streamingContent && (
          <div className="flex gap-3">
            <span
              className="shrink-0 text-xs text-terminal-green-dim pt-0.5 select-none"
              aria-hidden="true"
            >
              AI&gt;
            </span>
            <p className="text-terminal-text text-sm leading-relaxed whitespace-pre-wrap">
              {streamingContent}
              <span className="cursor-blink ml-0.5" aria-hidden="true" />
            </p>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-3" aria-label="AI is thinking">
            <span
              className="shrink-0 text-xs text-terminal-green-dim pt-0.5 select-none"
              aria-hidden="true"
            >
              AI&gt;
            </span>
            <p className="text-terminal-muted text-sm italic">
              {t("chat.thinking", { defaultValue: "thinking" })}
              <span className="cursor-blink ml-0.5" aria-hidden="true" />
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="text-terminal-red text-sm border border-terminal-red rounded px-3 py-2"
          >
            {t("chat.errorPrefix", { defaultValue: "Error:" })} {error}
          </div>
        )}

        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* Input */}
      {limitReached ? (
        <div className="p-3 border-t border-terminal-border bg-terminal-surface text-center text-xs text-terminal-muted">
          {t("chat.limitReached", { defaultValue: "Session limit reached." })}{" "}
          <button
            onClick={onClear}
            className="underline text-terminal-amber hover:text-terminal-text transition-colors focus-visible:outline-2 focus-visible:outline-terminal-green rounded"
          >
            {t("chat.refreshSession", { defaultValue: "Refresh your session" })}
          </button>{" "}
          {t("chat.refreshSessionSuffix", { defaultValue: "to continue." })}
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 p-3 border-t border-terminal-border bg-terminal-surface"
        >
          <label htmlFor="chat-input" className="sr-only">
            {t("chat.inputLabel", { defaultValue: "Message" })}
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            name="message"
            rows={2}
            placeholder={t("chat.inputPlaceholder", {
              defaultValue: "Type a message… (Enter to send, Shift+Enter for newline)",
            })}
            disabled={isStreaming}
            onKeyDown={handleKeyDown}
            className="flex-1 resize-none bg-terminal-bg text-terminal-text placeholder-terminal-muted border border-terminal-border rounded px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-green disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="px-3 py-2 text-xs bg-terminal-red text-white rounded hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-terminal-green"
              aria-label={t("chat.stopLabel", { defaultValue: "Stop generation" })}
            >
              {t("chat.stop", { defaultValue: "stop" })}
            </button>
          ) : (
            <button
              type="submit"
              className="px-3 py-2 text-xs bg-terminal-green text-terminal-bg rounded hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-terminal-green font-semibold disabled:opacity-50"
              disabled={isStreaming}
              aria-label={t("chat.sendLabel", { defaultValue: "Send message" })}
            >
              {t("chat.send", { defaultValue: "send" })}
            </button>
          )}
        </form>
      )}
    </section>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className="flex gap-3">
      <span
        className={`shrink-0 text-xs pt-0.5 select-none ${
          isUser ? "text-terminal-amber" : "text-terminal-green-dim"
        }`}
        aria-hidden="true"
      >
        {isUser ? "you>" : "AI>"}
      </span>
      <p className="text-terminal-text text-sm leading-relaxed whitespace-pre-wrap">
        {message.content}
      </p>
    </div>
  );
}
