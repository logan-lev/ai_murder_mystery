import { describe, it, expect } from "vitest";
import { TUTORIAL_CASE, TUTORIAL_TRUTH, QUESTIONS, SHOWS, isAsked } from "./case";
import { STEPS } from "./coach";
import { validateCase } from "../case/validate";
import { createGameState } from "../game/state";
import { SLOTS } from "../case/content";

// The training case is hand-written, so nothing generates it consistently. These tests are the
// safety net: every scripted question, clue, room, and coach step must refer to something real.
const c = TUTORIAL_CASE;
const clueIDs = new Set(c.clues.map((cl) => cl.id));
const roomIDs = new Set(c.rooms.map((r) => r.id));
const suspectIDs = new Set(c.suspects.map((s) => s.id));
const questionIDs = new Set(Object.values(QUESTIONS).flat().map((q) => q.id));

describe("training case data", () => {
    it("is a valid case", () => {
        expect(validateCase(c)).toEqual([]);
    });

    it("has a timeline for every suspect, in real rooms", () => {
        for (const id of suspectIDs) {
            expect(TUTORIAL_TRUTH.timeline[id]).toHaveLength(SLOTS.length);
            for (const r of TUTORIAL_TRUTH.timeline[id]) expect(roomIDs.has(r)).toBe(true);
        }
        expect(TUTORIAL_TRUTH.timeline[TUTORIAL_TRUTH.culpritID][SLOTS.indexOf(TUTORIAL_TRUTH.murderTime)]).toBe(c.sceneRoomID);
    });

    it("only scripts questions and shows for real suspects, clues, and questions", () => {
        for (const [sid, list] of Object.entries(QUESTIONS)) {
            expect(suspectIDs.has(sid)).toBe(true);
            for (const q of list) {
                for (const cl of q.afterShown ?? []) expect(clueIDs.has(cl)).toBe(true);
                for (const qid of q.afterAsked ?? []) expect(questionIDs.has(qid)).toBe(true);
            }
        }
        for (const [sid, list] of Object.entries(SHOWS)) {
            expect(suspectIDs.has(sid)).toBe(true);
            for (const sh of list) {
                expect(clueIDs.has(sh.clueID)).toBe(true);
                for (const cl of sh.afterShown ?? []) expect(clueIDs.has(cl)).toBe(true);
            }
        }
    });

    it("has unique question IDs, and unique texts per suspect", () => {
        const all = Object.values(QUESTIONS).flat();
        expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
        // Different suspects can be asked the same thing; isAsked checks within that suspect's conversation
        for (const list of Object.values(QUESTIONS)) expect(new Set(list.map((q) => q.text)).size).toBe(list.length);
    });

    it("never refers to the victim as just 'her' in a scripted answer", () => {
        for (const q of Object.values(QUESTIONS).flat()) expect(q.answer).not.toMatch(/found her\b|kill her\b|left her\b/);
    });

    it("puts the proof clues where the coach sends the player", () => {
        const proof = c.solution.proof;
        expect(c.clues.find((cl) => cl.id === proof.opportunity)?.roomID).toBe("hydroponics");
        expect(c.clues.find((cl) => cl.id === proof.motive)?.roomID).toBe("nair-cabin");
        expect(c.clues.find((cl) => cl.id === proof.means)?.roomID).toBe("cargo-bay");
    });
});

describe("coach steps", () => {
    it("every step has a plain explanation and, except the last, one thing to do", () => {
        STEPS.forEach((step, i) => {
            expect(step.text.length).toBeGreaterThan(10);
            if (i < STEPS.length - 1) expect(step.todo, `step ${i + 1}`).toBeTruthy();
        });
    });

    it("never says a turn 'costs' anything", () => {
        for (const step of STEPS) expect(`${step.text} ${step.todo ?? ""}`).not.toMatch(/\bcosts?\b/i);
    });

    it("only allows controls that exist in the training case", () => {
        for (const step of STEPS) {
            for (const sel of step.allow ?? []) {
                for (const [, q] of sel.matchAll(/data-q="([^"]+)"/g)) expect(questionIDs.has(q), sel).toBe(true);
                for (const [, cl] of sel.matchAll(/data-clue="([^"]+)"/g)) expect(clueIDs.has(cl), sel).toBe(true);
                for (const [, r] of sel.matchAll(/data-room="([^"]+)"/g)) expect(roomIDs.has(r), sel).toBe(true);
                for (const [, s] of sel.matchAll(/data-for="([^"]+)"/g)) expect(suspectIDs.has(s), sel).toBe(true);
                for (const [, p] of sel.matchAll(/data-pin="([a-z]+)-(\d)"/g)) expect(suspectIDs.has(p), sel).toBe(true);
            }
            for (const sel of step.target ?? []) {
                for (const [, t] of sel.matchAll(/data-tab="([^"]+)"/g)) expect(["station", "evidence", "timeline", ...suspectIDs].includes(t), sel).toBe(true);
            }
        }
    });

    it("can be completed: each check-based step becomes true by doing its allowed action", () => {
        const state = createGameState(c);
        const ctx = { state, boardOpen: false, save: () => {} };
        for (const step of STEPS) {
            if (!step.done) continue;
            // Simulate the step's allowed action directly on the state
            for (const sel of step.allow ?? []) {
                const q = sel.match(/data-q="([^"]+)"/)?.[1];
                if (q) {
                    const [sid, list] = Object.entries(QUESTIONS).find(([, l]) => l.some((x) => x.id === q))!;
                    const question = list.find((x) => x.id === q)!;
                    state.conversations[sid].push({ role: "user", content: question.text }, { role: "assistant", content: question.answer });
                }
                const show = sel.match(/data-for="([^"]+)"\]\[data-clue="([^"]+)"/);
                if (show) {
                    const name = c.clues.find((cl) => cl.id === show[2])!.name;
                    state.shownClues[show[1]].add(show[2]);
                    state.conversations[show[1]].push({ role: "user", content: `(The investigator shows you the ${name}: ...)` }, { role: "assistant", content: "..." });
                }
                const room = sel.match(/^\.room-chip\[data-room="([^"]+)"\]/)?.[1];
                if (room) state.searchedRoomIDs.add(room);
            }
            for (const sel of step.allow ?? []) {
                const pin = sel.match(/data-pin="([a-z]+)-(\d)"/);
                if (pin) {
                    // The step text names the room to pin; find it among the room names
                    const name = c.rooms.find((r) => step.todo!.includes(r.name))!;
                    state.board[pin[1]][Number(pin[2])] = name.id;
                }
            }
            if (step.target?.some((t) => t.includes("timeline"))) ctx.boardOpen = true;
            if (step.allow?.includes("#accuse-btn")) state.verdict = { correctCulprit: true, correctProof: { opportunity: true, motive: true, means: true }, rank: "Master Investigator", explanation: "" };
            expect(step.done(ctx), step.text.slice(0, 60)).toBe(true);
            ctx.boardOpen = false;
        }
    });

    it("isAsked only counts a question once it's been answered", () => {
        const state = createGameState(c);
        const q = QUESTIONS.okafor[0];
        state.conversations.okafor.push({ role: "user", content: q.text });
        expect(isAsked(state, q.id)).toBe(false);
        state.conversations.okafor.push({ role: "assistant", content: q.answer });
        expect(isAsked(state, q.id)).toBe(true);
    });
});
