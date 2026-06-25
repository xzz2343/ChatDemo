import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const supportedLocales = [
  { code: "en",    label: "English",           flag: "🇺🇸" },
  { code: "de",    label: "Deutsch",            flag: "🇩🇪" },
  { code: "fr",    label: "Français",           flag: "🇫🇷" },
  { code: "es",    label: "Español",            flag: "🇪🇸" },
  { code: "it",    label: "Italiano",           flag: "🇮🇹" },
  { code: "nl",    label: "Nederlands",         flag: "🇳🇱" },
  { code: "sv",    label: "Svenska",            flag: "🇸🇪" },
  { code: "no",    label: "Norsk",              flag: "🇳🇴" },
  { code: "ja",    label: "日本語",              flag: "🇯🇵" },
  { code: "zh-CN", label: "中文（简体）",         flag: "🇨🇳" },
  { code: "hi",    label: "हिन्दी",              flag: "🇮🇳" },
];

// English UI strings bundled inline — no network fetch on first load.
const enCommon = {
  header: {
    subtitle: "powered by Claude",
    toolsLabel: "Tools:",
  },
  chat: {
    heading: "Chat",
    clear: "clear",
    clearLabel: "Clear conversation",
    chatsCounter: "{{used}}/{{max}} chats",
    placeholder: "Ask anything — try \"What's the weather in Paris?\" or \"What is 1337 × 42?\"",
    inputPlaceholder: "Type a message… (Enter to send, Shift+Enter for newline)",
    inputLabel: "Message",
    stop: "stop",
    stopLabel: "Stop generation",
    send: "send",
    sendLabel: "Send message",
    thinking: "thinking",
    errorPrefix: "Error:",
    limitReached: "Session limit reached.",
    refreshSession: "Refresh your session",
    refreshSessionSuffix: "to continue.",
  },
  log: {
    heading: "Agent Internals",
    eventsCount_one: "{{count}} event",
    eventsCount_other: "{{count}} events",
    placeholder: "Events will appear here when you send a message.",
    userMessageReceived: "User message received",
    callingTool: "Calling tool:",
    toolInput: "input:",
    resultFrom: "Result from",
    generating: "Generating response…",
    done: "Done",
    errorPrefix: "Error:",
  },
  languageSwitcher: {
    label: "Language",
  },
  theme: {
    toggleDark: "Switch to dark mode",
    toggleLight: "Switch to light mode",
  },
};

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  ns: ["common"],
  defaultNS: "common",
  resources: { en: { common: enCommon } },
  interpolation: { escapeValue: false },
});

const LOCALE_CACHE_HOURS = 4;

function localeCacheWindow() {
  return Math.floor(Date.now() / (LOCALE_CACHE_HOURS * 3_600_000));
}

async function loadTranslations(lng: string) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const res = await fetch(`${base}/locales/${lng}/common.json?v=${localeCacheWindow()}`);
  if (!res.ok) return {};
  return res.json();
}

export async function changeLanguage(lng: string) {
  const currentWindow = localeCacheWindow();
  const storeKey = `i18n-cache-window-${lng}`;
  const cachedWindow =
    typeof window !== "undefined"
      ? Number(sessionStorage.getItem(storeKey) ?? -1)
      : -1;

  if (!i18n.hasResourceBundle(lng, "common") || cachedWindow !== currentWindow) {
    const resources = await loadTranslations(lng);
    i18n.removeResourceBundle(lng, "common");
    i18n.addResourceBundle(lng, "common", resources);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(storeKey, String(currentWindow));
    }
  }
  await i18n.changeLanguage(lng);
  if (typeof window !== "undefined") {
    localStorage.setItem("i18n-lang", lng);
    document.documentElement.lang = lng;
  }
}

export default i18n;
