import React, { useCallback, useEffect, useRef } from 'react';
import { useDropzone, DropEvent, FileRejection } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

/**
 * @file ModDropzone.tsx
 * @description Component for handling mod file uploads via drag and drop.
 * It uses react-dropzone, Electron's webUtils, and sonner for notifications.
 */

export interface ProcessedFile {
  id: string;
  name: string;
  path: string; // Absolute path
  type: string;
  size: number;
  originalFileObject?: File; // Ora ci aspettiamo un File nativo
}

interface ModDropzoneProps {
  onModsDropped: (files: ProcessedFile[]) => void;
  existingModPaths: string[]; // NUOVA PROP per controllare i duplicati
}

/**
 * ModDropzone component provides a UI for dragging and dropping mod files.
 * It attempts to get absolute file paths using Electron's webUtils and provides user feedback via toasts.
 *
 * @param {ModDropzoneProps} props - The props for the component.
 * @param {function(ProcessedFile[]): void} props.onModsDropped - Callback with processed files.
 * @param {string[]} props.existingModPaths - Array of existing absolute mod paths to check for duplicates.
 * @returns {JSX.Element} The rendered dropzone area.
 */
const ModDropzone: React.FC<ModDropzoneProps> = ({
  onModsDropped,
  existingModPaths,
}) => {
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const handleRZDDrop = useCallback(
    (
      acceptedFiles: File[],
      fileRejections: FileRejection[],
      event: DropEvent
    ) => {
      console.log(
        'React-Dropzone onDrop callback triggered. This is mainly for RZD internal state handling or if manual drop fails.',
        {
          acceptedFilesCount: acceptedFiles.length,
          rejectedFilesCount: fileRejections.length,
        }
      );
      // Gestisci i file rigettati da react-dropzone (es. per tipo se avessimo configurato 'accept')
      // fileRejections.forEach(rejection => {
      //   rejection.errors.forEach(error => {
      //     toast.error(`File ${rejection.file.name} rejected: ${error.message}`);
      //   });
      // });
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleRZDDrop,
    useFsAccessApi: false,
    noClick: false,
    // Non usiamo l'opzione 'accept' di RZD qui, faremo il controllo dell'estensione manualmente
    // per dare un feedback più granulare e integrato con electronAPI.getFilePath
  });

  useEffect(() => {
    const currentDropzoneRef = dropzoneRef.current;

    const handleManualDrop = (event: Event) => {
      const dragEvent = event as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();

      console.log('Manual drop event triggered');
      const processedFilesOutput: ProcessedFile[] = [];
      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      let wrongFileTypeCount = 0;

      if (dragEvent.dataTransfer && dragEvent.dataTransfer.files) {
        const nativeFileList = dragEvent.dataTransfer.files;
        console.log('Native FileList from DragEvent:', nativeFileList);

        if (nativeFileList.length > 0) {
          for (let i = 0; i < nativeFileList.length; i++) {
            const nativeFile = nativeFileList.item(i);
            if (nativeFile && nativeFile instanceof File) {
              // 1. Filtrare per estensione .pak
              if (!nativeFile.name.toLowerCase().endsWith('.pak')) {
                console.warn(
                  `File ${nativeFile.name} is not a .pak file. Skipping.`
                );
                toast.warning(
                  `File "${nativeFile.name}" skipped: Only .pak files are allowed.`
                );
                wrongFileTypeCount++;
                continue; // Salta al prossimo file
              }

              try {
                // @ts-ignore TODO: Risolvere il problema di visibilità dei tipi per electronAPI
                const absolutePath = window.electronAPI.getFilePath(nativeFile);
                console.log(
                  `Path for ${nativeFile.name} from electronAPI: ${absolutePath}`
                );

                if (
                  absolutePath &&
                  typeof absolutePath === 'string' &&
                  !absolutePath.startsWith('./') &&
                  absolutePath.trim() !== ''
                ) {
                  // 2. Evitare Duplicati
                  if (existingModPaths.includes(absolutePath)) {
                    console.warn(
                      `File ${nativeFile.name} (${absolutePath}) is already in the list. Skipping.`
                    );
                    toast.info(
                      `Mod "${nativeFile.name}" is already in your list.`
                    );
                    duplicateCount++;
                    continue; // Salta al prossimo file
                  }

                  processedFilesOutput.push({
                    id: absolutePath, // Usiamo il path come ID dato che dovrebbe essere unico
                    name: nativeFile.name,
                    path: absolutePath,
                    type: nativeFile.type,
                    size: nativeFile.size,
                    originalFileObject: nativeFile,
                  });
                  successCount++;
                } else {
                  const fallbackId = uuidv4();
                  console.warn(
                    `electronAPI.getFilePath for ${nativeFile.name} returned problematic path: '${absolutePath}'. Using UUID: ${fallbackId}`
                  );
                  toast.error(
                    `Could not get a valid path for "${nativeFile.name}". It will be added with a temporary ID.`,
                    {
                      description:
                        'Please try adding it again or check file permissions.',
                    }
                  );
                  errorCount++;
                  processedFilesOutput.push({
                    id: fallbackId,
                    name: nativeFile.name,
                    path: typeof absolutePath === 'string' ? absolutePath : '',
                    type: nativeFile.type,
                    size: nativeFile.size,
                    originalFileObject: nativeFile,
                  });
                }
              } catch (error) {
                const errorId = uuidv4();
                console.error(
                  `Error calling getFilePath for ${nativeFile.name}:`,
                  error
                );
                toast.error(`Error processing file "${nativeFile.name}".`, {
                  description:
                    (error as Error)?.message || 'An unknown error occurred.',
                });
                errorCount++;
                processedFilesOutput.push({
                  id: errorId,
                  name: nativeFile.name,
                  path: '',
                  type: nativeFile.type,
                  size: nativeFile.size,
                  originalFileObject: nativeFile,
                });
              }
            }
          }
        } else {
          console.log('No files found in dataTransfer.');
          toast.info('No files were found in the drop operation.');
        }
      } else {
        console.log('No dataTransfer object found in DragEvent.');
        toast.error('Could not access dropped files. Please try again.');
      }

      if (successCount > 0) {
        toast.success(`${successCount} mod(s) added successfully!`);
      }
      // Ulteriori notifiche aggregate potrebbero essere mostrate qui se necessario,
      // ad esempio, se ci sono stati errori ma anche successi.

      if (
        processedFilesOutput.length > 0 ||
        wrongFileTypeCount > 0 ||
        duplicateCount > 0 ||
        errorCount > 0
      ) {
        onModsDropped(processedFilesOutput);
      }
    };

    const handleDragOver = (event: Event) => {
      const dragEvent = event as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
    };

    if (currentDropzoneRef) {
      currentDropzoneRef.addEventListener('drop', handleManualDrop);
      currentDropzoneRef.addEventListener('dragover', handleDragOver);
      console.log('Manual drop and dragover listeners attached.');
    }

    return () => {
      if (currentDropzoneRef) {
        currentDropzoneRef.removeEventListener('drop', handleManualDrop);
        currentDropzoneRef.removeEventListener('dragover', handleDragOver);
        console.log('Manual drop and dragover listeners removed.');
      }
    };
  }, [onModsDropped, existingModPaths]); // Aggiunto existingModPaths alle dipendenze

  const rootProps = getRootProps({ ref: dropzoneRef });

  return (
    <div
      {...rootProps}
      className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer
                  ${isDragActive ? 'border-green-500 bg-green-500/10' : 'border-neutral-500 hover:border-neutral-400'}`}
      style={{
        minHeight: '150px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <p className="text-green-500">Drop the .pak files here ...</p>
      ) : (
        <p className="text-neutral-400">
          Drag 'n' drop mod files here, or click to select files (.pak only)
        </p>
      )}
    </div>
  );
};

export default ModDropzone;
