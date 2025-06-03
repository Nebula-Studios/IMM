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

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const handleThemeChange = (value: string) => {
    if (value === 'light' || value === 'dark' || value === 'system') {
      setTheme(value);
    }
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
          <SelectTrigger className="w-full bg-neutral-700 border-neutral-600 text-slate-300">
            <SelectValue placeholder={t('settings.selectThemePlaceholder')} />
          </SelectTrigger>
          <SelectContent className="bg-neutral-700 border-neutral-600 text-slate-300">
            <SelectItem
              value="light"
              className="hover:bg-neutral-600 focus:bg-neutral-600"
            >
              {t('settings.themeLight')}
            </SelectItem>
            <SelectItem
              value="dark"
              className="hover:bg-neutral-600 focus:bg-neutral-600"
            >
              {t('settings.themeDark')}
            </SelectItem>
            <SelectItem
              value="system"
              className="hover:bg-neutral-600 focus:bg-neutral-600"
            >
              {t('settings.themeSystem')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-slate-500">{t('settings.themeSystemHint')}</p>
    </div>
  );
}
