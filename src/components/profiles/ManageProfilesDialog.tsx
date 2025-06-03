import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Label } from '../ui/label.tsx';
import { Switch } from '../ui/switch.tsx';
import { ScrollArea } from '../ui/scroll-area.tsx';
import { useTranslation } from 'react-i18next';
import { ModProfile } from '../../types/profiles.ts';
import { Pencil, Save, XCircle, Download, Upload } from 'lucide-react';
import { isAutoSaveEnabled } from '../../store/profileStore.ts';
import { profileService } from '../../services/profileService.ts';

interface ManageProfilesDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  profiles: ModProfile[];
  activeProfileId: string | null;
  onCreateProfile: (
    name: string,
    description?: string
  ) => Promise<ModProfile | void>;
  onDeleteProfile: (profileId: string) => Promise<void>;
  onRenameProfile: (profileId: string, newName: string) => Promise<void>; // Aggiunto
}

const ManageProfilesDialog: React.FC<ManageProfilesDialogProps> = ({
  isOpen,
  onOpenChange,
  profiles,
  onCreateProfile,
  onDeleteProfile,
  onRenameProfile,
}) => {
  const { t } = useTranslation();
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [autoSaveEnabledInDialog, setAutoSaveEnabledInDialog] =
    useState(isAutoSaveEnabled());
  useEffect(() => {
    if (!isOpen) {
      setEditingProfileId(null);
      setEditingProfileName('');
    }
  }, [isOpen]);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      alert(t('profiles.errors.emptyName'));
      return;
    }

    try {
      await onCreateProfile(newProfileName, newProfileDescription);
      resetNewProfileForm();
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert(t('profiles.errors.creationFailed'));
    }
  };

  const resetNewProfileForm = () => {
    setNewProfileName('');
    setNewProfileDescription('');
  };

  const handleDeleteProfile = async (
    profileId: string,
    profileName: string
  ) => {
    const isConfirmed = window.confirm(
      t('profiles.deleteConfirmMessage', { name: profileName })
    );
    if (!isConfirmed) return;

    try {
      await onDeleteProfile(profileId);
    } catch (error) {
      console.error('Failed to delete profile:', error);
      alert(t('profiles.errors.deletionFailed'));
    }
  };

  const handleStartRename = (profile: ModProfile) => {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
  };

  const resetEditingState = () => {
    setEditingProfileId(null);
    setEditingProfileName('');
  };

  const handleCancelRename = resetEditingState;

  const handleSaveRename = async () => {
    if (!editingProfileId || !editingProfileName.trim()) {
      alert(t('profiles.errors.emptyNameOnRename'));
      return;
    }

    try {
      await onRenameProfile(editingProfileId, editingProfileName.trim());
      resetEditingState();
    } catch (error) {
      console.error('Failed to rename profile:', error);
      alert(t('profiles.errors.renameFailed'));
    }
  };

  const handleAutoSaveToggle = async (enabled: boolean) => {
    setAutoSaveEnabledInDialog(enabled);

    try {
      await profileService.toggleAutoSave(enabled);
    } catch (error) {
      console.error('Failed to toggle auto-save:', error);
      alert(t('profiles.errors.autoSaveToggleFailed'));
    }
  };

  const handleExportProfile = async (profileId: string) => {
    try {
      const exportData = await profileService.exportProfile(profileId);
      if (!exportData) {
        alert(t('profiles.errors.exportFailedGeneral'));
        return;
      }

      const saveDialogResult = await showExportDialog(exportData.fileName);
      if (!saveDialogResult) return;

      await writeExportFile(saveDialogResult, exportData.content);
    } catch (error: any) {
      console.error('Error during profile export:', error);
      alert(
        t('profiles.errors.exportFailed', {
          error: error.message || 'Unknown error',
        })
      );
    }
  };

  const showExportDialog = async (fileName: string) => {
    const result = await window.electronAPI.showSaveDialog({
      title: t('profiles.exportDialogTitle'),
      defaultPath: fileName,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    return result.canceled || !result.filePath ? null : result.filePath;
  };

  const writeExportFile = async (filePath: string, content: string) => {
    const writeResult = await window.electronAPI.writeFileContent(
      filePath,
      content
    );

    if (writeResult.success) {
      alert(t('profiles.exportSuccessMessage', { fileName: filePath }));
    } else {
      console.error('Failed to write profile to file:', writeResult.error);
      alert(
        t('profiles.errors.exportWriteFailed', { error: writeResult.error })
      );
    }
  };

  const handleImportProfile = async () => {
    try {
      const selectedFile = await selectImportFile();
      if (!selectedFile) return;

      const fileContent = await readImportFile(selectedFile);
      if (!fileContent) return;

      const profileData = await parseProfileData(fileContent);
      if (!profileData) return;

      await importProfileData(profileData);
    } catch (error: any) {
      console.error('Error during profile import:', error);
      alert(
        t('profiles.errors.importFailedGeneral', {
          error: error.message || 'Unknown error',
        })
      );
    }
  };

  const selectImportFile = async () => {
    const result = await window.electronAPI.showOpenDialog({
      title: t('profiles.importDialogTitle'),
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });

    return result.canceled || !result.filePaths?.length
      ? null
      : result.filePaths[0];
  };

  const readImportFile = async (filePath: string) => {
    const readResult = await window.electronAPI.readFileContent(filePath);

    if (!readResult.success || typeof readResult.content !== 'string') {
      console.error('Failed to read profile file:', readResult.error);
      alert(t('profiles.errors.importReadFailed', { error: readResult.error }));
      return null;
    }

    return readResult.content;
  };

  const parseProfileData = async (content: string) => {
    try {
      return JSON.parse(content);
    } catch (parseError: any) {
      console.error('Failed to parse profile JSON:', parseError);
      alert(
        t('profiles.errors.importParseFailed', { error: parseError.message })
      );
      return null;
    }
  };

  const importProfileData = async (profileData: ModProfile) => {
    const sanitizedData = sanitizeImportedProfile(profileData);
    const importResult = await profileService.importProfile(
      sanitizedData as ModProfile
    );

    if ('error' in importResult) {
      console.error('Failed to import profile:', importResult.error);
      alert(
        t('profiles.errors.importServiceFailed', { error: importResult.error })
      );
    } else {
      alert(t('profiles.importSuccessMessage', { name: importResult.name }));
    }
  };

  const sanitizeImportedProfile = (profileData: ModProfile) => {
    const {
      id,
      createdAt,
      lastUsed,
      isActive,
      isAutoGenerated,
      ...sanitizedData
    } = profileData;
    return sanitizedData;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('profiles.manageProfilesTitle')}</DialogTitle>
          <DialogDescription>
            {t('profiles.manageProfilesDescription')}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-6">
          <div className="grid gap-4 py-4 border-b pb-6 mb-4">
            <h4 className="font-semibold text-lg mb-2">
              {t('profiles.autoSaveSettingsTitle')}
            </h4>
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-save-switch"
                checked={autoSaveEnabledInDialog}
                onCheckedChange={handleAutoSaveToggle}
              />
              <Label htmlFor="auto-save-switch" className="flex flex-col">
                <span>{t('profiles.autoSaveLabel')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('profiles.autoSaveDescription')}
                </span>
              </Label>
            </div>
          </div>

          <div className="grid gap-4 py-4 border-b pb-6 mb-4">
            <h4 className="font-semibold text-lg mb-2">
              {t('profiles.createNewProfileTitle')}
            </h4>
            <div className="grid gap-2">
              <Label htmlFor="new-profile-name">
                {t('profiles.newProfileNameLabel')}
              </Label>
              <Input
                id="new-profile-name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder={t('profiles.newProfileNamePlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-profile-description">
                {t('profiles.newProfileDescriptionLabel')}
              </Label>
              <Input
                id="new-profile-description"
                value={newProfileDescription}
                onChange={(e) => setNewProfileDescription(e.target.value)}
                placeholder={t('profiles.newProfileDescriptionPlaceholder')}
              />
            </div>
            <Button onClick={handleCreateProfile} className="mt-2">
              {t('profiles.createButton')}
            </Button>
          </div>

          <div className="grid gap-4 py-4 border-b pb-6 mb-4">
            <h4 className="font-semibold text-lg mb-2">
              {t('profiles.importProfileTitle')}
            </h4>
            <Button
              onClick={handleImportProfile}
              variant="outline"
              className="mt-2"
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('profiles.importButton')}
            </Button>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-3">
              {t('profiles.existingProfiles')}:
            </h4>
            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('profiles.noProfilesYet')}
              </p>
            ) : (
              <ul className="space-y-3">
                {profiles.map((profile) => {
                  const isDefaultProtected =
                    profile.name === 'Default' && profile.isAutoGenerated;
                  const isEditingThis = editingProfileId === profile.id;

                  return (
                    <li
                      key={profile.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-md gap-2"
                    >
                      {isEditingThis ? (
                        <div className="flex-grow flex items-center gap-2">
                          <Input
                            type="text"
                            value={editingProfileName}
                            onChange={(e) =>
                              setEditingProfileName(e.target.value)
                            }
                            className="h-9"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename();
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSaveRename}
                            title={t('common.save')}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCancelRename}
                            title={t('common.cancel')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-grow">
                          <span className="font-medium">{profile.name}</span>
                          {profile.description && (
                            <p className="text-xs text-muted-foreground">
                              {profile.description}
                            </p>
                          )}
                        </div>
                      )}
                      {!isEditingThis && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExportProfile(profile.id)}
                            title={t('profiles.exportButtonTooltip')}
                            disabled={
                              isDefaultProtected && profile.name === 'Default'
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            color="neutral"
                            size="icon"
                            onClick={() => handleStartRename(profile)}
                            title={t('common.edit')}
                            disabled={isDefaultProtected}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            color="danger"
                            size="icon"
                            onClick={() =>
                              handleDeleteProfile(profile.id, profile.name)
                            }
                            disabled={isDefaultProtected}
                            title={
                              isDefaultProtected
                                ? t('profiles.cannotDeleteDefault')
                                : t('profiles.deleteButtonTooltip')
                            }
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-6 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetEditingState();
            }}
          >
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageProfilesDialog;
