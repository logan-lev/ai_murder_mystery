// Everything stored in the browser (localStorage): saved cases, daily stats and streaks, the archive
// history, and small flags. All keys start with "deadorbit:". Every read and write is wrapped so the
// game still works, just without saving, when storage is blocked.

import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import type { Case } from "../case/types";
import type { Accusation, Verdict } from "./accuse";
import { createGameState, type ActionKind, type GameState } from "./state";

// localStorage can be missing or throw (private windows, blocked storage).
// Every access goes through these two helpers so the game still runs, just without saving.
function readJSON<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

function writeJSON(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage full or blocked: skip saving
    }
}

export function readFlag(key: string): boolean {
    return readJSON<boolean>(`deadorbit:${key}`) === true;
}

export function writeFlag(key: string, value: boolean): void {
    writeJSON(`deadorbit:${key}`, value);
}

// ---------- In-progress games ----------

const SAVE_PREFIX = "deadorbit:case:";
const SAVE_VERSION = 3;

// Sets don't survive JSON.stringify, so the saved shape uses arrays
interface SavedGame {
    version: number;
    selectedRoomID: string | null;
    searchedRoomIDs: string[];
    foundClueIDs: string[];
    activeSuspectID: string | null;
    conversations: Record<string, ChatCompletionMessageParam[]>;
    shownClues: Record<string, string[]>;
    actions: ActionKind[];
    accusation: Accusation | null;
    verdict: Verdict | null;
    // Added after version 2 shipped, so older saves may not have them
    board?: Record<string, string[]>;
    attempt?: number;
    tutorialStep?: number;
}

export function saveGame(seed: number, state: GameState): void {
    const shownClues: Record<string, string[]> = {};
    for (const [id, set] of Object.entries(state.shownClues)) shownClues[id] = [...set];

    const saved: SavedGame = {
        version: SAVE_VERSION,
        selectedRoomID: state.selectedRoomID,
        searchedRoomIDs: [...state.searchedRoomIDs],
        foundClueIDs: [...state.foundClueIDs],
        activeSuspectID: state.activeSuspectID,
        conversations: state.conversations,
        shownClues,
        actions: state.actions,
        accusation: state.accusation,
        verdict: state.verdict,
        board: state.board,
        attempt: state.attempt,
        tutorialStep: state.tutorialStep,
    };
    writeJSON(SAVE_PREFIX + seed, saved);
}

// Starts from a fresh state and copies saved data over it, keeping only IDs that exist in this case.
// That way a save from an older version of the generator can't break the game, it just loses some progress.
export function loadGame(seed: number, c: Case): GameState | null {
    const saved = readJSON<SavedGame>(SAVE_PREFIX + seed);
    if (!saved || saved.version !== SAVE_VERSION) return null;

    const state = createGameState(c);
    const roomIDs = new Set(c.rooms.map((r) => r.id));
    const clueIDs = new Set(c.clues.map((cl) => cl.id));

    state.selectedRoomID = saved.selectedRoomID && roomIDs.has(saved.selectedRoomID) ? saved.selectedRoomID : null;
    state.searchedRoomIDs = new Set(saved.searchedRoomIDs.filter((id) => roomIDs.has(id)));
    state.foundClueIDs = new Set(saved.foundClueIDs.filter((id) => clueIDs.has(id)));
    state.actions = saved.actions ?? [];
    state.accusation = saved.accusation;
    state.verdict = saved.verdict;
    state.attempt = saved.attempt ?? 1;
    state.tutorialStep = saved.tutorialStep ?? 0;

    for (const s of c.suspects) {
        const convo = saved.conversations[s.id] ?? [];
        // A question whose reply never finished (page closed mid-reply) is dropped
        while (convo.length > 0 && convo[convo.length - 1].role === "user") convo.pop();
        state.conversations[s.id] = convo;
        state.shownClues[s.id] = new Set((saved.shownClues[s.id] ?? []).filter((id) => clueIDs.has(id)));
        const pins = saved.board?.[s.id];
        if (pins && pins.length === state.board[s.id].length) {
            state.board[s.id] = pins.map((id) => (id === "" || id === "exterior" || roomIDs.has(id) ? id : ""));
        }
    }
    if (saved.activeSuspectID && state.conversations[saved.activeSuspectID]) {
        state.activeSuspectID = saved.activeSuspectID;
    }
    return state;
}

