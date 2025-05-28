import React from 'react';
import { useTheme } from '@/hooks/useTheme.ts';
import { Label } from '@/components/ui/label.tsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.tsx';

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (value: string) => {
    if (value === 'light' || value === 'dark' || value === 'system') {
      setTheme(value);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-slate-200">Application Theme</h3>
      <RadioGroup
        value={theme}
        onValueChange={handleThemeChange}
        className="space-y-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="light" id="theme-light" />
          <Label htmlFor="theme-light" className="text-slate-300">
            Light
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="dark" id="theme-dark" />
          <Label htmlFor="theme-dark" className="text-slate-300">
            Dark
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="system" id="theme-system" />
          <Label htmlFor="theme-system" className="text-slate-300">
            System
          </Label>
        </div>
      </RadioGroup>
      <p className="text-sm text-slate-400">
        Select "System" to use your operating system's preferences.
      </p>
    </div>
  );
}