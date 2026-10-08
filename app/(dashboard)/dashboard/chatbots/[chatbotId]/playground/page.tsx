"use client";

import { useState } from "react";

import { PlaygroundHeader, type PlaygroundMode } from "./_components/playground-header";
import { SingleTest } from "./_components/single-test/single-test";
import { CompareArena } from "./_components/compare-arena/compare-arena";

/**
 * Playground — one desk for testing the bot, two kinds of work.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * | Mode | What happens |
 * |---|---|
 * | **Live Agent Test** | Talk to it the way a customer would — inline, on the stage |
 * | **Compare Arena** | One question, 2–4 models, answers side by side (Pro) |
 *
 * ⚠️ Both modes live on this one page; the routes are not separate. Compare used to
 *    be `/playground/compare`, which meant switching modes changed the route — and
 *    took the chosen models, the running conversation and the scroll position with
 *    it. Now both sit on the same page, so there is nothing to lose.
 *
 * ⚠️ Once Compare Arena has been opened it **stays in the DOM** (merely `hidden`),
 *    so coming back finds the arena as it was left. But it is not mounted before
 *    that first open — otherwise a merchant who only came to talk to the bot would
 *    still pay for the model list and session list requests.
 */
export default function PlaygroundPage() {
  const [mode, setMode] = useState<PlaygroundMode>("single");
  const [arenaVisited, setArenaVisited] = useState(false);

  const handleModeChange = (next: PlaygroundMode) => {
    if (next === "compare") setArenaVisited(true);
    setMode(next);
  };

  return (
    // ⚠️ `pb-24` used to be here to clear the floating support bubbles. Those are
    //    hidden on this page (`FloatingBubbles` returns null on `/playground`), so
    //    the padding was reserving space for nothing but empty scroll — which the
    //    phone-shaped widget below needs more than the page does.
    <div className="space-y-6 pb-6">
      <PlaygroundHeader mode={mode} onModeChange={handleModeChange} />

      {/* Both panels stay mounted at once; the hidden one is only hidden. The mode
          switch's motion is drawn by the header's pill (`layoutId`), so there is no
          separate transition here — two animations at the same moment would fight. */}
      <div className={mode === "single" ? undefined : "hidden"}>
        <SingleTest />
      </div>

      {arenaVisited && (
        <div className={mode === "compare" ? undefined : "hidden"}>
          <CompareArena />
        </div>
      )}
    </div>
  );
}
