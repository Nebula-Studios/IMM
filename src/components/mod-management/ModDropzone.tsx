import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // Aggiunto per i18next
import { useDropzone, DropEvent, FileRejection } from 'react-dropzone';
import { toast } from 'sonner';

/**
 * @file ModDropzone.tsx
 * @description Component for handling mod file uploads via drag and drop.
 * It now directly calls electronAPI.processDroppedMods.
 */

// Questa interfaccia ora riflette l'output di electronAPI.processDroppedMods
// che include i path DEI FILE NELLA CARTELLA DI STAGING.
export interface StagedModInfo {
  name: string; // Nome base del mod (es. MyMod)
  pakPath: string; // Path assoluto al .pak nella staging (es. /path/to/staging/MyMod.pak)
  ucasPath: string | null;
  utocPath: string | null;
  originalPath: string; // Path originale del file droppato (per riferimento, se serve)
}

interface ModDropzoneProps {
  // La callback ora riceve StagedModInfo[] dal backend
  onModsProcessedAndStaged: (stagedMods: StagedModInfo[]) => void;
  // existingModPaths non è più necessario qui, il backend (processDroppedMods)
  // idealmente dovrebbe gestire la sovrascrittura o il versionamento se necessario,
  // o potremmo reintrodurlo se la logica di duplicati deve rimanere nel frontend PRIMA della copia.
  // Per ora, semplifichiamo e assumiamo che il backend gestisca le collisioni di nomi nella staging.
}

/**
 * ModDropzone component provides a UI for dragging and dropping mod files.
 * It calls electronAPI.processDroppedMods to copy files to the staging area
 * and then calls onModsProcessedAndStaged with the results.
 *
 * @param {ModDropzoneProps} props - The props for the component.
 * @returns {JSX.Element} The rendered dropzone area.
 */
