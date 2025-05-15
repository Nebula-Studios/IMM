'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';

const MOD_ENABLER_NEXUS_URL = 'https://www.nexusmods.com/inzoi/mods/1';

export function ModEnablerStatusNotifier() {
  useEffect(() => {
    let toastId: string | number | undefined = undefined;

    const checkStatus = async () => {
      try {
        if (!window.electronAPI) {
          console.error('electronAPI is not available on window object.');
          toast.error('Communication Error', {
            description:
              'Could not communicate with the main application process.',
          });
          return;
        }

        const gameFolderPath = await window.electronAPI.getGameFolderPath();
        if (!gameFolderPath) {
          console.info(
            '[ModEnablerStatusNotifier] Game folder not set, skipping Mod Enabler check.'
          );
          return;
        }

        toastId = toast.loading('Checking InZOI Mod Support...', {
          description: 'Verifying InZOI Mod Enabler presence...',
        });

        const status = await window.electronAPI.checkModEnablerStatus();
        console.info('[ModEnablerStatusNotifier] Mod Enabler Status:', status);

        if (status && status.checked) {
          if (status.dsoundExists && status.bitfixFolderExists) {
            toast.success('Mod Support Active', {
              id: toastId,
              description: 'The InZOI Mod Enabler is installed correctly!',
              duration: 5000,
            });
          } else {
            const title = 'Mod Support Incomplete';
            const description =
              'The InZOI Mod Enabler seems to be missing or incomplete. Click the button to visit the download page and follow the instructions.';

            let debugDetails = [];
            if (!status.dsoundExists) debugDetails.push('dsound.dll missing');
            if (!status.bitfixFolderExists)
              debugDetails.push('bitfix folder missing');
            console.warn(
              `[ModEnablerStatusNotifier] Mod Enabler issue: ${debugDetails.join(', ')}`
            );

            toast.warning(title, {
              id: toastId,
              description: description,
              action: {
                label: 'Go to Nexus Mods',
                onClick: async () => {
                  try {
                    await window.electronAPI.openExternalLink(
                      MOD_ENABLER_NEXUS_URL
                    );
                  } catch (linkError) {
                    console.error('Failed to open external link:', linkError);
                    toast.error('Failed to Open Link', {
                      description:
                        'Could not open the link. Check your internet connection or browser settings.',
                    });
                  }
                },
              },
              duration: 12000,
            });
          }
        } else if (status && !status.checked && status.error) {
          console.warn(
            '[ModEnablerStatusNotifier] Mod enabler check not performed or failed early:',
            status.error
          );
          toast.error('Mod Support Check Error', {
            id: toastId,
            description:
              status.error || 'Could not complete Mod Enabler verification.',
          });
        } else {
          throw new Error('Invalid Mod Enabler status received.');
        }
      } catch (error: any) {
        console.error(
          '[ModEnablerStatusNotifier] Failed to check Mod Enabler status (exception):',
          error
        );
        toast.error('Critical Mod Enabler Check Error', {
          id: toastId,
          description: `Could not verify Mod Enabler status: ${error?.message || 'Unknown error'}`,
        });
      }
    };

    const timerId = setTimeout(checkStatus, 2500);

    return () => {
      clearTimeout(timerId);
      if (toastId) {
        toast.dismiss(toastId);
      }
    };
  }, []);

  return null;
}
