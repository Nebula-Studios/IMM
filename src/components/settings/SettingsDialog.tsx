'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator.tsx';
import { ThemeSelector } from './ThemeSelector.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { FolderCog } from 'lucide-react';

/**
 * @interface StagingPathConfig
 * @property {string | null} customPath - The custom staging path set by the user, or null if not set.
 * @property {string} defaultPath - The default staging path.
 * @property {string} activePath - The currently active staging path (either custom or default).
 */
interface StagingPathConfig {
  customPath: string | null;
  defaultPath: string;
  activePath: string;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * SettingsDialog component allows users to configure application settings,
 * such as the InZOI game folder path and the mod staging directory path.
 */
const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const [gameFolderPath, setGameFolderPath] = useState<string>('');
  const [stagingPathConfig, setStagingPathConfig] =
    useState<StagingPathConfig | null>(null);
  const [isLoadingGamePath, setIsLoadingGamePath] = useState<boolean>(true);
  const [isLoadingStagingPath, setIsLoadingStagingPath] =
    useState<boolean>(true);
  const { t, i18n } = useTranslation();

  /**
   * Fetches the current game folder path from the main process.
   */
  const fetchGameFolderPath = useCallback(async () => {
    setIsLoadingGamePath(true);
    try {
      const path = await window.electronAPI.getGameFolderPath();
      setGameFolderPath(path || '');
      if (!path) {
        toast.info(t('settings.gamePathToastTitle'), {
          description: t('settings.gamePathNotSetToastDescription'),
        });
      }
    } catch (error) {
      console.error('Error fetching game folder path:', error);
      toast.error(t('settings.errorFetchingGamePathToastTitle'), {
        description: t('settings.errorFetchingGamePathToastDescription'),
      });
      setGameFolderPath(t('settings.errorRetrievingPath'));
    }
    setIsLoadingGamePath(false);
  }, []);

  /**
   * Fetches the current mod staging path configuration from the main process.
   */
  const fetchStagingPathConfig = useCallback(async () => {
    setIsLoadingStagingPath(true);
    try {
      const config = await window.electronAPI.getModStagingPathConfig();
      setStagingPathConfig(config);
    } catch (error) {
      console.error('Error fetching staging path config:', error);
      toast.error(t('settings.errorFetchingStagingPathConfigToastTitle'), {
        description: t(
          'settings.errorFetchingStagingPathConfigToastDescription'
        ),
      });
      setStagingPathConfig(null);
    }
    setIsLoadingStagingPath(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchGameFolderPath();
      fetchStagingPathConfig();
    }
  }, [isOpen, fetchGameFolderPath, fetchStagingPathConfig]);

  /**
   * Handles the selection of a new game folder path.
   */
  const handleSelectGameFolder = async () => {
    try {
      const selectedPath = await window.electronAPI.openFolderDialog();
      if (selectedPath) {
        const result =
          await window.electronAPI.saveGameFolderPath(selectedPath);
        if (result.success) {
          setGameFolderPath(result.path || '');
          toast.success(t('settings.gamePathUpdatedToastTitle'), {
            description: t('settings.pathSetToToastDescription', {
              path: result.path,
            }),
          });
        } else {
          toast.error(t('settings.failedToUpdateGamePathToastTitle'), {
            description: result.error || t('settings.unknownErrorOccurred'),
          });
        }
      }
    } catch (error) {
      console.error('Error selecting/saving game folder path:', error);
      toast.error(t('settings.errorUpdatingGamePathToastTitle'), {
        description: t(
          'settings.unexpectedErrorUpdatingGamePathToastDescription'
        ),
      });
    }
  };

  /**
   * Handles the selection of a new mod staging directory.
   */
  const handleSelectStagingFolder = async () => {
    try {
      const result = await window.electronAPI.setModStagingPath();
      if (result.success && result.path) {
        fetchStagingPathConfig(); // Refresh the config
        toast.success(t('settings.stagingPathUpdatedToastTitle'), {
          description: t('settings.pathSetToToastDescription', {
            path: result.path,
          }),
        });
      } else if (
        result.error &&
        result.error !== 'Directory selection canceled.' // Reverted to original string as this is an internal error message not meant for translation
      ) {
        // Only show error if it wasn't a cancellation
        toast.error(t('settings.failedToUpdateStagingPathToastTitle'), {
          description: result.error || t('settings.unknownErrorOccurred'),
        });
      }
    } catch (error) {
      console.error('Error selecting/saving mod staging directory:', error);
      toast.error(t('settings.errorUpdatingStagingPathToastTitle'), {
        description: t(
          'settings.unexpectedErrorUpdatingStagingPathToastDescription'
        ),
      });
    }
  };