// Keeps storage from growing forever: only the listed cases keep their saves
export function pruneSaves(keepSeeds: number[]): void {
    try {
        const keep = new Set(keepSeeds.map((seed) => SAVE_PREFIX + seed));
        const stale: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(SAVE_PREFIX) && !keep.has(key)) stale.push(key);
        }
        stale.forEach((key) => localStorage.removeItem(key));
    } catch {
        // Storage blocked: nothing to prune
    }
}

// ---------- Daily stats ----------

const STATS_KEY = "deadorbit:stats";

export interface Stats {
    played: number;
    solved: number;
    streak: number;
    maxStreak: number;
    lastPlayedDay: number;
    lastSolvedDay: number;
    ranks: Record<string, number>;
}

function emptyStats(): Stats {
    return { played: 0, solved: 0, streak: 0, maxStreak: 0, lastPlayedDay: 0, lastSolvedDay: 0, ranks: {} };
}

export function loadStats(): Stats {
    return { ...emptyStats(), ...readJSON<Stats>(STATS_KEY) };
}

// A streak counts consecutive days with the right culprit. Skipping a day breaks it.
export function currentStreak(stats: Stats, today: number): number {
    return stats.lastSolvedDay >= today - 1 ? stats.streak : 0;
}

export function recordDailyResult(day: number, verdict: Verdict): Stats {
    const stats = loadStats();
    if (stats.lastPlayedDay >= day) return stats; // already counted

    stats.played++;
    stats.lastPlayedDay = day;
    stats.ranks[verdict.rank] = (stats.ranks[verdict.rank] ?? 0) + 1;

    if (verdict.correctCulprit) {
        stats.solved++;
        stats.streak = stats.lastSolvedDay === day - 1 ? stats.streak + 1 : 1;
        stats.lastSolvedDay = day;
        stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    } else {
        stats.streak = 0;
    }
    writeJSON(STATS_KEY, stats);
    return stats;
}

// Light read of a save for the home page, without generating the case
export function peekSave(seed: number): { turnsUsed: number; verdict: Verdict | null } | null {
    const saved = readJSON<SavedGame>(SAVE_PREFIX + seed);
    if (!saved || saved.version !== SAVE_VERSION) return null;
    return { turnsUsed: saved.actions?.length ?? 0, verdict: saved.verdict };
}

// ---------- Archive history ----------
// One entry per daily case finished on its first attempt, today's or an archive day.
// Separate from Stats: archive plays show up here but never touch streaks.

const HISTORY_KEY = "deadorbit:history";

export interface HistoryEntry {
    rank: string;
    solved: boolean;
}

export function loadHistory(): Record<number, HistoryEntry> {
    return readJSON<Record<number, HistoryEntry>>(HISTORY_KEY) ?? {};
}

export function recordHistory(day: number, verdict: Verdict): void {
    const history = loadHistory();
    if (history[day]) return;
    history[day] = { rank: verdict.rank, solved: verdict.correctCulprit };
    writeJSON(HISTORY_KEY, history);
}

// ---------- Reset ----------

// Everything the game stores is under "deadorbit:" (case saves, stats, archive history, training
// and help flags), so a reset removes exactly those keys and leaves anything else on the site alone.
export function deleteAllProgress(): void {
    try {
        const doomed: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith("deadorbit:")) doomed.push(key);
        }
        doomed.forEach((key) => localStorage.removeItem(key));
    } catch {
        // Storage blocked: nothing was saved, so there's nothing to delete
    }
}
