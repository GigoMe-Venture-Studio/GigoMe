// The current language for React components: a component that calls useT()
// (or useLang()) renders again when the language changes.
import { cloneElement, useSyncExternalStore } from 'react';
import { getLang, setKeyer, subscribeLang, t } from './i18n.js';

setKeyer((el, key) => cloneElement(el, { key }));

export function useLang() {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}
export function useT() {
  useLang();
  return t;
}
