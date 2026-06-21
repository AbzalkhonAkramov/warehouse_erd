import { LANGS, useI18n, type Lang } from "../i18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <select
      className="lang-switcher"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label="Language"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
