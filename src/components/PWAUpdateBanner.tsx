import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

export function PWAUpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      if (!registration) return;

      // iOS PWA: check for updates whenever the app comes back to the foreground
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      // Also poll every 60 s while the tab is open (catches long sessions)
      setInterval(() => registration.update(), 60_000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-green-600 text-white px-4 py-2 flex items-center justify-between shadow-lg safe-top">
      <span className="text-sm font-medium">A new version is available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="flex items-center gap-1.5 text-xs bg-white text-green-700 font-bold px-3 py-1 rounded-full hover:bg-green-50 transition-colors"
      >
        <RefreshCw className="w-3 h-3" /> Reload
      </button>
    </div>
  );
}
