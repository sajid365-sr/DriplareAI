import { describe, expect, it } from "vitest";

import {
  OTHER_TASK,
  formatLatency,
  formatPercent,
  percentile,
  rate,
  resolveObservabilityTask,
  summarizeFallbacks,
  summarizeLatency,
  taskCameFromLegacyChannel,
  usdToBdt,
} from "@/lib/domain/observability";

describe("resolveObservabilityTask", () => {
  it("prefers the real `task` column when it is present", () => {
    // A new row's `channel` is a genuine channel, so it must never win over a
    // task that was recorded properly.
    expect(resolveObservabilityTask("chat", "facebook")).toBe("chat");
    expect(resolveObservabilityTask("embedding", "auto_train")).toBe("embedding");
  });

  it("reads the task out of the overloaded `channel` on historical rows", () => {
    // ⚠️ These rows really exist: before `task` had its own column, background
    //    work wrote its name into `channel`. Without this fallback all of that
    //    historical spend would show up as "other" and the by-task chart would
    //    be wrong for every month before the migration.
    expect(resolveObservabilityTask(null, "enhance_prompt")).toBe("enhance_prompt");
    expect(resolveObservabilityTask(null, "auto_train")).toBe("auto_train");
    expect(resolveObservabilityTask(null, "compare")).toBe("compare");
    expect(resolveObservabilityTask(undefined, "text_ingest")).toBe("text_ingest");
  });

  it("groups rows whose kind cannot be established at all", () => {
    // `web`, `facebook`, `whatsapp` and `playground` are channels, not tasks, so
    // a row carrying only one of those is genuinely of unknown kind.
    for (const channel of ["facebook", "whatsapp", "instagram", "web", "playground", "quick_setup", ""]) {
      expect(resolveObservabilityTask(null, channel)).toBe(OTHER_TASK);
    }
    expect(resolveObservabilityTask(null, null)).toBe(OTHER_TASK);
    expect(resolveObservabilityTask(null, undefined)).toBe(OTHER_TASK);
  });

  it("flags which rows needed the legacy fallback", () => {
    expect(taskCameFromLegacyChannel(null, "compare")).toBe(true);
    expect(taskCameFromLegacyChannel("chat", "facebook")).toBe(false);
    expect(taskCameFromLegacyChannel(null, "facebook")).toBe(false);
  });

  it("does not mistake an embedding row for an auto-train row in the other direction", () => {
    // `embedding` and `auto_train` share the legacy channel "auto_train". A row
    // with a real task keeps its own name — only a *missing* task falls back.
    expect(resolveObservabilityTask("embedding", "auto_train")).toBe("embedding");
    expect(resolveObservabilityTask("auto_train", "auto_train")).toBe("auto_train");
  });
});

describe("percentile", () => {
  it("returns null for an empty sample, never 0", () => {
    // 0 would render as "instant", which is the opposite of "unmeasured".
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([], 0.95)).toBeNull();
  });

  it("returns the value itself when there is a single measurement", () => {
    expect(percentile([420], 0.5)).toBe(420);
    expect(percentile([420], 0.95)).toBe(420);
  });

  it("interpolates between ranks, the way Postgres' percentile_cont does", () => {
    // 10 values at 10,20,…,100: the median sits between 50 and 60.
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(values, 0.5)).toBe(55);
    // p95 lands between 90 and 100.
    expect(percentile(values, 0.95)).toBeCloseTo(95.5, 5);
  });

  it("does not require the input to be sorted, and does not mutate it", () => {
    const values = [90, 10, 50, 30, 70];
    const before = [...values];

    expect(percentile(values, 0.5)).toBe(50);
    expect(values).toEqual(before);
  });

  it("clamps a rank outside 0–1 instead of indexing out of bounds", () => {
    const values = [5, 10, 15];

    expect(percentile(values, -1)).toBe(5);
    expect(percentile(values, 2)).toBe(15);
  });

  it("reports the tail, which is the only reason to prefer p95 over a mean", () => {
    // Nine fast calls and one terrible one: the mean hides it, p95 does not.
    const values = [100, 100, 100, 100, 100, 100, 100, 100, 100, 9000];

    expect(percentile(values, 0.5)).toBe(100);
    expect(percentile(values, 0.95)).toBeGreaterThan(4000);
  });
});

