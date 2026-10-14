import { mulberry32 } from "./case/random";

const MAX_SEED = 99999;
const DAY_MS = 86_400_000;

// Daily #1. Changing this renumbers every daily case, so leave it alone once the game is public.
const LAUNCH_DAY = Date.UTC(2026, 9, 13);

export type CaseInfo =
    // isToday: only today's case counts toward streaks; older days are the archive
    | { mode: "daily"; day: number; seed: number; isToday: boolean }
    | { mode: "practice"; seed: number }
    | { mode: "tutorial"; seed: 0 };

// Days are counted in the player's local time zone, like Wordle: the new case arrives at their midnight.
// Using Date.UTC on the local calendar date sidesteps daylight-saving days that are 23 or 25 hours long.
export function dayNumber(now = new Date()): number {
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((today - LAUNCH_DAY) / DAY_MS) + 1;
}

// The seed is a hash of the day number rather than the number itself,
// so players can't jump ahead to tomorrow's case with ?case=N+1.
export function dailySeed(day: number): number {
    return Math.floor(mulberry32(day * 7919 + 0x5eed)() * MAX_SEED) + 1;
}

export function randomSeed(): number {
    return Math.floor(Math.random() * MAX_SEED) + 1;
}

// No parameters is the home page. ?day=N plays daily case N (today or the archive, never the future).
// ?case=N is a practice case that doesn't count toward stats.
// ?tutorial is the hand-built training case (saved under seed 0, which no real case uses).
export function isHomeRoute(): boolean {
    const params = new URLSearchParams(window.location.search);
    return !params.has("tutorial") && !params.has("case") && !params.has("day");
}

export function getCaseInfo(): CaseInfo {
    const params = new URLSearchParams(window.location.search);
    if (params.has("tutorial")) return { mode: "tutorial", seed: 0 };
    const fromURL = Number(params.get("case"));
    if (Number.isInteger(fromURL) && fromURL > 0 && fromURL <= MAX_SEED) {
        return { mode: "practice", seed: fromURL };
    }
    const today = dayNumber();
    const asked = Number(params.get("day"));
    const day = Number.isInteger(asked) && asked >= 1 && asked <= today ? asked : today;
    return { mode: "daily", day, seed: dailySeed(day), isToday: day === today };
}

export function dailyURL(day: number): string {
    return `${window.location.pathname}?day=${day}`;
}

export function homeURL(): string {
    return window.location.pathname;
}

// The calendar date a daily case belongs to, e.g. "Oct 13"
export function dayDate(day: number): string {
    return new Date(LAUNCH_DAY + (day - 1) * DAY_MS).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function caseLabel(info: CaseInfo): string {
    if (info.mode === "tutorial") return "Training";
    return info.mode === "daily" ? `Daily #${info.day}` : `Practice #${info.seed}`;
}

export function caseURL(info: CaseInfo): string {
    const base = `${window.location.origin}${window.location.pathname}`;
    if (info.mode === "tutorial") return `${base}?tutorial`;
    // Today's result links to the home page; an archive result links to that day's case
    if (info.mode === "daily") return info.isToday ? base : `${base}?day=${info.day}`;
    return `${base}?case=${info.seed}`;
}

export function practiceURL(seed = randomSeed()): string {
    return `${window.location.pathname}?case=${seed}`;
}

export function tutorialURL(): string {
    return `${window.location.pathname}?tutorial`;
}

export function msUntilNextDay(now = new Date()): number {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return midnight.getTime() - now.getTime();
}
