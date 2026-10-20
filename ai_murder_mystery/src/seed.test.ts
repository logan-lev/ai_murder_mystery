import { describe, it, expect, afterEach, vi } from "vitest";
import { dayNumber, dailySeed, getCaseInfo, isHomeRoute, caseLabel, caseURL, dayDate, msUntilNextDay, randomSeed } from "./seed";

const visit = (search: string) => history.replaceState(null, "", `/${search}`);
afterEach(() => {
    visit("");
    vi.useRealTimers();
});

describe("dayNumber", () => {
    it("is 1 on launch day and counts local calendar days", () => {
        expect(dayNumber(new Date(2026, 9, 13, 0, 1))).toBe(1);
        expect(dayNumber(new Date(2026, 9, 13, 23, 59))).toBe(1);
        expect(dayNumber(new Date(2026, 9, 14, 0, 0))).toBe(2);
        expect(dayNumber(new Date(2026, 9, 20, 12))).toBe(8);
    });

    it("isn't thrown off by daylight-saving changes", () => {
        // US clocks change on Nov 1 2026 and Mar 14 2027; every day still advances by exactly one
        let prev = dayNumber(new Date(2026, 9, 30, 12));
        for (let d = 31; d < 31 + 160; d++) {
            const n = dayNumber(new Date(2026, 9, d, 12));
            expect(n).toBe(prev + 1);
            prev = n;
        }
    });
});

describe("dailySeed", () => {
    it("is deterministic, in range, and not just the day number", () => {
        for (let day = 1; day < 400; day++) {
            const s = dailySeed(day);
            expect(s).toBe(dailySeed(day));
            expect(s).toBeGreaterThanOrEqual(1);
            expect(s).toBeLessThanOrEqual(99999);
            expect(Number.isInteger(s)).toBe(true);
        }
        expect(dailySeed(2)).not.toBe(dailySeed(1) + 1);
    });

    it("rarely repeats across a year", () => {
        const seeds = new Set(Array.from({ length: 365 }, (_, i) => dailySeed(i + 1)));
        expect(seeds.size).toBeGreaterThan(360);
    });

    it("random practice seeds are in range", () => {
        for (let i = 0; i < 200; i++) expect(randomSeed()).toBeGreaterThanOrEqual(1);
    });
});

describe("routes", () => {
    it("treats no parameters as the home page", () => {
        visit("");
        expect(isHomeRoute()).toBe(true);
        visit("?day=1");
        expect(isHomeRoute()).toBe(false);
        visit("?tutorial");
        expect(isHomeRoute()).toBe(false);
    });

    it("reads practice, training, and daily cases", () => {
        visit("?case=31337");
        expect(getCaseInfo()).toEqual({ mode: "practice", seed: 31337 });
        visit("?tutorial");
        expect(getCaseInfo()).toEqual({ mode: "tutorial", seed: 0 });
    });

    it("never opens a future daily, and treats junk as today", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 20, 12));
        for (const search of ["?day=999", "?day=-4", "?day=abc", "?day=2.5", "?day="]) {
            visit(search);
            expect(getCaseInfo()).toMatchObject({ mode: "daily", day: 8, isToday: true });
        }
        visit("?day=3");
        expect(getCaseInfo()).toMatchObject({ mode: "daily", day: 3, isToday: false, seed: dailySeed(3) });
    });

    it("rejects out-of-range practice seeds", () => {
        for (const search of ["?case=0", "?case=-1", "?case=100000", "?case=1e3x"]) {
            visit(search);
            expect(getCaseInfo().mode).toBe("daily");
        }
    });

    it("labels and links cases", () => {
        expect(caseLabel({ mode: "tutorial", seed: 0 })).toBe("Training");
        expect(caseLabel({ mode: "practice", seed: 9 })).toBe("Practice #9");
        expect(caseLabel({ mode: "daily", day: 4, seed: 1, isToday: true })).toBe("Daily #4");
        visit("");
        expect(caseURL({ mode: "daily", day: 4, seed: 1, isToday: true })).toMatch(/\/$/);
        expect(caseURL({ mode: "daily", day: 4, seed: 1, isToday: false })).toMatch(/\?day=4$/);
        expect(caseURL({ mode: "practice", seed: 9 })).toMatch(/\?case=9$/);
    });

    it("dates each daily case", () => {
        expect(dayDate(1)).toMatch(/13/);
        expect(dayDate(2)).toMatch(/14/);
    });

    it("counts down to local midnight", () => {
        const ms = msUntilNextDay(new Date(2026, 9, 20, 23, 0, 0));
        expect(ms).toBe(60 * 60 * 1000);
    });
});
