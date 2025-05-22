import MenuBar from '@/components/layout/MenuBar.tsx';
import StatusBar from '@/components/layout/StatusBar.tsx';
import AppContent from '@/components/layout/AppContent.tsx';
import { Toaster } from '@/components/ui/sonner.tsx';
import { useGameFolderPath } from '@/hooks/useGameFolderPath.ts';

export default function App() {
  const { gameFolderPath, handleDevClearFolder } = useGameFolderPath();

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden text-slate-100 bg-neutral-900/80">
      <img
        src="/bg_nebula.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-fill top-0 left-0 -z-10 blur-sm"
      />
      <MenuBar
        gameFolderPath={gameFolderPath}
        onDevClearFolder={handleDevClearFolder}
      />
      <main className="flex-grow overflow-y-auto">
        <AppContent />
      </main>
      <StatusBar />
      <Toaster position="bottom-right" />
    </div>
  );
}
