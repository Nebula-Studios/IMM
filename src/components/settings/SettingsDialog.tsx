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

interface StagingPathConfig {
  customPath: string | null;
  defaultPath: string;
  activePath: string;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

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
  }, [t]);

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
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      fetchGameFolderPath();
      fetchStagingPathConfig();
    }
  }, [isOpen, fetchGameFolderPath, fetchStagingPathConfig]);

  const handleSelectGameFolder = async () => {
    try {
      const selectedPath = await window.electronAPI.openFolderDialog();
      if (!selectedPath) return;

      await saveGameFolderPath(selectedPath);
    } catch (error) {
      console.error('Error selecting/saving game folder path:', error);
      showGamePathError();
    }
  };

  const saveGameFolderPath = async (selectedPath: string) => {
    const result = await window.electronAPI.saveGameFolderPath(selectedPath);

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
  };

  const showGamePathError = () => {
    toast.error(t('settings.errorUpdatingGamePathToastTitle'), {
      description: t(
        'settings.unexpectedErrorUpdatingGamePathToastDescription'
      ),
    });
  };

  const handleSelectStagingFolder = async () => {
    try {
      const result = await window.electronAPI.setModStagingPath();

      if (result.success && result.path) {
        await handleStagingPathSuccess(result.path);
      } else if (result.error && !isCancellationError(result.error)) {
        showStagingPathError(result.error);
      }
    } catch (error) {
      console.error('Error selecting/saving mod staging directory:', error);
      showUnexpectedStagingPathError();
    }
  };

  const handleStagingPathSuccess = async (path: string) => {
    await fetchStagingPathConfig();
    toast.success(t('settings.stagingPathUpdatedToastTitle'), {
      description: t('settings.pathSetToToastDescription', { path }),
    });
  };

  const isCancellationError = (error: string) => {
    return error === 'Directory selection canceled.';
  };

  const showStagingPathError = (error?: string) => {
    toast.error(t('settings.failedToUpdateStagingPathToastTitle'), {
      description: error || t('settings.unknownErrorOccurred'),
    });
  };

  const showUnexpectedStagingPathError = () => {
    toast.error(t('settings.errorUpdatingStagingPathToastTitle'), {
      description: t(
        'settings.unexpectedErrorUpdatingStagingPathToastDescription'
      ),
    });
  };

  const handleResetStagingPath = async () => {
    try {
      const result = await window.electronAPI.clearModStagingPath();
      if (result.success) {
        await handleStagingPathReset();
      } else {
        showResetStagingPathError(result.error);
      }
    } catch (error) {
      console.error('Error resetting mod staging directory:', error);
      showUnexpectedResetError();
    }
  };

  const handleStagingPathReset = async () => {
    await fetchStagingPathConfig();
    toast.success(t('settings.stagingPathResetToastTitle'), {
      description: t('settings.stagingPathResetToastDescription'),
    });
  };

  const showResetStagingPathError = (error?: string) => {
    toast.error(t('settings.failedToResetStagingPathToastTitle'), {
      description: error || t('settings.unknownErrorOccurred'),
    });
  };

  const showUnexpectedResetError = () => {
    toast.error(t('settings.errorResettingStagingPathToastTitle'), {
      description: t(
        'settings.unexpectedErrorResettingStagingPathToastDescription'
      ),
    });
  };

  const handleLanguageChange = (newLanguage: string) => {
    i18n.changeLanguage(newLanguage);

    const languageDisplayName = getLanguageDisplayName(newLanguage);
    toast.info(t('settings.languageChangedToastTitle'), {
      description: t('settings.languageSetToToastDescription', {
        language: languageDisplayName,
      }),
    });
  };

  const getLanguageDisplayName = (languageCode: string) => {
    const languageKey =
      languageCode === 'en'
        ? 'settings.languageEnglish'
        : 'settings.languageItalian';
    return t(languageKey);
  };

  const getCurrentDisplayPath = () => {
    if (isLoadingGamePath) return t('settings.loading');
    return gameFolderPath || t('settings.notSet');
  };

  const getCurrentStagingPath = () => {
    if (isLoadingStagingPath) return t('settings.loading');
    return stagingPathConfig?.activePath || t('settings.loading');
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
            <GamePathSection
              currentPath={getCurrentDisplayPath()}
              onSelectFolder={handleSelectGameFolder}
              t={t}
            />

            <Separator className="bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

            <StagingPathSection
              currentPath={getCurrentStagingPath()}
              onSelectFolder={handleSelectStagingFolder}
              onResetPath={handleResetStagingPath}
              t={t}
            />

            <Separator className="bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

            <section>
              <ThemeSelector />
            </section>

            <Separator className="bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

            <LanguageSection
              currentLanguage={i18n.language.split('-')[0]}
              onLanguageChange={handleLanguageChange}
              t={t}
            />
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

interface GamePathSectionProps {
  currentPath: string;
  onSelectFolder: () => void;
  t: (key: string) => string;
}

const GamePathSection: React.FC<GamePathSectionProps> = ({
  currentPath,
  onSelectFolder,
  t,
}) => (
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
        value={currentPath}
        className="flex-grow bg-neutral-700 border-neutral-600 text-slate-300 placeholder:text-neutral-500"
        placeholder={t('settings.gamePathInputPlaceholder')}
      />
      <Button
        onClick={onSelectFolder}
        variant="outline"
        color="neutral"
        className="border-neutral-600 hover:bg-neutral-700"
      >
        {t('settings.changeFolderButton')}
      </Button>
    </div>
    <p className="text-xs text-slate-500">{t('settings.gamePathHint')}</p>
  </section>
);

interface StagingPathSectionProps {
  currentPath: string;
  onSelectFolder: () => void;
  onResetPath: () => void;
  t: (key: string) => string;
}

const StagingPathSection: React.FC<StagingPathSectionProps> = ({
  currentPath,
  onSelectFolder,
  onResetPath,
  t,
}) => (
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
        value={currentPath}
        className="flex-grow bg-neutral-700 border-neutral-600 text-slate-300 placeholder:text-neutral-500"
        placeholder={t('settings.stagingPathInputPlaceholder')}
      />
      <Button
        onClick={onSelectFolder}
        variant="outline"
        color="neutral"
        className="border-neutral-600 hover:bg-neutral-700"
      >
        {t('settings.setCustomFolderButton')}
      </Button>
    </div>
    <div className="flex justify-between mb-3">
      <p className="text-xs text-slate-500">{t('settings.stagingPathHint')}</p>
      <Button
        onClick={onResetPath}
        variant="link"
        className="text-xs text-amber-500 hover:text-amber-400 px-0 h-auto"
      >
        {t('settings.resetToDefaultButton')}
      </Button>
    </div>
  </section>
);

interface LanguageSectionProps {
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
  t: (key: string) => string;
}

const LanguageSection: React.FC<LanguageSectionProps> = ({
  currentLanguage,
  onLanguageChange,
  t,
}) => (
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
      <Select value={currentLanguage} onValueChange={onLanguageChange}>
        <SelectTrigger className="w-full bg-neutral-700 border-neutral-600 text-slate-300">
          <SelectValue placeholder={t('settings.selectLanguagePlaceholder')} />
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
);

export default SettingsDialog;
