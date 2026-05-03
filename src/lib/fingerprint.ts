const KEY = "kiosk_device_fingerprint_v1";

export function getDeviceFingerprint(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // localStorage unavailable (private mode, SSR) — generate ephemeral id
    return crypto.randomUUID();
  }
}
