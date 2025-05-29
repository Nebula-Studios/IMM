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
import { Input } from '../ui/input.tsx'; // Aggiunto Input
import { Label } from '../ui/label.tsx'; // Aggiunto Label
import { Switch } from '../ui/switch.tsx'; // Aggiunto Switch
import { ScrollArea } from '../ui/scroll-area.tsx'; // Importato ScrollArea
import { useTranslation } from 'react-i18next';
import { ModProfile } from '../../types/profiles.ts';
import { Pencil, Save, XCircle, Download, Upload } from 'lucide-react'; // Icone // MODIFICATO: Aggiunte Download e Upload
import { isAutoSaveEnabled } from '../../store/profileStore.ts'; // Import diretto della funzione
import { profileService } from '../../services/profileService.ts'; // Import nominato

interface ManageProfilesDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  profiles: ModProfile[];
  activeProfileId: string | null;
  onCreateProfile: (name: string, description?: string) => Promise<ModProfile | void>;
  onDeleteProfile: (profileId: string) => Promise<void>;
  onRenameProfile: (profileId: string, newName: string) => Promise<void>; // Aggiunto
}

const ManageProfilesDialog: React.FC<ManageProfilesDialogProps> = ({
  isOpen,
  onOpenChange,
  profiles,
  // activeProfileId,
  onCreateProfile,
  onDeleteProfile,
  onRenameProfile, // Aggiunto
}) => {
  const { t } = useTranslation();
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');

  // Stato per la rinomina
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');

  // Stato locale per lo switch, inizializzato dal valore globale
  const [autoSaveEnabledInDialog, setAutoSaveEnabledInDialog] = useState(isAutoSaveEnabled());

  // Reset dello stato di editing quando il dialog si chiude o i profili cambiano
  useEffect(() => {
    if (!isOpen) {
      setEditingProfileId(null);
      setEditingProfileName('');
    }
  }, [isOpen]);


  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      // Aggiungere feedback all'utente, es. con un toast/sonner
      alert(t('profiles.errors.emptyName')); // Sostituire con un sistema di notifiche migliore
      return;
    }
    try {
      await onCreateProfile(newProfileName, newProfileDescription);
      setNewProfileName('');
      setNewProfileDescription('');
      // La lista dei profili e il ProfileSelector dovrebbero aggiornarsi automaticamente
      // grazie alla gestione reattiva dello stato (es. Zustand)
    } catch (error) {
      console.error('Failed to create profile:', error);
      // Aggiungere feedback all'utente
      alert(t('profiles.errors.creationFailed')); // Sostituire
    }
  };

  const handleDeleteProfile = async (profileId: string, profileName: string) => {
    // eslint-disable-next-line no-alert
    if (window.confirm(t('profiles.deleteConfirmMessage', { name: profileName }))) {
      try {
        await onDeleteProfile(profileId);
        // La lista e il selector si aggiorneranno
      } catch (error) {
        console.error('Failed to delete profile:', error);
        // Aggiungere feedback all'utente
        alert(t('profiles.errors.deletionFailed')); // Sostituire
      }
    }
  };

  const handleStartRename = (profile: ModProfile) => {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
  };

  const handleCancelRename = () => {
    setEditingProfileId(null);
    setEditingProfileName('');
  };

  const handleSaveRename = async () => {
    if (!editingProfileId || !editingProfileName.trim()) {
      alert(t('profiles.errors.emptyNameOnRename')); // Sostituire con notifica
      return;
    }
    try {
      await onRenameProfile(editingProfileId, editingProfileName.trim());
      setEditingProfileId(null);
      setEditingProfileName('');
      // La lista si aggiornerà tramite lo store
    } catch (error) {
      console.error('Failed to rename profile:', error);
      alert(t('profiles.errors.renameFailed')); // Sostituire
    }
  };

  const handleAutoSaveToggle = async (enabled: boolean) => {
    setAutoSaveEnabledInDialog(enabled); // Aggiorna UI immediatamente
    try {
      await profileService.toggleAutoSave(enabled);
      // Non è necessario rileggere dallo store qui, dato che profileService aggiorna lo store globale
    } catch (error) {
      console.error('Failed to toggle auto-save:', error);
      // Aggiungere feedback all'utente, es. con un toast/sonner
      alert(t('profiles.errors.autoSaveToggleFailed')); // Sostituire
    }
  };

  const handleExportProfile = async (profileId: string) => {
    console.log('Attempting to export profile:', profileId);
    // Logica di esportazione qui
    try {
      const exportData = await profileService.exportProfile(profileId);
      if (!exportData) {
        alert(t('profiles.errors.exportFailedGeneral'));
        return;
      }

      const { fileName, content } = exportData;
      const saveDialogResult = await window.electronAPI.showSaveDialog({
        title: t('profiles.exportDialogTitle'),
        defaultPath: fileName,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (saveDialogResult.canceled || !saveDialogResult.filePath) {
        console.log('Export cancelled by user.');
        return;
      }

      const writeResult = await window.electronAPI.writeFileContent(saveDialogResult.filePath, content);
      if (writeResult.success) {
        alert(t('profiles.exportSuccessMessage', { fileName: saveDialogResult.filePath }));
      } else {
        console.error('Failed to write profile to file:', writeResult.error);
        alert(t('profiles.errors.exportWriteFailed', { error: writeResult.error }));
      }
    } catch (error: any) {
      console.error('Error during profile export:', error);
      alert(t('profiles.errors.exportFailed', { error: error.message || 'Unknown error' }));
    }
  };

  const handleImportProfile = async () => {
    console.log('Attempting to import profile.');
    // Logica di importazione qui
    try {
      const openDialogResult = await window.electronAPI.showOpenDialog({
        title: t('profiles.importDialogTitle'),
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (openDialogResult.canceled || !openDialogResult.filePaths || openDialogResult.filePaths.length === 0) {
        console.log('Import cancelled by user or no file selected.');
        return;
      }

      const filePath = openDialogResult.filePaths[0];
      const readResult = await window.electronAPI.readFileContent(filePath);

      if (!readResult.success || typeof readResult.content !== 'string') {
        console.error('Failed to read profile file:', readResult.error);
        alert(t('profiles.errors.importReadFailed', { error: readResult.error }));
        return;
      }

      let profileDataToImport: ModProfile;
      try {
        profileDataToImport = JSON.parse(readResult.content);
      } catch (parseError: any) {
        console.error('Failed to parse profile JSON:', parseError);
        alert(t('profiles.errors.importParseFailed', { error: parseError.message }));
        return;
      }
      
      // Rimuoviamo id, createdAt, lastUsed, isActive, isAutoGenerated dal profilo importato
      // perché ProfileService.importProfile li rigenererà o imposterà valori di default.
      const {
        id,
        createdAt,
        lastUsed,
        isActive,
        isAutoGenerated,
        ...sanitizedProfileData
      } = profileDataToImport;


      const importResult = await profileService.importProfile(sanitizedProfileData as ModProfile); // Assicurati che il tipo sia corretto

      if ('error' in importResult) {
        console.error('Failed to import profile:', importResult.error);
        alert(t('profiles.errors.importServiceFailed', { error: importResult.error }));
      } else {
        alert(t('profiles.importSuccessMessage', { name: importResult.name }));
        // Il ProfileSelector e la lista si aggiorneranno tramite lo store
      }
    } catch (error: any) {
      console.error('Error during profile import:', error);
      alert(t('profiles.errors.importFailedGeneral', { error: error.message || 'Unknown error' }));
    }
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
        <ScrollArea className="max-h-[60vh] pr-6"> {/* Aggiunto pr-6 per padding a destra per la scrollbar */}
          {/* Sezione Impostazioni Auto-Salvataggio */}
          <div className="grid gap-4 py-4 border-b pb-6 mb-4">
            <h4 className="font-semibold text-lg mb-2">{t('profiles.autoSaveSettingsTitle')}</h4>
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-save-switch"
                checked={autoSaveEnabledInDialog}
                onCheckedChange={handleAutoSaveToggle}
              />
              <Label htmlFor="auto-save-switch" className="flex flex-col">
                <span>{t('profiles.autoSaveLabel')}</span>
                <span className="text-xs text-muted-foreground">{t('profiles.autoSaveDescription')}</span>
              </Label>
            </div>
          </div>

          {/* Sezione Creazione Nuovo Profilo */}
          <div className="grid gap-4 py-4 border-b pb-6 mb-4">
            <h4 className="font-semibold text-lg mb-2">{t('profiles.createNewProfileTitle')}</h4>
            <div className="grid gap-2">
              <Label htmlFor="new-profile-name">{t('profiles.newProfileNameLabel')}</Label>
              <Input
                id="new-profile-name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder={t('profiles.newProfileNamePlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-profile-description">{t('profiles.newProfileDescriptionLabel')}</Label>
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
          
          {/* Sezione Importa Profilo */}
          <div className="grid gap-4 py-4 border-b pb-6 mb-4">
            <h4 className="font-semibold text-lg mb-2">{t('profiles.importProfileTitle')}</h4>
            <Button onClick={handleImportProfile} variant="outline" className="mt-2">
              <Upload className="mr-2 h-4 w-4" />
              {t('profiles.importButton')}
            </Button>
          </div>

          {/* Sezione Profili Esistenti */}
          <div>
            <h4 className="font-semibold text-lg mb-3">{t('profiles.existingProfiles')}:</h4>
            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('profiles.noProfilesYet')}</p>
            ) : (
              <ul className="space-y-3">
                {profiles.map((profile) => {
                  const isDefaultProtected = profile.name === 'Default' && profile.isAutoGenerated;
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
                            onChange={(e) => setEditingProfileName(e.target.value)}
                            className="h-9"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename();
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                          />
                          <Button variant="ghost" size="icon" onClick={handleSaveRename} title={t('common.save')}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={handleCancelRename} title={t('common.cancel')}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-grow">
                          <span className="font-medium">{profile.name}</span>
                          {profile.description && (
                            <p className="text-xs text-muted-foreground">{profile.description}</p>
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
                            disabled={isDefaultProtected && profile.name === 'Default'} // Permetti l'esportazione del Default se non è quello autogenerato, o se non si chiama Default
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartRename(profile)}
                            title={t('common.edit')}
                            disabled={isDefaultProtected}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm" // o "icon" se preferisci solo l'icona
                            onClick={() => handleDeleteProfile(profile.id, profile.name)}
                            disabled={isDefaultProtected}
                            title={isDefaultProtected ? t('profiles.cannotDeleteDefault') : t('profiles.deleteButtonTooltip')}
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
        <DialogFooter className="mt-6 pt-6 border-t"> {/* Aggiunto padding top e bordo per separazione */}
          <Button variant="outline" onClick={() => {
            onOpenChange(false);
            handleCancelRename(); // Assicura che lo stato di modifica sia resettato
          }}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageProfilesDialog;