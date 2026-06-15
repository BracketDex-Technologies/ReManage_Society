"use client";

import { useEffect } from "react";
import { translateLegacyPageText, pageTranslations } from "@/lib/page-translations";
import { translateStaticText, useI18n, dictionary, AppLanguage } from "@/lib/i18n";

const textOriginals = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE"]);

// Lazy cache for reverse translation lookup
const reverseCache: Record<string, Map<string, string>> = {};

function getReverseMap(language: AppLanguage): Map<string, string> {
  if (language === "en") return new Map();
  if (reverseCache[language]) return reverseCache[language];

  const map = new Map<string, string>();

  // Populate from dictionary
  const dict = dictionary[language];
  if (dict) {
    for (const [englishKey, transVal] of Object.entries(dict)) {
      map.set(transVal.trim(), englishKey);
    }
  }

  // Populate from pageTranslations
  const pageTrans = pageTranslations[language as Exclude<AppLanguage, "en">];
  if (pageTrans) {
    for (const [englishKey, transVal] of Object.entries(pageTrans)) {
      map.set(transVal.trim(), englishKey);
    }
  }

  reverseCache[language] = map;
  return map;
}

function findOriginalText(translatedText: string, language: AppLanguage): string | null {
  const trimmed = translatedText.trim();
  if (!trimmed || language === "en") return null;
  const reverseMap = getReverseMap(language);
  const original = reverseMap.get(trimmed);
  return original || null;
}

function withOriginalWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] || "";
  const trailing = original.match(/\s*$/)?.[0] || "";
  return `${leading}${translated}${trailing}`;
}

function translateValue(value: string, language: ReturnType<typeof useI18n>["language"]) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const staticTranslated = translateStaticText(trimmed, language);
  const translated = staticTranslated !== trimmed ? staticTranslated : translateLegacyPageText(trimmed, language);
  return translated === trimmed ? value : withOriginalWhitespace(value, translated);
}

function translateTextNode(node: Text, language: ReturnType<typeof useI18n>["language"]) {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest("[data-no-translate]")) return;

  let original = textOriginals.get(node);
  if (original === undefined) {
    const currentText = node.textContent ?? "";
    const foundOriginal = findOriginalText(currentText, language);
    if (foundOriginal) {
      original = withOriginalWhitespace(currentText, foundOriginal);
    } else {
      // If it contains Devanagari characters, it is already a translated text.
      // We do not treat it as original English text.
      if (/[\u0900-\u097F]/.test(currentText)) {
        return;
      }
      original = currentText;
    }
    textOriginals.set(node, original);
  }

  const nextText = language === "en" ? original : translateValue(original, language);
  if (node.textContent !== nextText) node.textContent = nextText;
}

function translateElementAttributes(element: Element, language: ReturnType<typeof useI18n>["language"]) {
  if (element.closest("[data-no-translate]")) return;

  for (const attr of TRANSLATABLE_ATTRS) {
    const current = element.getAttribute(attr);
    if (!current) continue;

    let originals = attrOriginals.get(element);
    if (!originals) {
      originals = new Map();
      attrOriginals.set(element, originals);
    }

    let original = originals.get(attr);
    if (original === undefined) {
      const foundOriginal = findOriginalText(current, language);
      if (foundOriginal) {
        original = withOriginalWhitespace(current, foundOriginal);
      } else {
        if (/[\u0900-\u097F]/.test(current)) {
          continue;
        }
        original = current;
      }
      originals.set(attr, original);
    }

    const nextValue = language === "en" ? original : translateValue(original, language);
    if (element.getAttribute(attr) !== nextValue) element.setAttribute(attr, nextValue);
  }
}

function translateTree(root: ParentNode, language: ReturnType<typeof useI18n>["language"]) {
  if (root instanceof Element) translateElementAttributes(root, language);

  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = textWalker.nextNode();
  while (textNode) {
    translateTextNode(textNode as Text, language);
    textNode = textWalker.nextNode();
  }

  if (root instanceof Element || root instanceof Document) {
    const elementRoot = root instanceof Document ? root.body : root;
    elementRoot?.querySelectorAll?.("*").forEach((element) => translateElementAttributes(element, language));
  }
}

export default function PageTextTranslator() {
  const { language } = useI18n();

  useEffect(() => {
    translateTree(document.body, language);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target as Text, language);
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node as Text, language);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateTree(node as Element, language);
          }
        });
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          translateElementAttributes(mutation.target, language);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRS,
    });

    return () => observer.disconnect();
  }, [language]);

  return null;
}
