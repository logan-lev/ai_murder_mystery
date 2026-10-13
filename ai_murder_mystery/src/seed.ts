import { mulberry32 } from "./case/random";

const MAX_SEED = 99999;
const DAY_MS = 86_400_000;

// Daily #1. Changing this renumbers every daily case, so leave it alone once the game is public.
const LAUNCH_DAY = Date.UTC(2026, 9, 13);

export type CaseInfo =
    | { mode: "daily"; day: number; seed: number }
    | { mode: "practice"; seed: number };

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

// No ?case means today's daily case. ?case=N is a practice case that doesn't count toward stats.
export function getCaseInfo(): CaseInfo {
    const fromURL = Number(new URLSearchParams(window.location.search).get("case"));
    if (Number.isInteger(fromURL) && fromURL > 0 && fromURL <= MAX_SEED) {
        return { mode: "practice", seed: fromURL };
    }
    const day = dayNumber();
    return { mode: "daily", day, seed: dailySeed(day) };
}

export function caseLabel(info: CaseInfo): string {
    return info.mode === "daily" ? `Daily #${info.day}` : `Practice #${info.seed}`;
}

export function caseURL(info: CaseInfo): string {
    const base = `${window.location.origin}${window.location.pathname}`;
    return info.mode === "daily" ? base : `${base}?case=${info.seed}`;
}

export function practiceURL(seed = randomSeed()): string {
    return `${window.location.pathname}?case=${seed}`;
}

export function msUntilNextDay(now = new Date()): number {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return midnight.getTime() - now.getTime();
}
