import { useCallback } from 'react';
import { translate, type MessageKey, type TranslateParams } from '@/i18n/translate';
import { useGameStore } from '@/store/gameStore';

/** Returns a `t(key, params?)` function for the current language. */
export function useT() {
  const lang = useGameStore((s) => s.lang);
  return useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(lang, key, params),
    [lang],
  );
}

export type TFunction = ReturnType<typeof useT>;
