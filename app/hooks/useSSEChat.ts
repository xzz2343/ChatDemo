"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
}

export type LogEventType =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "response_start"
  | "stats"
  | "error"
  | "done";

export interface LogEvent {
  id: string;
  type: LogEventType;
  timestamp: Date;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  elapsedMs?: number;
  tokens?: number;
}

interface SSEPayload {
  type: string;
  content?: string;
  name?: string;
  input?: Record<string, unknown>;
  result?: string;
  elapsed_ms?: number;
  tokens?: number;
  message?: string;
}

const PROXY_URL =
  process.env.NEXT_PUBLIC_PROXY_URL ?? "/proxy.php";

export const MAX_CHATS_PER_SESSION = 5;

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function getOrCreateSessionToken(): string {
  const KEY = "llmdemo_session_token";
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(KEY, token);
  }
  return token;
}

function loadStoredChatCount(): number {
  return parseInt(localStorage.getItem("llmdemo_chat_count") ?? "0", 10);
}

export function useSSEChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatsUsed, setChatsUsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setChatsUsed(loadStoredChatCount());
  }, []);

  const appendEvent = useCallback((event: Omit<LogEvent, "id" | "timestamp">) => {
    setEvents((prev) => [
      ...prev,
      { ...event, id: uid(), timestamp: new Date() },
    ]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming || !text.trim()) return;

      const userMessage: Message = { id: uid(), role: "user", content: text.trim() };

      setMessages((prev) => [...prev, userMessage]);
      setStreamingContent("");
      setError(null);
      setIsStreaming(true);

      appendEvent({ type: "thinking", content: "User message received" });

      const controller = new AbortController();
      abortRef.current = controller;

      let accumulated = "";

      try {
        const conversationMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const sessionToken = getOrCreateSessionToken();

        const response = await fetch(PROXY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": sessionToken,
          },
          body: JSON.stringify({ messages: conversationMessages }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("Empty response from server");
        }

        let receivedDone = false;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;

            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr === "[DONE]") continue;

            let payload: SSEPayload;
            try {
              payload = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            switch (payload.type) {
              case "thinking":
                appendEvent({ type: "thinking", content: payload.content });
                break;

              case "tool_call":
                appendEvent({
                  type: "tool_call",
                  toolName: payload.name,
                  toolInput: payload.input,
                });
                break;

              case "tool_result":
                appendEvent({
                  type: "tool_result",
                  toolName: payload.name,
                  content: payload.result,
                });
                break;

              case "response_start":
                appendEvent({ type: "response_start", content: "Generating response…" });
                break;

              case "text_delta":
                accumulated += payload.content ?? "";
                setStreamingContent(accumulated);
                break;

              case "stats":
                appendEvent({
                  type: "stats",
                  elapsedMs: payload.elapsed_ms,
                  tokens: payload.tokens,
                });
                break;

              case "error":
                setError(payload.message ?? "Unknown error");
                appendEvent({ type: "error", content: payload.message });
                break;

              case "done":
                receivedDone = true;
                appendEvent({ type: "done" });
                setChatsUsed((prev) => {
                  const next = prev + 1;
                  localStorage.setItem("llmdemo_chat_count", String(next));
                  return next;
                });
                break;
            }
          }
        }

        if (accumulated) {
          setMessages((prev) => [
            ...prev,
            { id: uid(), role: "assistant", content: accumulated },
          ]);
        }

        if (!receivedDone && !accumulated) {
          const msg = "Connection closed unexpectedly. Please try again.";
          setError(msg);
          appendEvent({ type: "error", content: msg });
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const msg = (err as Error).message;
          setError(msg);
          appendEvent({ type: "error", content: msg });
        }
      } finally {
        setStreamingContent("");
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, appendEvent]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearAll = useCallback(() => {
    setMessages([]);
    setEvents([]);
    setStreamingContent("");
    setError(null);
  }, []);

  return {
    messages,
    events,
    streamingContent,
    isStreaming,
    error,
    chatsUsed,
    sendMessage,
    stopStreaming,
    clearAll,
  };
}
