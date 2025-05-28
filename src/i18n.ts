import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

i18n
  .use(HttpApi)
  .use(LanguageDetector) // Riattivato
  .use(initReactI18next)
  .init({
    // lng: 'en', // Rimosso: la lingua sarà rilevata
    supportedLngs: ['en', 'it'],
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    detection: { // Riattivato
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage'],
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false, // React già gestisce l'escape
    },
  });

export default i18n;