import MenuBar from '@/components/layout/MenuBar.tsx';
import StatusBar from '@/components/layout/StatusBar.tsx';
import AppContent from '@/components/layout/AppContent.tsx';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden text-slate-100 bg-neutral-600/60">
      <img
        src="/bg.jpg"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover top-0 left-0 blur-md -z-10"
      />
      <MenuBar />
      <main className="flex-grow overflow-y-auto p-6">
        <AppContent />
      </main>
      <StatusBar />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
