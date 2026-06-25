"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supportedLocales, changeLanguage } from "./config";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = supportedLocales.find((l) => l.code === i18n.language) ?? supportedLocales[0];

  async function handleSelect(code: string) {
    setOpen(false);
    await changeLanguage(code);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("languageSwitcher.label", { defaultValue: "Language" })}
        className="flex items-center gap-1.5 text-xs text-terminal-muted hover:text-terminal-text transition-colors focus-visible:outline-2 focus-visible:outline-terminal-green rounded px-2 py-1"
      >
        <span aria-hidden="true">{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <span aria-hidden="true" className="text-terminal-muted">▾</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label={t("languageSwitcher.label", { defaultValue: "Language" })}
            className="absolute right-0 top-full mt-1 z-20 bg-terminal-surface border border-terminal-border rounded-lg shadow-lg py-1 min-w-[160px] max-h-72 overflow-y-auto"
          >
            {supportedLocales.map((locale) => (
              <li
                key={locale.code}
                role="option"
                aria-selected={locale.code === i18n.language}
                onClick={() => handleSelect(locale.code)}
                onKeyDown={(e) => e.key === "Enter" && handleSelect(locale.code)}
                tabIndex={0}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-terminal-green ${
                  locale.code === i18n.language
                    ? "text-terminal-green bg-terminal-bg"
                    : "text-terminal-text hover:bg-terminal-bg"
                }`}
              >
                <span aria-hidden="true">{locale.flag}</span>
                {locale.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
