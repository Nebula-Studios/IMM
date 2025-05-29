import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend'; // Usiamo HttpBackend per entrambi gli ambienti
// import isDev from 'electron-is-dev'; // Rimosso: usiamo import.meta.env.DEV

// Rimuoviamo FsBackend e le relative logiche condizionali complesse per il backend
// import FsBackend from 'i18next-fs-backend'; // Non più necessario con questo approccio

// import.meta.env.DEV è fornita da Vite: true in sviluppo, false in produzione.
const isDevelopment = import.meta.env.DEV;

const loadPath = isDevelopment
  ? '/locales/{{lng}}/{{ns}}.json' // Per Vite dev server (relativo alla radice del server)
  : './locales/{{lng}}/{{ns}}.json'; // Per produzione (relativo a index.html in dist/)
                                     // Il './' assicura che sia trattato come percorso relativo.

i18n
  .use(HttpBackend) // Usa sempre HttpBackend
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['en', 'it'],
    fallbackLng: 'en',
    debug: isDevelopment, // Usa la variabile basata su Vite
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage'],
    },
    backend: {
      loadPath: loadPath, // Usa il loadPath configurato
    },
    interpolation: {
      escapeValue: false, // React già gestisce l'escape
    },
  });

export default i18n;