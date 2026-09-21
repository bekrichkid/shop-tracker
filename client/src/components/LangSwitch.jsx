import { useLang } from "../i18n.jsx";

export default function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switch" role="group" aria-label="Til / Язык">
      <button className={lang === "uz" ? "on" : ""} onClick={() => setLang("uz")}>O'Z</button>
      <button className={lang === "ru" ? "on" : ""} onClick={() => setLang("ru")}>РУС</button>
    </div>
  );
}
