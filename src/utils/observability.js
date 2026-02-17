// Ensure optional analytics globals exist.
// Reason: some pages call `window.gtag` and should not crash when the GA script isn't injected
// (local dev, previews, isolated runs).

export function ensureObservabilityGlobals() {
  if (typeof window === 'undefined') return;

  if (typeof window.gtag !== 'function') {
    window.gtag = () => {};
  }
}

