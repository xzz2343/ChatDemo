"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { changeLanguage, supportedLocales } from "./config";

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem("i18n-lang");
    const browserLang = navigator.language.split("-")[0];
    const preferred = saved ?? browserLang;
    const valid = supportedLocales.some((l) => l.code === preferred) ? preferred : "en";
    document.documentElement.lang = valid;
    if (valid !== "en") {
      changeLanguage(valid);
    }
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
