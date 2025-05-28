import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('system');

  const applyTheme = useCallback((theme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    } else {
      root.classList.add(theme);
    }
  }, []);

  useEffect(() => {
    const loadAndApplyTheme = async () => {
      try {
        const savedTheme = await window.electronAPI.getTheme();
        console.log('[useTheme] Loaded theme from store:', savedTheme);
        setCurrentTheme(savedTheme);
        applyTheme(savedTheme);
      } catch (error) {
        console.error('[useTheme] Error loading theme:', error);
        // In caso di errore, applica il tema di sistema come fallback
        setCurrentTheme('system');
        applyTheme('system');
      }
    };

    loadAndApplyTheme();

    // Listener per i cambiamenti di preferenza di sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [applyTheme, currentTheme]); // Aggiunto currentTheme alle dipendenze per riapplicare se cambia esternamente

  const setTheme = useCallback(
    async (theme: Theme) => {
      try {
        const result = await window.electronAPI.setTheme(theme);
        if (result.success && result.theme) {
          console.log('[useTheme] Theme set and saved:', result.theme);
          setCurrentTheme(result.theme);
          applyTheme(result.theme);
        } else {
          console.error('[useTheme] Failed to set theme:', result.error);
        }
      } catch (error) {
        console.error('[useTheme] Error setting theme:', error);
      }
    },
    [applyTheme]
  );

  return { theme: currentTheme, setTheme };
}