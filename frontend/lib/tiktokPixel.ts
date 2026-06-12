/**
 * tiktokPixel.ts
 * Thin client-side wrapper around the TikTok pixel (window.ttq), loaded in the
 * root layout. Used for upper-funnel events (ViewContent, ClickButton,
 * InitiateCheckout, AddPaymentInfo). Money/conversion events
 * (CompleteRegistration, CompletePayment) are sent server-side via the Events
 * API instead, so they aren't duplicated here. No-op if the pixel isn't ready.
 */

type TtqParams = Record<string, unknown>;

declare global {
  interface Window {
    ttq?: { track: (event: string, params?: TtqParams) => void; page: () => void };
  }
}

export const ttqTrack = (event: string, params?: TtqParams): void => {
  if (typeof window === 'undefined' || !window.ttq) return;
  try {
    window.ttq.track(event, params);
  } catch {
    /* analytics must never break the app */
  }
};