describe("summarizeLatency", () => {
  it("excludes unmeasured rows and says how many it excluded", () => {
    // Only app-side calls are timed. The 95 unmeasured rows are the real
    // customer replies, and the panel must be able to disclose that.
    const stats = summarizeLatency([100, 200, null, 300, null, undefined], 100);

    expect(stats.sampleCount).toBe(3);
    expect(stats.totalCount).toBe(100);
    expect(stats.coverage).toBeCloseTo(0.03, 5);
    expect(stats.avgMs).toBe(200);
    expect(stats.maxMs).toBe(300);
  });

  it("reports no numbers at all when nothing was measured", () => {
    const stats = summarizeLatency([null, null], 50);

    expect(stats.sampleCount).toBe(0);
    expect(stats.avgMs).toBeNull();
    expect(stats.p50Ms).toBeNull();
    expect(stats.p95Ms).toBeNull();
    expect(stats.maxMs).toBeNull();
  });

  it("treats full coverage as 100%", () => {
    const stats = summarizeLatency([10, 20, 30], 3);

    expect(stats.coverage).toBe(1);
  });

  it("falls back to the sample size when no scope was given", () => {
    // Prevents a caller that forgets the second argument from reporting 0%
    // coverage on a fully measured set.
    const stats = summarizeLatency([10, 20, 30], 0);

    expect(stats.coverage).toBe(1);
  });

  it("ignores non-finite measurements rather than poisoning every statistic", () => {
    const stats = summarizeLatency([100, Number.NaN, Number.POSITIVE_INFINITY, 300], 4);

    expect(stats.sampleCount).toBe(2);
    expect(stats.avgMs).toBe(200);
    expect(stats.maxMs).toBe(300);
  });
});

describe("rate", () => {
  it("returns null rather than 0% when there is no denominator", () => {
    // 0% would claim "this never happens". `null` says "nothing happened at all".
    expect(rate(0, 0)).toEqual({ rate: null, count: 0, total: 0 });
  });

  it("computes an ordinary share", () => {
    expect(rate(25, 100).rate).toBe(0.25);
  });
});

describe("summarizeFallbacks", () => {
  it("expresses fallbacks as a share of all logged calls", () => {
    const stats = summarizeFallbacks(200, 12);

    expect(stats.fallbackCount).toBe(12);
    expect(stats.rate).toBeCloseTo(0.06, 5);
  });

  it("carries the fallback count alongside the rate so both can be shown", () => {
    // A rate without its numerator is not actionable: 6% of 200 calls and 6% of
    // 2 million calls are different problems.
    const stats = summarizeFallbacks(200, 12);

    expect(stats.count).toBe(12);
    expect(stats.total).toBe(200);
  });

  it("is null for a period with no logged calls", () => {
    expect(summarizeFallbacks(0, 0).rate).toBeNull();
  });
});

describe("formatLatency", () => {
  it("returns null for a missing measurement so the caller prints a dash", () => {
    expect(formatLatency(null)).toBeNull();
    expect(formatLatency(undefined)).toBeNull();
    expect(formatLatency(Number.NaN)).toBeNull();
  });

  it("keeps sub-second measurements in milliseconds", () => {
    expect(formatLatency(0)).toBe("0 ms");
    expect(formatLatency(340)).toBe("340 ms");
    expect(formatLatency(999)).toBe("999 ms");
  });

  it("switches to seconds from one second up, where milliseconds stop being readable", () => {
    expect(formatLatency(1000)).toBe("1.00 s");
    expect(formatLatency(1240)).toBe("1.24 s");
    expect(formatLatency(12_500)).toBe("12.50 s");
  });

  it("rounds sub-second values, because a fraction of a millisecond is noise", () => {
    expect(formatLatency(340.4)).toBe("340 ms");
    expect(formatLatency(340.6)).toBe("341 ms");
  });
});

describe("formatPercent", () => {
  it("is null for an undefined share", () => {
    expect(formatPercent(null)).toBeNull();
    expect(formatPercent(undefined)).toBeNull();
  });

  it("renders one decimal place by default", () => {
    expect(formatPercent(0.0642)).toBe("6.4%");
    expect(formatPercent(1)).toBe("100.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("usdToBdt", () => {
  it("converts at the live rate and keeps two decimals", () => {
    expect(usdToBdt(1.2345, 120)).toBe(148.14);
  });

  it("keeps a fraction of a cent from becoming float noise", () => {
    expect(usdToBdt(0.1 + 0.2, 120)).toBe(36);
  });
});
