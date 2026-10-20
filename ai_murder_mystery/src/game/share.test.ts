import { describe, it, expect } from "vitest";
import { generateCase } from "../case/generate";
import { createGameState } from "./state";
import { buildShareText } from "./share";
import type { Verdict } from "./accuse";

const { case: c } = generateCase(2718);
const verdict: Verdict = {
    correctCulprit: true,
    correctProof: { opportunity: true, motive: false, means: true },
    rank: "Sharp Inspector",
    explanation: "",
};

describe("buildShareText", () => {
    it("is spoiler-free: no names, rooms, or clues", () => {
        const s = createGameState(c);
        s.actions = ["search-hit", "question", "show", "search-miss"];
        const text = buildShareText({ mode: "daily", day: 7, seed: 1, isToday: true }, s, verdict);
        for (const sus of c.suspects) expect(text).not.toContain(sus.name);
        for (const room of c.rooms) expect(text).not.toContain(room.name);
        for (const cl of c.clues) expect(text).not.toContain(cl.name);
        expect(text).toContain("Dead Orbit Daily #7");
        expect(text).toContain("🔎 Sharp Inspector");
        expect(text).toContain("Killer ✅ Means ✅ Motive ❌ Opportunity ✅");
        expect(text).toContain("🔦💬🧾⬛");
        expect(text).toContain("4/20 turns");
    });

    it("wraps the action grid every 8 turns", () => {
        const s = createGameState(c);
        s.actions = Array(19).fill("question");
        const rows = buildShareText({ mode: "practice", seed: 5 }, s, verdict)
            .split("\n")
            .filter((l) => l.startsWith("💬"));
        expect(rows.map((r) => [...r].length)).toEqual([8, 8, 3]);
    });

    it("labels retries", () => {
        const s = createGameState(c);
        s.attempt = 3;
        expect(buildShareText({ mode: "daily", day: 7, seed: 1, isToday: true }, s, verdict)).toContain(
            "Daily #7 (retry 2)",
        );
    });
});
