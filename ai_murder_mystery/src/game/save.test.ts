import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateCase } from "../case/generate";
import { createGameState, searchRoom, showClue } from "./state";
import {
    saveGame, loadGame, pruneSaves, peekSave, loadStats, recordDailyResult, currentStreak,
    loadHistory, recordHistory, deleteAllProgress, readFlag, writeFlag,
} from "./save";
import type { Verdict } from "./accuse";

const { case: c, truth } = generateCase(31337);
const solved: Verdict = { correctCulprit: true, correctProof: { opportunity: true, motive: true, means: true }, rank: "Master Investigator", explanation: "" };
const missed: Verdict = { correctCulprit: false, correctProof: { opportunity: false, motive: false, means: false }, rank: "Case Unsolved", explanation: "" };

beforeEach(() => localStorage.clear());

describe("saving and loading a case", () => {
    it("round-trips everything the player did", () => {
        const s = createGameState(c);
        searchRoom(s, c, c.sceneRoomID);
        showClue(s, truth.culpritID, "body");
        s.conversations[truth.culpritID].push({ role: "user", content: "Hi" }, { role: "assistant", content: "Hello." });
        s.board[truth.culpritID][0] = c.sceneRoomID;
        s.activeSuspectID = truth.culpritID;
        s.attempt = 2;
        s.tutorialStep = 5;
        saveGame(31337, s);

        const loaded = loadGame(31337, c)!;
        expect([...loaded.foundClueIDs].sort()).toEqual([...s.foundClueIDs].sort());
        expect([...loaded.shownClues[truth.culpritID]]).toEqual(["body"]);
        expect(loaded.conversations[truth.culpritID]).toHaveLength(2);
        expect(loaded.board[truth.culpritID][0]).toBe(c.sceneRoomID);
        expect(loaded.actions).toEqual(["search-hit"]);
        expect(loaded.activeSuspectID).toBe(truth.culpritID);
        expect(loaded.attempt).toBe(2);
        expect(loaded.tutorialStep).toBe(5);
    });

    it("drops a question whose reply never arrived", () => {
        const s = createGameState(c);
        s.conversations[truth.culpritID].push({ role: "user", content: "Hi" }, { role: "assistant", content: "Hello." }, { role: "user", content: "Unanswered" });
        saveGame(31337, s);
        expect(loadGame(31337, c)!.conversations[truth.culpritID].map((m) => m.content)).toEqual(["Hi", "Hello."]);
    });

    it("discards IDs that don't exist in this case", () => {
        const s = createGameState(c);
        saveGame(31337, s);
        const raw = JSON.parse(localStorage.getItem("deadorbit:case:31337")!);
        raw.foundClueIDs = ["body", "not-a-clue"];
        raw.searchedRoomIDs = ["no-such-room"];
        raw.board[truth.culpritID] = ["no-such-room", "", "", ""];
        raw.activeSuspectID = "ghost";
        localStorage.setItem("deadorbit:case:31337", JSON.stringify(raw));
        const loaded = loadGame(31337, c)!;
        expect([...loaded.foundClueIDs]).toEqual(["body"]);
        expect(loaded.searchedRoomIDs.size).toBe(0);
        expect(loaded.board[truth.culpritID][0]).toBe("");
        expect(loaded.activeSuspectID).toBeNull();
    });

    it("ignores saves from another version, and garbage", () => {
        localStorage.setItem("deadorbit:case:31337", JSON.stringify({ version: 1 }));
        expect(loadGame(31337, c)).toBeNull();
        localStorage.setItem("deadorbit:case:31337", "{not json");
        expect(loadGame(31337, c)).toBeNull();
        expect(loadGame(424242, c)).toBeNull();
    });

    it("peeks at a save without generating the case", () => {
        const s = createGameState(c);
        s.actions = ["question", "show"];
        saveGame(31337, s);
        expect(peekSave(31337)).toEqual({ turnsUsed: 2, verdict: null });
        expect(peekSave(1)).toBeNull();
    });

    it("prunes all saves except the ones to keep", () => {
        for (const seed of [1, 2, 3]) saveGame(seed, createGameState(c));
        localStorage.setItem("deadorbit:stats", "{}");
        pruneSaves([2]);
        expect(localStorage.getItem("deadorbit:case:1")).toBeNull();
        expect(localStorage.getItem("deadorbit:case:2")).not.toBeNull();
        expect(localStorage.getItem("deadorbit:stats")).not.toBeNull();
    });
});

