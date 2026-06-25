"use client";

import { useTranslation } from "react-i18next";
import ChatPane from "./components/ChatPane";
import EventLogPane from "./components/EventLogPane";
import ThemeToggle from "./components/ThemeToggle";
import LanguageSwitcher from "./i18n/LanguageSwitcher";
import { useSSEChat, MAX_CHATS_PER_SESSION } from "./hooks/useSSEChat";

export default function Home() {
  const { t } = useTranslation();
  const {
    messages,
    events,
    streamingContent,
    isStreaming,
    error,
    chatsUsed,
    sendMessage,
    stopStreaming,
    clearAll,
  } = useSSEChat();

  return (
    <div className="flex flex-col min-h-screen bg-terminal-bg">
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-terminal-border bg-terminal-surface"
        role="banner"
      >
        <div className="flex items-center gap-3">
          {/* Traffic-light dots — decorative */}
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </span>
          <h1 className="text-sm font-semibold text-terminal-text tracking-wide">
            <span className="text-terminal-green">chat</span>
            <span className="text-terminal-muted">-</span>
            <span className="text-terminal-blue">demo</span>
            <span className="text-terminal-muted">
              {" "}— {t("header.subtitle", { defaultValue: "powered by Claude" })}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-terminal-muted mr-2">
            <span>{t("header.toolsLabel", { defaultValue: "Tools:" })}</span>
            <code className="text-terminal-amber">get_weather</code>
            <code className="text-terminal-amber">calculate</code>
            <code className="text-terminal-amber">get_datetime</code>
          </div>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="px-4 py-1.5 border-b border-terminal-border bg-terminal-surface"
      >
        <ol className="flex items-center gap-1.5 text-xs text-terminal-muted select-none">
          <li>
            <a
              href="https://www.buckshot-consulting.com/resume/"
              className="hover:text-terminal-text transition-colors"
            >
              Experience
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li className="text-terminal-text font-medium" aria-current="page">
            Chat Demo
          </li>
        </ol>
      </nav>

      {/* Main content */}
      <main
        id="main-content"
        className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 overflow-hidden"
        style={{ height: "calc(100vh - 82px)" }}
      >
        <ChatPane
          messages={messages}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          error={error}
          chatsUsed={chatsUsed}
          maxChats={MAX_CHATS_PER_SESSION}
          onSend={sendMessage}
          onStop={stopStreaming}
          onClear={clearAll}
        />
        <EventLogPane events={events} />
      </main>
    </div>
  );
}
