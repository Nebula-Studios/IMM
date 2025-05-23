'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator.tsx';
import { FolderCog, X } from 'lucide-react';

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

interface SettingsPageProps {
  onClose: () => void;
}

/**
 * SettingsPage component allows users to configure application settings,
 * such as the InZOI game folder path and the mod staging directory path.
 */
const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
  const [gameFolderPath, setGameFolderPath] = useState<string>('');
  const [stagingPathConfig, setStagingPathConfig] =
    useState<StagingPathConfig | null>(null);
  const [isLoadingGamePath, setIsLoadingGamePath] = useState<boolean>(true);
  const [isLoadingStagingPath, setIsLoadingStagingPath] =
    useState<boolean>(true);

  /**
   * Fetches the current game folder path from the main process.
   */
  const fetchGameFolderPath = useCallback(async () => {
    setIsLoadingGamePath(true);
    try {
      const path = await window.electronAPI.getGameFolderPath();
      setGameFolderPath(path || '');
      if (!path) {
        toast.info('Game Folder Path', {
          description: 'The game folder path is not yet set.',
        });
      }
    } catch (error) {
      console.error('Error fetching game folder path:', error);
      toast.error('Error Fetching Game Path', {
        description: 'Could not retrieve the game folder path.',
      });
      setGameFolderPath('Error retrieving path');
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
      toast.error('Error Fetching Staging Path Config', {
        description: 'Could not retrieve the mod staging path configuration.',
      });
      setStagingPathConfig(null);
    }
    setIsLoadingStagingPath(false);
  }, []);

  useEffect(() => {
    fetchGameFolderPath();
    fetchStagingPathConfig();
  }, [fetchGameFolderPath, fetchStagingPathConfig]);

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
          toast.success('Game Folder Path Updated', {
            description: `Path set to: ${result.path}`,
          });
        } else {
          toast.error('Failed to Update Game Folder Path', {
            description: result.error || 'An unknown error occurred.',
          });
        }
      }
    } catch (error) {
      console.error('Error selecting/saving game folder path:', error);
      toast.error('Error Updating Game Path', {
        description:
          'An unexpected error occurred while updating the game folder path.',
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
        toast.success('Mod Staging Directory Updated', {
          description: `Path set to: ${result.path}`,
        });
      } else if (
        result.error &&
        result.error !== 'Directory selection canceled.'
      ) {
        // Only show error if it wasn't a cancellation
        toast.error('Failed to Update Staging Directory', {
          description: result.error || 'An unknown error occurred.',
        });
      }
    } catch (error) {
      console.error('Error selecting/saving mod staging directory:', error);
      toast.error('Error Updating Staging Directory', {
        description:
          'An unexpected error occurred while updating the staging directory.',
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
        toast.success('Mod Staging Directory Reset', {
          description: 'Path has been reset to the default.',
        });
      } else {
        toast.error('Failed to Reset Staging Directory', {
          description: result.error || 'An unknown error occurred.',
        });
      }
    } catch (error) {
      console.error('Error resetting mod staging directory:', error);
      toast.error('Error Resetting Staging Directory', {
        description:
          'An unexpected error occurred while resetting the staging directory.',
      });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 mx-auto">
      <Card className="bg-neutral-850 border-neutral-700 shadow-xl">
        <CardHeader className="border-b border-neutral-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FolderCog className="h-6 w-6 mr-3 text-slate-300" />
              <CardTitle className="text-2xl font-semibold text-slate-100">
                Settings
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close Settings"
            >
              <X className="h-5 w-5 text-slate-400 hover:text-slate-200" />
            </Button>
          </div>
          <CardDescription className="text-slate-400 pt-1">
            Manage your InZOI Mod Manager preferences and paths.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <section className="mb-8">
            <h3 className="text-lg font-medium text-slate-200 mb-1">
              Game Path Configuration
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              Set the main installation directory for InZOI.
            </p>
            <div className="flex items-center space-x-2 mb-2">
              <Input
                type="text"
                readOnly
                value={
                  isLoadingGamePath ? 'Loading...' : gameFolderPath || 'Not Set'
                }
                className="flex-grow bg-neutral-700 border-neutral-600 text-slate-300 placeholder:text-neutral-500"
                placeholder="Path to your InZOI game folder"
              />
              <Button
                onClick={handleSelectGameFolder}
                variant="outline"
                className="border-neutral-600 hover:bg-neutral-700"
              >
                Change Folder
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              This is where the game executable is located (e.g.,
              C:\\Games\\inzoi).
            </p>
          </section>

          <Separator className="my-6 bg-neutral-700" />

          <section>
            <h3 className="text-lg font-medium text-slate-200 mb-1">
              Mod Staging Path Configuration
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              This is a temporary folder where mods are prepared before being
              enabled. By default, it's inside the app's data directory.
            </p>
            <div className="flex items-center space-x-2 mb-2">
              <Input
                type="text"
                readOnly
                value={
                  isLoadingStagingPath
                    ? 'Loading...'
                    : stagingPathConfig?.activePath || 'Loading...'
                }
                className="flex-grow bg-neutral-700 border-neutral-600 text-slate-300 placeholder:text-neutral-500"
                placeholder="Path for staging mods"
              />
              <Button
                onClick={handleSelectStagingFolder}
                variant="outline"
                className="border-neutral-600 hover:bg-neutral-700"
              >
                Set Custom Folder
              </Button>
            </div>
            <div className="flex justify-between mb-3">
              <p className="text-xs text-slate-500">
                If you set a custom folder, ensure it has write permissions.
                Resetting will use the default location.
              </p>
              <Button
                onClick={handleResetStagingPath}
                variant="link"
                className="text-xs text-amber-500 hover:text-amber-400 px-0 h-auto"
              >
                Reset to Default
              </Button>
            </div>
          </section>
        </CardContent>
        <CardFooter className="border-t border-neutral-700 pt-4 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            Done
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SettingsPage;
