'use client';

import { useEffect } from 'react';

/**
 * Service Worker registration with AGGRESSIVE auto-update.
 * - Registers SW on load
 * - Checks for updates every 60 seconds
 * - When new SW takes control, reload the page automatically
 * - When tab becomes visible after being hidden, check for updates
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let registration: ServiceWorkerRegistration | null = null;
    let updateInterval: any = null;
    let reloading = false;

    // Auto-reload when new SW takes control
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(reg => {
      registration = reg;
      // Check immediately
      reg.update().catch(() => {});
      // Periodic check every 60s
      updateInterval = setInterval(() => {
        if (registration) registration.update().catch(() => {});
      }, 60000);
      // On new SW waiting, skip waiting + take over
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available — activate it immediately
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(() => {});

    // Check for updates when tab becomes visible
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && registration) {
        registration.update().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibility);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);

  return null;
}
