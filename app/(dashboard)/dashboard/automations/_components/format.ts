/**
 * Date formatting shared by the Automations surfaces.
 *
 * Both the rule cards and the activity log need to say *when* something
 * happened, and they must say it the same way — two formatters would drift into
 * "2 hours ago" on one screen and "2 ঘন্টা আগে" on the next.
 */

/**
 * "2 hours ago" without pulling in a date library.
 *
 * `Intl.RelativeTimeFormat` does the work and, more importantly, picks the
 * right Bangla wording on its own — a hand-written `isBn ? "…আগে" : "…ago"`
 * would be wrong for every unit but the one it was written for.
 */
export function relativeTime(iso: string, isBn: boolean): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const seconds = Math.round((then - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(isBn ? "bn" : "en", { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return formatter.format(seconds, "second");
}

/**
 * "8 Oct, 14:32" — the exact moment, for the title attribute of a relative
 * timestamp.
 *
 * A log is read to answer "when exactly did this happen", and a relative label
 * alone cannot do that: three rows can all say "2 hours ago" while being forty
 * minutes apart.
 */
export function absoluteTime(iso: string, isBn: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat(isBn ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