const ModDropzone: React.FC<ModDropzoneProps> = ({
  onModsProcessedAndStaged,
}) => {
  const { t } = useTranslation();
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // Non usiamo più handleRZDDrop per la logica principale, ma la manteniamo per la configurazione di RZD
  const handleRZDDrop = useCallback(
    (
      acceptedFiles: File[],
      fileRejections: FileRejection[],
      event: DropEvent
    ) => {
      console.log(
        'React-Dropzone internal onDrop. Main logic is in manual "drop" listener.',
        {
          acceptedFilesCount: acceptedFiles.length,
          rejectedFilesCount: fileRejections.length,
        }
      );
      // Potremmo loggare i file rigettati da RZD se configuriamo filtri specifici in getRootProps
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleRZDDrop,
    useFsAccessApi: false, // Consigliato per compatibilità con Electron
    noClick: false, // Permetti click per aprire il dialogo file
    // Non filtriamo i tipi qui, processDroppedMods si occuperà di .pak e il nostro codice ignorerà gli altri
  });

  useEffect(() => {
    const currentDropzoneRef = dropzoneRef.current;

    const handleManualDrop = async (event: Event) => {
      const dragEvent = event as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();

      console.log('Manual drop event triggered in ModDropzone');
      let filesToProcess: string[] = []; // Array di path originali da passare a processDroppedMods

      if (dragEvent.dataTransfer && dragEvent.dataTransfer.files) {
        const nativeFileList = dragEvent.dataTransfer.files;
        if (nativeFileList.length > 0) {
          let validFileFound = false; // Accetta .pak, .zip, e .rar
          for (let i = 0; i < nativeFileList.length; i++) {
            const nativeFile = nativeFileList.item(i);
            if (nativeFile && nativeFile instanceof File) {
              const fileNameLower = nativeFile.name.toLowerCase();
              if (fileNameLower.endsWith('.pak') || fileNameLower.endsWith('.zip') || fileNameLower.endsWith('.rar') || fileNameLower.endsWith('.7z')) {
                validFileFound = true;
                // @ts-ignore TODO: electronAPI types
                const filePath = window.electronAPI.getFilePath(nativeFile); // Otteniamo il path originale
                if (
                  filePath &&
                  typeof filePath === 'string' &&
                  filePath.trim() !== ''
                ) {
                  filesToProcess.push(filePath);
                } else {
                  console.warn(
                    `Could not get original path for ${nativeFile.name}. Skipping.`
                  );
                  toast.warning(
                    `Could not determine path for "${nativeFile.name}". Skipped.`
                  );
                }
              } else {
                toast.info(
                  `File "${nativeFile.name}" is not a .pak, .zip, .rar, or .7z file and will be ignored.`
                );
              }
            }
          }

          if (!validFileFound && nativeFileList.length > 0) {
            toast.info('No .pak, .zip, .rar, or .7z files found in the dropped items.');
            return; // Nessun file valido da processare
          }

          if (filesToProcess.length > 0) {
            console.log(
              '[ModDropzone] Files to process by backend (.pak, .zip, .rar, or .7z):',
              filesToProcess
            );
            try {
              // @ts-ignore TODO: electronAPI types
              const result =
                await window.electronAPI.processDroppedMods(filesToProcess);
              if (result.success && result.mods) {
                console.log(
                  '[ModDropzone] Mods processed by backend:',
                  result.mods
                );
                toast.success(
                  `${result.mods.length} mod(s) (from .pak/.zip/.rar/.7z) processed and staged successfully!`
                );
                onModsProcessedAndStaged(result.mods);
              } else {
                console.error(
                  '[ModDropzone] Backend failed to process mods:',
                  result.error
                );
                toast.error('Failed to process mods.', {
                  description:
                    result.error || 'An unknown error occurred in the backend.',
                });
                onModsProcessedAndStaged([]); // Passa array vuoto in caso di fallimento totale
              }
            } catch (error: any) {
              console.error(
                '[ModDropzone] Error calling processDroppedMods:',
                error
              );
              toast.error('Error sending mods to backend.', {
                description:
                  error.message || 'An unknown communication error occurred.',
              });
              onModsProcessedAndStaged([]);
            }
          } else if (validFileFound) {
            // c'erano .pak, .zip, .rar o .7z ma non siamo riusciti a ottenere i path
            toast.warning(
              'Found .pak, .zip, .rar, or .7z files, but could not determine their paths to process.'
            );
          }
        } else {
          toast.info('No files were found in the drop operation.');
        }
      } else {
        toast.error('Could not access dropped files. Please try again.');
      }
    };

    const handleDragOver = (event: Event) => {
      const dragEvent = event as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      // Potremmo aggiungere un feedback visivo qui se isDragActive non basta
    };

    if (currentDropzoneRef) {
      currentDropzoneRef.addEventListener('drop', handleManualDrop);
      currentDropzoneRef.addEventListener('dragover', handleDragOver);
    }

    return () => {
      if (currentDropzoneRef) {
        currentDropzoneRef.removeEventListener('drop', handleManualDrop);
        currentDropzoneRef.removeEventListener('dragover', handleDragOver);
      }
    };
  }, [onModsProcessedAndStaged]);

  const rootProps = getRootProps({ ref: dropzoneRef });

  return (
    <div
      {...rootProps}
      className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-300 ease-out
                  backdrop-blur-sm transform
                  ${isDragActive
                    ? 'border-green-500 bg-green-500/20 scale-105 shadow-lg shadow-green-500/30 dropzone-active'
                    : 'border-neutral-500 hover:border-neutral-400 hover:bg-neutral-800/20 hover:scale-102'}`}
      style={{
        minHeight: '150px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <input {...getInputProps()} />
      <div className="text-center space-y-2">
        {isDragActive ? (
          <>
            <div className="text-2xl animate-bounce">📦</div>
            <p className="text-green-400 font-medium animate-pulse">
              {t('modDropzone.dropActive')}
            </p>
            <p className="text-green-300 text-sm">
              Rilascia i file .pak, .zip, .rar o .7z qui
            </p>
          </>
        ) : (
          <>
            <div className="text-2xl opacity-50 transition-opacity duration-300 hover:opacity-75">
              📁
            </div>
            <p className="text-neutral-400 transition-colors duration-300 hover:text-neutral-300">
              {t('modDropzone.dropInactive')}
            </p>
            <p className="text-neutral-500 text-sm">
              Supporta file .pak, .zip, .rar e .7z
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ModDropzone;
