import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  FolderX,
  RefreshCw,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { cn } from '../../lib/utils.ts';
import appIcon from '/icon.svg';

import packageJson from '../../../package.json' with { type: 'json' };
import ManageProfilesDialog from '../profiles/ManageProfilesDialog.tsx';

const APP_VERSION = packageJson.version;
import { ProfileService } from '../../services/profileService.ts';
import { ModProfile } from '../../types/profiles.ts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog.tsx';

export interface MenuBarProps {
  gameFolderPath: string | null;
  onDevClearFolder: () => Promise<void>;
  onSettingsClick: () => void;
  onRefreshMods: () => Promise<void>;
  onLaunchGame: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
  gameFolderPath,
  onDevClearFolder,
  onSettingsClick,
  onRefreshMods,
  onLaunchGame,
}) => {
  const { t } = useTranslation();
  const [isManageProfilesDialogOpen, setIsManageProfilesDialogOpen] =
    useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMissingModsAlertOpen, setIsMissingModsAlertOpen] = useState(false);
  const [missingModsList, setMissingModsList] = useState<string[]>([]);
  const [loadingProfileName, setLoadingProfileName] = useState<string>('');
  const [profiles, setProfiles] = useState<ModProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const profileService = new ProfileService();
  const activeProfile = profiles.find(
    (profile) => profile.id === activeProfileId
  );

  const refreshProfilesFromStore = () => {
    console.log('[MenuBar] Refreshing profiles from store');
    setProfiles(profileService.getProfiles());
    setActiveProfileId(profileService.getActiveProfileId());
  };

  useEffect(() => {
    refreshProfilesFromStore();
  }, []);

  useEffect(() => {
    console.log('[MenuBar] Rendering with gameFolderPath:', gameFolderPath);
    console.log('[MenuBar] Profile Data:', {
      profiles,
      activeProfileId,
      activeProfile,
    });
  }, [gameFolderPath, profiles, activeProfileId, activeProfile]);

  const handleProfileChange = async (profileId: string) => {
    console.log(`[MenuBar] Profile change requested: ${profileId}`);

    const profileToLoad = profiles.find((profile) => profile.id === profileId);
    if (profileToLoad) {
      setLoadingProfileName(profileToLoad.name);
    }

    const result = await profileService.loadProfile(profileId);

    if (result.success) {
      refreshProfilesFromStore();
    } else if (result.missingMods && result.missingMods.length > 0) {
      setMissingModsList(result.missingMods);
      setIsMissingModsAlertOpen(true);
    } else {
      console.error('[MenuBar] Failed to load profile for an unknown reason.');
      setMissingModsList([
        'Errore sconosciuto durante il caricamento del profilo.',
      ]);
      setIsMissingModsAlertOpen(true);
    }
  };

  const handleCreateProfileInDialog = async (
    name: string,
    description?: string
  ) => {
    try {
      const newProfile = await profileService.createProfile(name, description);
      console.log('[MenuBar] Profile created via dialog:', newProfile);
      refreshProfilesFromStore();
      return newProfile;
    } catch (error) {
      console.error('[MenuBar] Error creating profile from dialog:', error);
      throw error;
    }
  };

  const handleDeleteProfileInDialog = async (profileIdToDelete: string) => {
    try {
      await profileService.deleteProfile(profileIdToDelete);
      console.log(`[MenuBar] Profile ${profileIdToDelete} deleted via dialog.`);
      refreshProfilesFromStore();
    } catch (error) {
      console.error(
        `[MenuBar] Error deleting profile ${profileIdToDelete} from dialog:`,
        error
      );
      throw error;
    }
  };

  const handleRenameProfileInDialog = async (
    profileIdToRename: string,
    newName: string
  ) => {
    try {
      await profileService.renameProfile(profileIdToRename, newName);
      console.log(
        `[MenuBar] Profile ${profileIdToRename} renamed to "${newName}" via dialog.`
      );
      refreshProfilesFromStore();
    } catch (error) {
      console.error(
        `[MenuBar] Error renaming profile ${profileIdToRename} from dialog:`,
        error
      );
      throw error;
    }
  };

  const handleManageProfiles = () => {
    refreshProfilesFromStore();
    setIsManageProfilesDialogOpen(true);
  };

  const handleOpenLink = (url: string) => {
    window.electronAPI.openExternalLink(url);
  };

  const handleRefreshClick = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    const MIN_ANIMATION_TIME = 500;
    const startTime = Date.now();

    try {
      await onRefreshMods();
    } finally {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = MIN_ANIMATION_TIME - elapsedTime;

      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <div className="h-14 px-4 mx-4 mb-1 flex items-center justify-between bg-gradient-to-r from-neutral-900/90 to-neutral-800/90 backdrop-blur-sm text-slate-100 border-b border-l border-r border-neutral-700/80 rounded-b-xl shadow-2xl hover:shadow-neutral-900/50 transition-all duration-300 print:hidden">
        <div className="flex items-center space-x-2">
          <img src={appIcon} alt="App Icon" className="h-6 w-6" />
          <h1 className="text-lg font-semibold tracking-tight">
            InZOI Mod Manager{' '}
            <span className="text-xs text-slate-400">v{APP_VERSION}</span>
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          {/* {activeProfile && ( // Mostra il selettore solo se c'è un profilo attivo
            <ProfileSelector
              profiles={profiles}
              activeProfile={activeProfile}
              onProfileChange={handleProfileChange}
              onManageProfiles={handleManageProfiles}
            />
          )} */}
          <Button
            variant="outline"
            color="success"
            size="sm"
            onClick={onLaunchGame}
            title={t('menuBar.launchGameTooltip')}
          >
            <Play className="h-4 w-4 mr-1" />
            {t('menuBar.launchGame')}
          </Button>

          <Button
            variant="ghost"
            color="neutral"
            size="icon"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            title={t('menuBar.refreshModsTooltip')}
          >
            <RefreshCw
              className={cn(
                'h-4 w-4 transition-all duration-200',
                isRefreshing && 'animate-spin-slow'
              )}
            />
          </Button>

          {process.env.NODE_ENV === 'development' && (
            <Button
              variant="default"
              color="danger"
              size="sm"
              onClick={onDevClearFolder}
              title="DEV ONLY: Reset Game Folder Path"
            >
              <FolderX className="h-4 w-4 mr-1" />
              DEV: Reset Path
            </Button>
          )}

          <Button
            variant="outline"
            color="neutral"
            size="sm"
            onClick={onSettingsClick}
            title={t('menuBar.settingsTooltip')}
          >
            <Settings className="h-4 w-4 mr-1" />
            {t('menuBar.settingsButton')}
          </Button>
        </div>
      </div>
      <ManageProfilesDialog
        isOpen={isManageProfilesDialogOpen}
        onOpenChange={setIsManageProfilesDialogOpen}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onCreateProfile={handleCreateProfileInDialog}
        onDeleteProfile={handleDeleteProfileInDialog}
        onRenameProfile={handleRenameProfileInDialog}
      />

      <AlertDialog
        open={isMissingModsAlertOpen}
        onOpenChange={setIsMissingModsAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
              {t('menuBar.missingModsAlert.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span
                dangerouslySetInnerHTML={{
                  __html: t('menuBar.missingModsAlert.descriptionPart1', {
                    loadingProfileName,
                  }),
                }}
              />
              <ul className="list-disc list-inside mt-2 max-h-40 overflow-y-auto bg-neutral-700 p-2 rounded">
                {missingModsList.map((modName, index) => (
                  <li key={index} className="text-sm">
                    {modName}
                  </li>
                ))}
              </ul>
              {t('menuBar.missingModsAlert.descriptionPart2')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsMissingModsAlertOpen(false)}>
              {t('common.ok')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MenuBar;
