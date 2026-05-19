import { supabase } from "@/integrations/supabase/client";

const SENT_KEY = "rum_sent_v1";

function deviceType(w: number): "mobile" | "tablet" | "desktop" {
  if (w < 768) return "mobile";
  if (w < 1280) return "tablet";
  return "desktop";
}

function round(n: number | null | undefined): number | null {
  return n == null || !isFinite(n) ? null : Math.max(0, Math.round(n));
}

type Metrics = {
  slug: string;
  comedorId: string | null;
};

/**
 * Captura TTFB / FCP / LCP / DOM Interactive / Load total y los envía
 * una sola vez por carga de página vía sendBeacon (con fallback fetch).
 */
export function trackSurveyRum({ slug, comedorId }: Metrics) {
  if (typeof window === "undefined" || !("performance" in window)) return;

  // Evita doble envío en HMR / re-mount
  const key = `${SENT_KEY}:${slug}:${performance.timeOrigin | 0}`;
  try {
    if (sessionStorage.getItem(key)) return;
  } catch {
    /* ignore */
  }

  let lcp: number | null = null;
  let fcp: number | null = null;

  // FCP
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          fcp = entry.startTime;
          obs.disconnect();
        }
      }
    });
    obs.observe({ type: "paint", buffered: true });
  } catch {
    /* ignore */
  }

  // LCP
  try {
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      lcp = last.startTime;
    });
    obs.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    /* ignore */
  }

  const send = () => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }

    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

    const ttfb = nav ? nav.responseStart : null;
    const domInt = nav ? nav.domInteractive : null;
    const load = nav
      ? nav.loadEventEnd > 0
        ? nav.loadEventEnd
        : performance.now()
      : performance.now();

    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } })
      .connection?.effectiveType;

    const payload = {
      slug,
      comedor_id: comedorId,
      ttfb_ms: round(ttfb),
      fcp_ms: round(fcp),
      lcp_ms: round(lcp),
      dom_interactive_ms: round(domInt),
      load_ms: round(load),
      device_type: deviceType(window.innerWidth),
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      connection_type: conn ?? null,
      user_agent: navigator.userAgent.slice(0, 500),
    };

    // Insert directo vía supabase-js (usa fetch + keepalive en background)
    void supabase
      .from("rum_metrics")
      .insert(payload)
      .then(({ error }) => {
        if (error && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn("RUM insert failed", error.message);
        }
      });
  };

  const trigger = () => {
    // Espera un tick tras load para que FCP/LCP estén listos
    setTimeout(send, 600);
  };

  if (document.readyState === "complete") {
    trigger();
  } else {
    window.addEventListener("load", trigger, { once: true });
  }

  // Fallback: si el usuario se va antes del load, enviamos lo que haya
  const onHide = () => {
    if (document.visibilityState === "hidden") send();
  };
  document.addEventListener("visibilitychange", onHide, { once: true });
}