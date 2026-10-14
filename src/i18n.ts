// Canonical copy: obsidian-dev/tools/i18n/i18n.ts. `node tools/i18n/rollout.mjs
// <clone>...` writes it to `src/i18n.ts` in each plugin; edit it here, never in
// a plugin. Per-plugin parts: `src/locales/<code>.ts`, one per language.
//
// English (`locales/en.ts`) is the source of the key type and the fallback: a
// locale that lacks a key, or has an extra one, is a type error in the build,
// and `t('key', { name })` checks the `{name}` placeholders of the English text.
//
// Language: Obsidian's `getLanguage()` is `@since 1.8.7`, so a plugin whose
// `minAppVersion` is lower reads the same value from `localStorage`, where the
// app keeps it, and never raises `minAppVersion` for this. Pass `getLanguage`
// to `detectLocale` only in a plugin whose `minAppVersion` is 1.8.7 or higher.
import de from './locales/de.ts';
import en from './locales/en.ts';
import es from './locales/es.ts';
import fr from './locales/fr.ts';
import ja from './locales/ja.ts';
import ko from './locales/ko.ts';
import ptBR from './locales/pt-BR.ts';
import ru from './locales/ru.ts';
import zh from './locales/zh.ts';

/** Obsidian's own codes: `zh` is Simplified Chinese, `pt-BR` Brazilian Portuguese. */
export const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt-BR', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export type MessageKey = keyof typeof en;
/** What every `locales/<code>.ts` must be: all the English keys, nothing else. */
export type Messages = { [K in MessageKey]: string };

type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}` ? P | Placeholders<Rest> : never;
type Args<K extends MessageKey> = [Placeholders<(typeof en)[K]>] extends [never]
	? []
	: [vars: Record<Placeholders<(typeof en)[K]>, string | number>];

const CATALOGS: Record<Locale, Messages> = { en, zh, ja, ko, es, de, fr, 'pt-BR': ptBR, ru };

/** Exact match on one of our codes, ignoring case; anything else (`zh-TW`, `pt`, `en-GB`) is `null`. */
export function resolveLocale(code: string | null | undefined): Locale | null {
	const wanted = code?.trim().toLowerCase();
	return LOCALES.find((l) => l.toLowerCase() === wanted) ?? null;
}

/**
 * Where the app keeps its language. A constant, not a literal in the call,
 * because `obsidianmd/prefer-get-language` flags `getItem('language')` without
 * knowing that `getLanguage()` (1.8.7) is newer than the plugin's `minAppVersion`.
 */
const LANGUAGE_KEY = 'language';

/** The app's language if we translate it, else `en`. Never throws. */
export function detectLocale(getLanguage?: () => string): Locale {
	try {
		const code = getLanguage ? getLanguage() : typeof window === 'undefined' ? null : window.localStorage.getItem(LANGUAGE_KEY);
		return resolveLocale(code) ?? 'en';
	} catch {
		return 'en';
	}
}

let current: Locale = detectLocale();

export function setLocale(locale: Locale): void {
	current = locale;
}

export function getLocale(): Locale {
	return current;
}

/** Replaces `{name}` in one pass, so a value containing braces is never read as a placeholder. */
export function format(text: string, vars?: Record<string, string | number>): string {
	if (!vars) return text;
	return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

export function t<K extends MessageKey>(key: K, ...args: Args<K>): string {
	const vars: Record<string, string | number> | undefined = args[0];
	return format(CATALOGS[current][key] || en[key], vars);
}

/** The catalogs, for the test that checks every locale against English. */
export function catalogOf(locale: Locale): Messages {
	return CATALOGS[locale];
}
