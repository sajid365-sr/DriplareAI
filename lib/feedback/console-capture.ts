"use client";

/**
 * Recent console-error capture.
 * ─────────────────────────────────────────────────────────────────────────────
 * When a merchant reports "it just broke", the actual error message is the one
 * thing that would let an admin identify the cause without a round trip. This
 * keeps a small ring buffer of what the browser console has already logged.
 *
 * Deliberately narrow: only `console.error`, uncaught errors and unhandled
 * rejections, only the last few, and every entry is truncated. Nothing is sent
 * anywhere until the merchant submits feedback.
 */

/** How many entries are kept. Enough for context, small enough to read. */
const MAX_ENTRIES = 5;

/** Entries are truncated here, so a giant serialized object can't blow up the payload. */
const MAX_LENGTH = 500;

const buffer: string[] = [];
let installed = false;

/** Serializes one console argument into something short and readable. */
function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function push(entry: string): void {
  const trimmed = entry.trim().slice(0, MAX_LENGTH);
  if (!trimmed) return;

  buffer.push(trimmed);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

/**
 * Starts recording. Safe to call from every dashboard mount — repeated calls
 * are ignored, so `console.error` is never wrapped twice.
 */
export function installConsoleCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    try {
      push(args.map(stringify).join(" "));
    } catch {
      // Never let the recorder break the call it is recording.
    }
    originalError(...args);
  };

  window.addEventListener("error", (event) => {
    push(`Uncaught ${stringify(event.error ?? event.message)}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    push(`Unhandled rejection: ${stringify(event.reason)}`);
  });
}

/** The captured entries, oldest first. Returns a copy so callers can't mutate the buffer. */
export function getRecentConsoleErrors(): string[] {
  return [...buffer];
}

/** Forgets everything recorded so far — used after a successful submission. */
export function clearConsoleErrors(): void {
  buffer.length = 0;
}
