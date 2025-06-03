import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone, DropEvent, FileRejection } from 'react-dropzone';
import { toast } from 'sonner';

export interface StagedModInfo {
  name: string;
  pakPath: string;
  ucasPath: string | null;
  utocPath: string | null;
  originalPath: string;
}

interface ModDropzoneProps {
  onModsProcessedAndStaged: (stagedMods: StagedModInfo[]) => void;
}

const SUPPORTED_EXTENSIONS = ['.pak', '.zip', '.rar', '.7z'];
const MIN_DROPZONE_HEIGHT = '150px';

const ModDropzone: React.FC<ModDropzoneProps> = ({
  onModsProcessedAndStaged,
}) => {
  const { t } = useTranslation();
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const handleReactDropzoneDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      console.log('React-Dropzone internal onDrop triggered', {
        acceptedFilesCount: acceptedFiles.length,
        rejectedFilesCount: fileRejections.length,
      });
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleReactDropzoneDrop,
    useFsAccessApi: false,
    noClick: false,
  });

  const isValidFileExtension = (fileName: string): boolean => {
    const lowerCaseName = fileName.toLowerCase();
    return SUPPORTED_EXTENSIONS.some((ext) => lowerCaseName.endsWith(ext));
  };

  const extractFilePath = (file: File): string | null => {
    try {
      // @ts-ignore TODO: electronAPI types
      const filePath = window.electronAPI.getFilePath(file);
      return filePath && typeof filePath === 'string' && filePath.trim() !== ''
        ? filePath
        : null;
    } catch (error) {
      console.warn(`Failed to get file path for ${file.name}:`, error);
      return null;
    }
  };

  const processValidFiles = (fileList: FileList): string[] => {
    const validFilePaths: string[] = [];
    let hasValidFiles = false;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList.item(i);
      if (!file) continue;

      if (isValidFileExtension(file.name)) {
        hasValidFiles = true;
        const filePath = extractFilePath(file);

        if (filePath) {
          validFilePaths.push(filePath);
        } else {
          toast.warning(
            `Could not determine path for "${file.name}". Skipped.`
          );
        }
      } else {
        toast.info(`File "${file.name}" is not supported and will be ignored.`);
      }
    }

    if (!hasValidFiles && fileList.length > 0) {
      toast.info(
        `No supported files found. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`
      );
    }

    return validFilePaths;
  };

  const processModsWithBackend = async (filePaths: string[]): Promise<void> => {
    if (filePaths.length === 0) return;

    try {
      // @ts-ignore TODO: electronAPI types
      const result = await window.electronAPI.processDroppedMods(filePaths);

      if (result.success && result.mods) {
        const modCount = result.mods.length;
        toast.success(`${modCount} mod(s) processed and staged successfully!`);
        onModsProcessedAndStaged(result.mods);
      } else {
        const errorMessage =
          result.error || 'An unknown error occurred in the backend.';
        toast.error('Failed to process mods.', { description: errorMessage });
        onModsProcessedAndStaged([]);
      }
    } catch (error: any) {
      const errorMessage =
        error.message || 'An unknown communication error occurred.';
      toast.error('Error sending mods to backend.', {
        description: errorMessage,
      });
      onModsProcessedAndStaged([]);
    }
  };

  const handleFileDrop = async (event: DragEvent): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();

    const { dataTransfer } = event;
    if (!dataTransfer?.files?.length) {
      toast.info('No files were found in the drop operation.');
      return;
    }

    const validFilePaths = processValidFiles(dataTransfer.files);
    await processModsWithBackend(validFilePaths);
  };

  const handleDragOver = (event: DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    const dropzoneElement = dropzoneRef.current;
    if (!dropzoneElement) return;

    const dropHandler = (event: Event) => handleFileDrop(event as DragEvent);
    const dragOverHandler = (event: Event) =>
      handleDragOver(event as DragEvent);

    dropzoneElement.addEventListener('drop', dropHandler);
    dropzoneElement.addEventListener('dragover', dragOverHandler);

    return () => {
      dropzoneElement.removeEventListener('drop', dropHandler);
      dropzoneElement.removeEventListener('dragover', dragOverHandler);
    };
  }, [onModsProcessedAndStaged]);

  const getDropzoneClasses = (): string => {
    const baseClasses =
      'p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-300 ease-out backdrop-blur-sm transform';
    const activeClasses =
      'border-green-500 bg-green-500/20 scale-105 shadow-lg shadow-green-500/30 dropzone-active';
    const inactiveClasses =
      'border-neutral-500 hover:border-neutral-400 hover:bg-neutral-800/20 hover:scale-102';

    return `${baseClasses} ${isDragActive ? activeClasses : inactiveClasses}`;
  };

  const dropzoneStyle = {
    minHeight: MIN_DROPZONE_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const supportedFormatsText = `Supporta file ${SUPPORTED_EXTENSIONS.join(', ')}`;

  const rootProps = getRootProps({ ref: dropzoneRef });

  return (
    <div {...rootProps} className={getDropzoneClasses()} style={dropzoneStyle}>
      <input {...getInputProps()} />
      <div className="text-center space-y-2">
        {isDragActive ? (
          <>
            <div className="text-2xl animate-bounce">📦</div>
            <p className="text-green-400 font-medium animate-pulse">
              {t('modDropzone.dropActive')}
            </p>
            <p className="text-green-300 text-sm">Rilascia i file qui</p>
          </>
        ) : (
          <>
            <div className="text-2xl opacity-50 transition-opacity duration-300 hover:opacity-75">
              📁
            </div>
            <p className="text-neutral-400 transition-colors duration-300 hover:text-neutral-300">
              {t('modDropzone.dropInactive')}
            </p>
            <p className="text-neutral-500 text-sm">{supportedFormatsText}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ModDropzone;
