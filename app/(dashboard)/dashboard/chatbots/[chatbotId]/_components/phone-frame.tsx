"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Signal, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A phone body around the widget, with a mobile status bar on top.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The merchant is not testing "does the widget work on my desktop" — their customer
 * is on a phone inside Messenger. Showing the widget bare on a big white page hides
 * exactly the constraints that matter: how much of the thread is visible at once, how
 * tall the composer is, and whether the whole thing fits above the keyboard. The frame
 * and the status bar are what make that obvious at a glance.
 *
 * ⚠️ Both hosts use it: the Playground stage and the floating corner panel. They must
 *    look like the same object — the merchant tests on the page and then meets the
 *    widget again in the corner of Setup, and a bare panel there would read as a
 *    second, different widget.
 *
 * The one cue this deliberately does **not** copy is a notch or a home indicator.
 * The screenshots this was built from are Android, and a drawn iPhone notch would be
 * a lie about which device is being previewed.
 */

/**
 * 9:16 — the Playground stage: a handset at its natural proportions.
 *
 * ⚠️ Exported as one string rather than typed into the page: the page and the panel are
 *    the same component seen twice, and a ratio copied into two files is exactly how
 *    they stop being that. (Tailwind still sees the literal `aspect-[9/16]` in this
 *    file, so the class is generated.)
 */
export const PHONE_ASPECT = "aspect-[9/16]";

/**
 * 9:19 — the floating corner panel: the same phone, narrower and taller.
 *
 * ⚠️ Deliberately not the stage's ratio. That panel floats **over** a page the merchant
 *    is working on, so everything it covers is work they cannot see; the Playground
 *    stage covers nothing, because it is the page. Same object, sized for two different
 *    jobs.
 */
export const PHONE_ASPECT_FLOATING = "aspect-[9/19]";

/**
 * The clock, as seen by `useSyncExternalStore`.
 *
 * ⚠️ `getSnapshot` must return the **same** value for every call within one render
 *    pass, or React re-renders forever. So the minute string is the snapshot, not the
 *    `Date` — a new object every call would never compare equal. And because the
 *    server has no idea what time it is on the visitor's machine, the server snapshot
 *    is `null`: the first paint simply leaves the clock empty.
 */
function readClock() {
  const now = new Date();
  return `${now.getHours()}:${now.getMinutes()}`;
}

function subscribeToClock(onStoreChange: () => void) {
  // 20s, though the snapshot only changes once a minute — this is just a cheap
  // wake-up, and it keeps the clock correct if the tab was asleep past the boundary.
  const id = setInterval(onStoreChange, 20_000);
  return () => clearInterval(id);
}

/** `"19:4"` → `"7:04"` — a bare clock, the way a phone status bar shows it. */
function formatClock(snapshot: string) {
  const [hours, minutes] = snapshot.split(":").map(Number);
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")}`;
}

/** Battery with a drawn outline and level — an icon font's version never looks right. */
function BatteryIndicator() {
  return (
    <span aria-hidden className="flex items-center gap-[1px]">
      <span className="relative flex h-[10px] w-[20px] items-center rounded-[3px] border border-foreground/50 p-[1.5px]">
        <span className="h-full w-[72%] rounded-[1.5px] bg-foreground" />
      </span>
      {/* The nub on the right of a battery outline. */}
      <span className="h-[4px] w-[1.5px] rounded-r-[1px] bg-foreground/50" />
    </span>
  );
}

function StatusBar() {
  const clock = useSyncExternalStore(subscribeToClock, readClock, () => null);

  return (
    // Purely decorative chrome — a screen reader announcing "7:04, signal, wifi"
    // before the conversation would only be noise.
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-between px-5 pt-2.5 pb-1.5 text-[11px] font-semibold text-foreground"
    >
      {/* The em dashes hold the clock's width before hydration, so the row does not
          jump when the real time appears. */}
      <span className="tabular-nums tracking-tight">{clock ? formatClock(clock) : "--:--"}</span>
      <span className="flex items-center gap-1.5">
        <Signal className="h-3 w-3" />
        <Wifi className="h-3 w-3" />
        <BatteryIndicator />
      </span>
    </div>
  );
}

export function PhoneFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    // Bezel radius minus border width equals the screen radius, so the two curves
    // stay concentric — the one detail that separates "a phone" from "a box".
    <div
      className={cn("rounded-[2.5rem] border-[8px] border-device-bezel shadow-2xl", className)}
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[2rem] bg-messenger-canvas">
        <StatusBar />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
