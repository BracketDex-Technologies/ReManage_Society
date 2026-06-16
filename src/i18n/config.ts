export const locales = ["en", "hi", "mr"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

export const LOCALE_STORAGE_KEY = "society-language";

export const LANGUAGE_OPTIONS: Array<{
  code: AppLocale;
  label: string;
  shortLabel: string;
}> = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "hi", label: "हिन्दी", shortLabel: "हि" },
  { code: "mr", label: "मराठी", shortLabel: "म" },
];

export function isAppLocale(value: string): value is AppLocale {
  return locales.includes(value as AppLocale);
}

export function localeToHtmlLang(locale: AppLocale): string {
  if (locale === "hi") return "hi-IN";
  if (locale === "mr") return "mr-IN";
  return "en";
}