  /**
   * Clears the custom mod staging path, reverting to the default.
   */
  const handleResetStagingPath = async () => {
    try {
      const result = await window.electronAPI.clearModStagingPath();
      if (result.success) {
        fetchStagingPathConfig(); // Refresh the config
        toast.success(t('settings.stagingPathResetToastTitle'), {
          description: t('settings.stagingPathResetToastDescription'),
        });
      } else {
        toast.error(t('settings.failedToResetStagingPathToastTitle'), {
          description: result.error || t('settings.unknownErrorOccurred'),
        });
      }
    } catch (error) {
      console.error('Error resetting mod staging directory:', error);
      toast.error(t('settings.errorResettingStagingPathToastTitle'), {
        description: t(
          'settings.unexpectedErrorResettingStagingPathToastDescription'
        ),
      });
    }
  };

  const handleLanguageChange = (newLang: string) => {
    i18n.changeLanguage(newLang);
    toast.info(t('settings.languageChangedToastTitle'), {
      description: t('settings.languageSetToToastDescription', {
        language: t(
          newLang === 'en'
            ? 'settings.languageEnglish'
            : 'settings.languageItalian'
        ),
      }),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <FolderCog className="h-6 w-6 mr-3 text-slate-300" />
            {t('settings.title')}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {t('settings.description')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-6">
          <div className="grid gap-6 py-4">
            {/* Game Path Configuration */}
            <section>
              <h3 className="text-lg font-medium text-slate-200 mb-1">
                {t('settings.gamePathConfigTitle')}
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                {t('settings.gamePathConfigDescription')}
              </p>
              <div className="flex items-center space-x-2 mb-2">
                <Input
                  type="text"
                  readOnly
                  value={
                    isLoadingGamePath
                      ? t('settings.loading')
                      : gameFolderPath || t('settings.notSet')
                  }
                  className="flex-grow bg-neutral-700 border-neutral-600 text-slate-300 placeholder:text-neutral-500"
                  placeholder={t('settings.gamePathInputPlaceholder')}
                />
                <Button
                  onClick={handleSelectGameFolder}
                  variant="outline"
                  color="neutral"
                  className="border-neutral-600 hover:bg-neutral-700"
                >
                  {t('settings.changeFolderButton')}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {t('settings.gamePathHint')}
              </p>
            </section>

            <Separator className="bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

            {/* Mod Staging Path Configuration */}
            <section>
              <h3 className="text-lg font-medium text-slate-200 mb-1">
                {t('settings.stagingPathConfigTitle')}
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                {t('settings.stagingPathConfigDescription')}
              </p>
              <div className="flex items-center space-x-2 mb-2">
                <Input
                  type="text"
                  readOnly
                  value={
                    isLoadingStagingPath
                      ? t('settings.loading')
                      : stagingPathConfig?.activePath || t('settings.loading') // Or a more specific "Not Set" if applicable
                  }
                  className="flex-grow bg-neutral-700 border-neutral-600 text-slate-300 placeholder:text-neutral-500"
                  placeholder={t('settings.stagingPathInputPlaceholder')}
                />
                <Button
                  onClick={handleSelectStagingFolder}
                  variant="outline"
                  color="neutral"
                  className="border-neutral-600 hover:bg-neutral-700"
                >
                  {t('settings.setCustomFolderButton')}
                </Button>
              </div>
              <div className="flex justify-between mb-3">
                <p className="text-xs text-slate-500">
                  {t('settings.stagingPathHint')}
                </p>
                <Button
                  onClick={handleResetStagingPath}
                  variant="link"
                  className="text-xs text-amber-500 hover:text-amber-400 px-0 h-auto"
                >
                  {t('settings.resetToDefaultButton')}
                </Button>
              </div>
            </section>

            <Separator className="bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

            {/* Theme Selector */}
            <section>
              <ThemeSelector />
            </section>

            <Separator className="bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

            {/* Language Selection */}
            <section>
              <h3 className="text-lg font-medium text-slate-200 mb-1">
                {t('settings.languageSelectionTitle')}
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                {t('settings.languageSelectionDescription')}
              </p>
              <div className="grid grid-cols-2 items-center gap-4">
                <Label className="text-slate-300 text-right">
                  {t('settings.languageLabel')}
                </Label>
                <Select
                  value={i18n.language.split('-')[0]}
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger className="w-full bg-neutral-700 border-neutral-600 text-slate-300">
                    <SelectValue
                      placeholder={t('settings.selectLanguagePlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-700 border-neutral-600 text-slate-300">
                    <SelectItem
                      value="en"
                      className="hover:bg-neutral-600 focus:bg-neutral-600"
                    >
                      {t('settings.languageEnglish')}
                    </SelectItem>
                    <SelectItem
                      value="it"
                      className="hover:bg-neutral-600 focus:bg-neutral-600"
                    >
                      {t('settings.languageItalian')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-6 border-t border-neutral-700/60">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            {t('settings.doneButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
