"use client";

/**
 * Best-effort screenshot capture for feedback.
 *
 * Two things make this less trivial than one `html2canvas()` call:
 *
 * 1. Tailwind v4 emits every colour as `oklch()`, which the original
 *    `html2canvas` cannot parse — it renders blank or black. `html2canvas-pro`
 *    is a drop-in fork that supports the modern colour functions, imported
 *    lazily so it stays out of the main bundle.
 * 2. Capture must never block a feedback submission. Every failure path here
 *    returns `null` and the caller simply submits without an image.
 */

export type ScreenshotResult = {
  blob: Blob;
  width: number;
  height: number;
};

/** Longest edge of the stored image — keeps a 4K screen from producing a 10 MB attachment. */
const MAX_EDGE = 1600;

/** JPEG quality. Screenshots are photographic enough that WebP/JPEG wins over PNG. */
const JPEG_QUALITY = 0.82;

/**
 * Elements marked `data-html2canvas-ignore="true"` are skipped by the capture.
 * The feedback dialog itself carries that attribute, so even a capture taken
 * while it is open will not contain the dialog.
 */
export async function captureScreenshot(): Promise<ScreenshotResult | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  try {
    const { default: html2canvas } = await import("html2canvas-pro");

    const canvas = await html2canvas(document.body, {
      // Rendering at device pixel ratio makes text crisp on HiDPI screens.
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
      logging: false,
      // The page's own background, so a transparent theme doesn't yield a
      // see-through JPEG (which would render as black).
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      scrollX: 0,
      scrollY: -window.scrollY,
    });

    const scaled = downscale(canvas, MAX_EDGE);

    const blob = await new Promise<Blob | null>((resolve) =>
      scaled.toBlob((result) => resolve(result), "image/jpeg", JPEG_QUALITY)
    );

    if (!blob) return null;

    return { blob, width: scaled.width, height: scaled.height };
  } catch (error) {
    // A missing optional dependency, a tainted canvas or an out-of-memory
    // screen all land here — all of them mean "submit without a screenshot".
    console.warn("[feedback] screenshot capture skipped:", error);
    return null;
  }
}

/** Scales a canvas down so its longest edge is at most `maxEdge`. */
function downscale(source: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const longestEdge = Math.max(source.width, source.height);
  if (longestEdge <= maxEdge) return source;

  const ratio = maxEdge / longestEdge;
  const target = document.createElement("canvas");
  target.width = Math.round(source.width * ratio);
  target.height = Math.round(source.height * ratio);

  const ctx = target.getContext("2d");
  if (!ctx) return source;

  ctx.drawImage(source, 0, 0, target.width, target.height);
  return target;
}

/** Turns a captured blob into a `File` so it can go through the normal upload path. */
export function screenshotToFile(screenshot: ScreenshotResult): File {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new File([screenshot.blob], `screenshot-${stamp}.jpg`, { type: "image/jpeg" });
}
