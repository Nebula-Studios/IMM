import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme.ts';
import { Label } from '@/components/ui/label.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';

const AVAILABLE_THEMES = ['light', 'dark', 'system'] as const;
type ThemeOption = (typeof AVAILABLE_THEMES)[number];

const COMMON_STYLES = {
  selectTrigger: 'w-full bg-neutral-700 border-neutral-600 text-slate-300',
  selectContent: 'bg-neutral-700 border-neutral-600 text-slate-300',
  selectItem: 'hover:bg-neutral-600 focus:bg-neutral-600',
} as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const handleThemeChange = (value: string) => {
    if (isValidTheme(value)) {
      setTheme(value);
    }
  };

  const isValidTheme = (value: string): value is ThemeOption => {
    return AVAILABLE_THEMES.includes(value as ThemeOption);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-slate-200 mb-1">
        {t('settings.themeTitle')}
      </h3>
      <p className="text-sm text-slate-400 mb-3">
        {t('settings.themeDescription')}
      </p>
      <div className="grid grid-cols-2 items-center gap-4">
        <Label className="text-slate-300 text-right">
          {t('settings.themeLabel')}
        </Label>
        <Select value={theme} onValueChange={handleThemeChange}>
          <SelectTrigger className={COMMON_STYLES.selectTrigger}>
            <SelectValue placeholder={t('settings.selectThemePlaceholder')} />
          </SelectTrigger>
          <SelectContent className={COMMON_STYLES.selectContent}>
            {AVAILABLE_THEMES.map((themeOption) => (
              <SelectItem
                key={themeOption}
                value={themeOption}
                className={COMMON_STYLES.selectItem}
              >
                {t(
                  `settings.theme${themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}`
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-slate-500">{t('settings.themeSystemHint')}</p>
    </div>
  );
}
