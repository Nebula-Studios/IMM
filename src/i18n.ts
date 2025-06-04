import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

const isDevelopment = import.meta.env.DEV;

const getLocalesPath = () => {
  return isDevelopment
    ? '/locales/{{lng}}/{{ns}}.json'
    : './locales/{{lng}}/{{ns}}.json';
};

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['en', 'it'],
    fallbackLng: 'en',
    debug: isDevelopment,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage'],
    },
    backend: {
      loadPath: getLocalesPath(),
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
