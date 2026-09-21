import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { RU } from "./ru.js";

// Uzbek is the source language: components call t("Uzbek text") and Russian is looked up in RU.
// Unknown strings fall back to the Uzbek original, so a missing translation never breaks the UI.
const KEY = "shop_lang";
let current = "uz";
try {
  current = localStorage.getItem(KEY) === "ru" ? "ru" : "uz";
} catch {
  /* storage unavailable */
}

export function tr(text, vars) {
  let out = current === "ru" && RU[text] ? RU[text] : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

const LangContext = createContext({ lang: "uz", setLang: () => {}, t: tr });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(current);
  const setLang = useCallback((l) => {
    current = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* storage unavailable */
    }
    document.documentElement.lang = l;
    setLangState(l);
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: tr }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useT = () => useContext(LangContext).t;
export const useLang = () => useContext(LangContext);
