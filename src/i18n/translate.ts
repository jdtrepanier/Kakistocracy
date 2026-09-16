import { en, type MessageKey, type Messages } from './en';
import { fr } from './fr';

export type Lang = 'en' | 'fr';
export type TranslateParams = Readonly<Record<string, string | number>>;

export const LANGS: readonly Lang[] = ['en', 'fr'];

const DICTIONARIES: Readonly<Record<Lang, Messages>> = { en, fr };

/** Looks up a string and fills {placeholders}. Unknown placeholders are left as-is. */
export function translate(lang: Lang, key: MessageKey, params?: TranslateParams): string {
  const template = DICTIONARIES[lang][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** Key of a month abbreviation, e.g. monthKey(1) → 'month.1'. */
export function monthKey(month: number): MessageKey {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  return `month.${month}` as MessageKey;
}

export type { MessageKey };
