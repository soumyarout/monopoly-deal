import { createContext, useContext } from 'react';
import type { GameVersion } from '@/types/game';

export const CURRENCY_SYMBOL: Record<GameVersion, string> = {
  us:    '$',
  uk:    '£',
  india: '₹',
};

/** Fallback when no room version is known */
export const DEFAULT_CURRENCY = 'M';

export const CurrencyContext = createContext<string>(DEFAULT_CURRENCY);

export function useCurrency(): string {
  return useContext(CurrencyContext);
}

/** Returns a helper that replaces every `$` in a string with the current currency symbol */
export function useCurrencyFmt(): (text: string) => string {
  const cur = useContext(CurrencyContext);
  return (text: string) => (cur === '$' ? text : text.replace(/\$/g, cur));
}
