import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Invisible component — only purpose is to call registration.update()
 * when the app comes back to the foreground (visibilitychange) or every
 * 60 s. vite-plugin-pwa autoUpdate mode then handles skipWaiting + page
 * reload automatically, so the displayed version is always current.
 */
export function PWAUpdateBanner() {
  useRegisterSW({
    onRegistered(registration) {
      if (!registration) return;
      const check = () => {
        if (document.visibilityState === 'visible') registration.update();
      };
      document.addEventListener('visibilitychange', check);
      setInterval(() => registration.update(), 60_000);
    },
  });
  return null;
}
