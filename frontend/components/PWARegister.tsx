/**
 * PWARegister.tsx
 * Registers the service worker so the app is installable (PWA) on Android.
 */

'use client';

import { useEffect } from 'react';

const PWARegister = () => {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
};

export default PWARegister;