describe("daily stats and streaks", () => {
    it("counts a solve and starts a streak", () => {
        const s = recordDailyResult(5, solved);
        expect(s).toMatchObject({ played: 1, solved: 1, streak: 1, maxStreak: 1, lastPlayedDay: 5, lastSolvedDay: 5 });
        expect(s.ranks["Master Investigator"]).toBe(1);
    });

    it("extends a streak on consecutive days", () => {
        recordDailyResult(5, solved);
        recordDailyResult(6, solved);
        expect(recordDailyResult(7, solved)).toMatchObject({ streak: 3, maxStreak: 3 });
    });

    it("restarts the streak after a skipped day, but keeps the best", () => {
        recordDailyResult(5, solved);
        recordDailyResult(6, solved);
        expect(recordDailyResult(9, solved)).toMatchObject({ streak: 1, maxStreak: 2 });
    });

    it("breaks the streak on a wrong accusation", () => {
        recordDailyResult(5, solved);
        expect(recordDailyResult(6, missed)).toMatchObject({ played: 2, solved: 1, streak: 0, maxStreak: 1 });
    });

    it("never counts the same day twice", () => {
        recordDailyResult(5, solved);
        expect(recordDailyResult(5, missed)).toMatchObject({ played: 1, solved: 1 });
    });

    it("shows a streak as broken if yesterday was missed", () => {
        const s = recordDailyResult(5, solved);
        expect(currentStreak(s, 6)).toBe(1);
        expect(currentStreak(s, 7)).toBe(0);
    });

    it("survives corrupted stats", () => {
        localStorage.setItem("deadorbit:stats", "garbage");
        expect(loadStats().played).toBe(0);
    });
});

describe("archive history", () => {
    it("records the first result per day only", () => {
        recordHistory(3, solved);
        recordHistory(3, missed);
        expect(loadHistory()[3]).toEqual({ rank: "Master Investigator", solved: true });
    });
});

describe("deleteAllProgress", () => {
    it("removes all progress but leaves other sites' keys alone", () => {
        saveGame(1, createGameState(c));
        recordDailyResult(1, solved);
        recordHistory(1, solved);
        writeFlag("training-done", true);
        writeFlag("seen-help", true);
        localStorage.setItem("other-app", "x");
        deleteAllProgress();
        expect(Object.keys(localStorage)).toEqual(["other-app"]);
        expect(readFlag("training-done")).toBe(false);
        expect(loadStats().played).toBe(0);
    });
});

describe("when storage is blocked (private browsing, disabled cookies)", () => {
    it("every save function degrades quietly instead of crashing", () => {
        const boom = () => {
            throw new DOMException("blocked", "SecurityError");
        };
        vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom, key: boom, clear: boom, get length(): number { return boom(); } });
        try {
            expect(() => saveGame(1, createGameState(c))).not.toThrow();
            expect(loadGame(1, c)).toBeNull();
            expect(peekSave(1)).toBeNull();
            expect(() => pruneSaves([1])).not.toThrow();
            expect(loadStats().played).toBe(0);
            expect(() => recordDailyResult(1, solved)).not.toThrow();
            expect(() => recordHistory(1, solved)).not.toThrow();
            expect(loadHistory()).toEqual({});
            expect(readFlag("seen-help")).toBe(false);
            expect(() => writeFlag("seen-help", true)).not.toThrow();
            expect(() => deleteAllProgress()).not.toThrow();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
