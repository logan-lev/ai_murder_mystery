import { describe, it, expect, vi } from "vitest";
import { formatCountdown, el } from "./dom";
import { renderBoard } from "./board";
import { renderEnd, renderStats } from "./results";
import { generateCase } from "../case/generate";
import { createGameState } from "../game/state";
import { scoreAccusation } from "../game/accuse";

describe("formatCountdown", () => {
    it.each([
        [0, "00:00:00"],
        [-5000, "00:00:00"],
        [59_999, "00:00:59"],
        [3_600_000, "01:00:00"],
        [86_399_000, "23:59:59"],
    ])("%i ms -> %s", (ms, text) => expect(formatCountdown(ms)).toBe(text));
});

describe("el", () => {
    it("sets text, never HTML", () => {
        const node = el("p", "x", "<b>hi</b>");
        expect(node.className).toBe("x");
        expect(node.querySelector("b")).toBeNull();
        expect(node.textContent).toBe("<b>hi</b>");
    });
});

describe("renderBoard", () => {
    const { case: c, truth } = generateCase(1984);

    it("has a dropdown per suspect per time slot, pre-filled from state", () => {
        const s = createGameState(c);
        s.board[c.suspects[0].id][1] = c.sceneRoomID;
        const div = document.createElement("div");
        renderBoard(div, c, s, { deathSlot: null, onPin: () => {} });
        expect(div.querySelectorAll(".pin-select")).toHaveLength(c.suspects.length * 4);
        const pinned = div.querySelector<HTMLSelectElement>(`[data-pin="${c.suspects[0].id}-1"]`)!;
        expect(pinned.value).toBe(c.sceneRoomID);
        expect(pinned.classList.contains("at-scene")).toBe(true);
    });

    it("reports pins and highlights the time of death", () => {
        const onPin = vi.fn();
        const div = document.createElement("div");
        renderBoard(div, c, createGameState(c), { deathSlot: 2, onPin });
        const sel = div.querySelector<HTMLSelectElement>(`[data-pin="${c.suspects[1].id}-0"]`)!;
        sel.value = c.rooms[0].id;
        sel.dispatchEvent(new Event("change"));
        expect(onPin).toHaveBeenCalledWith(c.suspects[1].id, 0, c.rooms[0].id);
        expect(div.querySelector("thead .death-slot")?.textContent).toContain("(death)");
        void truth;
    });
});

describe("renderEnd", () => {
    const { case: c, truth } = generateCase(2718);

    it("shows each proof slot, the right answer when wrong, and the true timeline", () => {
        const s = createGameState(c);
        s.accusation = { suspectID: truth.culpritID, proof: { opportunity: `trace-${truth.culpritID}`, motive: "", means: "body" } };
        s.verdict = scoreAccusation(c, s.accusation);
        const div = document.createElement("div");
        renderEnd(div, c, truth, { mode: "practice", seed: 2718 }, s, s.verdict);
        const text = div.textContent!;
        expect(text).toContain("Lucky Guess");
        expect(text).toContain("Nothing chosen (it was the");
        expect(text).toContain("How you could have cracked it");
        expect(div.querySelectorAll(".timeline tbody tr")).toHaveLength(c.suspects.length);
        expect(div.querySelector(".culprit-row th")?.textContent).toBe(c.suspects.find((x) => x.id === truth.culpritID)!.name);
    });
});

describe("renderStats", () => {
    it("handles a player with no games", () => {
        const div = document.createElement("div");
        renderStats(div, { played: 0, solved: 0, streak: 0, maxStreak: 0, lastPlayedDay: 0, lastSolvedDay: 0, ranks: {} }, 5, false);
        expect(div.textContent).toContain("Played");
        expect(div.textContent).not.toContain("NaN");
        expect(div.querySelector(".countdown")).toBeNull();
    });
});
