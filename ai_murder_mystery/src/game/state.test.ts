import { describe, it, expect } from "vitest";
import { generateCase } from "../case/generate";
import { createGameState, turnsLeft, isOver, searchRoom, showClue, buildMessages, TURN_LIMIT } from "./state";
import { scoreAccusation, RANKS, PROOF_SLOTS } from "./accuse";

const { case: c, truth } = generateCase(2024);
const culprit = truth.culpritID;
const innocent = c.suspects.find((s) => s.id !== culprit)!.id;
const right = c.solution.proof;

describe("turns and searching", () => {
    it("starts with every turn available and nothing found", () => {
        const s = createGameState(c);
        expect(turnsLeft(s)).toBe(TURN_LIMIT);
        expect(isOver(s)).toBe(false);
        expect(s.foundClueIDs.size).toBe(0);
        expect(Object.keys(s.board)).toEqual(c.suspects.map((x) => x.id));
        expect(s.attempt).toBe(1);
    });

    it("searching finds the room's clues and uses one turn", () => {
        const s = createGameState(c);
        const found = searchRoom(s, c, c.sceneRoomID);
        expect(found.map((cl) => cl.id).sort()).toEqual(
            c.clues
                .filter((cl) => cl.roomID === c.sceneRoomID)
                .map((cl) => cl.id)
                .sort(),
        );
        expect(found.map((cl) => cl.id)).toContain("body");
        expect(s.actions).toEqual(["search-hit"]);
        expect(turnsLeft(s)).toBe(TURN_LIMIT - 1);
    });

    it("records an empty search as a miss", () => {
        const s = createGameState(c);
        const empty = c.rooms.find((r) => !c.clues.some((cl) => cl.roomID === r.id))!;
        expect(searchRoom(s, c, empty.id)).toEqual([]);
        expect(s.actions).toEqual(["search-miss"]);
    });

    it("never charges twice for the same room", () => {
        const s = createGameState(c);
        searchRoom(s, c, c.sceneRoomID);
        expect(searchRoom(s, c, c.sceneRoomID)).toEqual([]);
        expect(s.actions).toHaveLength(1);
    });

    it("never goes below zero turns", () => {
        const s = createGameState(c);
        s.actions = Array(TURN_LIMIT + 5).fill("question");
        expect(turnsLeft(s)).toBe(0);
    });
});

describe("showClue", () => {
    it("only shows evidence the player has found, once per suspect", () => {
        const s = createGameState(c);
        expect(showClue(s, innocent, "body")).toBe(false);
        searchRoom(s, c, c.sceneRoomID);
        expect(showClue(s, innocent, "body")).toBe(true);
        expect(showClue(s, innocent, "body")).toBe(false);
        expect(showClue(s, culprit, "body")).toBe(true);
    });

    it("rejects unknown suspects", () => {
        const s = createGameState(c);
        searchRoom(s, c, c.sceneRoomID);
        expect(showClue(s, "nobody", "body")).toBe(false);
    });
});

describe("buildMessages", () => {
    it("rebuilds the system prompt from shown evidence each turn", () => {
        const s = createGameState(c);
        searchRoom(s, c, c.sceneRoomID);
        expect(buildMessages(s, c, culprit)[0].content).not.toContain("is yours");
        showClue(s, culprit, `trace-${culprit}`);
        expect(buildMessages(s, c, culprit)[0].content).toContain("is yours");
    });

    it("keeps the system prompt and only the most recent messages", () => {
        const s = createGameState(c);
        for (let i = 0; i < 20; i++)
            s.conversations[innocent].push({ role: i % 2 ? "assistant" : "user", content: `m${i}` });
        const msgs = buildMessages(s, c, innocent);
        expect(msgs[0].role).toBe("system");
        expect(msgs).toHaveLength(9);
        expect(msgs[msgs.length - 1].content).toBe("m19");
    });

    it("adds a bluff reminder based on the latest question", () => {
        const s = createGameState(c);
        s.conversations[innocent].push({ role: "user", content: "We found your fingerprints on the weapon." });
        expect(buildMessages(s, c, innocent)[0].content).toContain("RIGHT NOW:");
    });

    it("marks the first question as a first meeting", () => {
        const s = createGameState(c);
        s.conversations[innocent].push({ role: "user", content: "Hello?" });
        expect(buildMessages(s, c, innocent)[0].content).toContain("first time the investigator");
    });

    it("throws for an unknown suspect", () => {
        expect(() => buildMessages(createGameState(c), c, "nobody")).toThrow();
    });
});

describe("scoreAccusation", () => {
    const wrong = c.clues.find((cl) => cl.id === "body")!.id;
    it.each([
        [culprit, right, "Master Investigator"],
        [culprit, { ...right, means: "" }, "Sharp Inspector"],
        [culprit, { ...right, motive: wrong, means: wrong }, "Lucky Guess"],
        [culprit, { opportunity: "", motive: "", means: "" }, "Lucky Guess"],
        [innocent, right, "Case Unsolved"],
    ] as const)("%s with %j is %s", (suspectID, proof, rank) => {
        const v = scoreAccusation(c, { suspectID, proof: { ...proof } });
        expect(v.rank).toBe(rank);
        expect(RANKS).toContain(v.rank);
    });

    it("marks each proof slot independently", () => {
        const v = scoreAccusation(c, { suspectID: culprit, proof: { ...right, motive: "body" } });
        expect(v.correctProof).toEqual({ opportunity: true, motive: false, means: true });
    });

    it("never counts the body as proof", () => {
        for (const slot of PROOF_SLOTS) expect(right[slot.key]).not.toBe("body");
    });
});
