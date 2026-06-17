"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import {
  type AppLocale,
  LANGUAGE_OPTIONS,
  LOCALE_STORAGE_KEY,
  isAppLocale,
  localeToHtmlLang,
} from "@/i18n/config";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import mr from "../../messages/mr.json";

export type AppLanguage = AppLocale;
export { LANGUAGE_OPTIONS };

type LocaleMessages = {
  common: Record<string, string>;
  auth: Record<string, string>;
};

const allMessages: Record<AppLocale, LocaleMessages> = { en, hi, mr };

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("en");

  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && isAppLocale(saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(saved);
      document.documentElement.lang = localeToHtmlLang(saved);
    }
  }, []);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    document.documentElement.lang = localeToHtmlLang(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = localeToHtmlLang(locale);
  }, [locale]);

  const localeContext = useMemo(
    () => ({ locale, setLocale }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={localeContext}>
      <NextIntlClientProvider
        locale={locale}
        messages={allMessages[locale]}
        getMessageFallback={({ key }) => key}
        onError={() => {}}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

function useLocaleContext() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}

export function useI18n() {
  const { locale, setLocale } = useLocaleContext();
  const tCommon = useTranslations("common");

  const t = useCallback((key: string) => tCommon(key), [tCommon]);

  return useMemo(
    () => ({
      language: locale,
      setLanguage: setLocale,
      t,
    }),
    [locale, setLocale, t],
  );
}

export function translateStaticText(key: string, language: AppLanguage) {
  if (language === "en") return key;
  const messages = allMessages[language]?.common;
  return messages?.[key] ?? key;
}
