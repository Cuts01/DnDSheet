import en from './i18n/en';

/* Idioma de la interfaz. Las claves son el texto en español; en.ts tiene la traducción.
   Los términos de D&D (nombres de spells, clases, feats...) no se traducen. */
export type Lang = 'es' | 'en';

function initial(): Lang {
  try {
    const v = localStorage.getItem('lang');
    if (v === 'es' || v === 'en') return v;
  } catch {
    /* sin storage */
  }
  return 'es';
}

class I18n {
  lang = $state<Lang>(initial());
  set(l: Lang) {
    this.lang = l;
    try {
      localStorage.setItem('lang', l);
    } catch {
      /* sin storage */
    }
    document.documentElement.lang = l;
  }
}

export const i18n = new I18n();

/* t('Hola {name}', { name }) */
export function t(es: string, params?: Record<string, string | number>): string {
  let s = i18n.lang === 'en' ? (en[es] ?? es) : es;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
  return s;
}

/* Para claves que faltan en en.ts (lo usa un test). */
export const dictionary = en;
