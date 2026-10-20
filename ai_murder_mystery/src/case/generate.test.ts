import { describe, it, expect } from "vitest";
import { generateCase } from "./generate";
import { validateCase } from "./validate";
import { CHARACTERS, SLOTS, STATION_ROOMS, SUSPECT_COUNT, RED_HERRING_COUNT } from "./content";
import { buildSuspectPrompt } from "../game/prompt";

// The design principles in CLAUDE.md, checked over many seeds. A content or generator change that
// breaks solvability fails here instead of in a player's daily case.
const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1).concat([99999, 54321, 31337, 2024, 48151]);

describe("generateCase invariants", () => {
    for (const seed of SEEDS) {
        it(`seed ${seed} produces a valid, solvable case`, () => {
            const { case: c, truth } = generateCase(seed);
            const murderSlot = SLOTS.indexOf(truth.murderTime);
            const ids = c.suspects.map((s) => s.id);
            const innocents = ids.filter((id) => id !== truth.culpritID);
            const clue = (id: string) => c.clues.find((cl) => cl.id === id);

            // Structure
            expect(validateCase(c)).toEqual([]);
            expect(c.suspects).toHaveLength(SUSPECT_COUNT);
            expect(new Set(ids).size).toBe(SUSPECT_COUNT);
            expect(ids).not.toContain(truth.victimID);
            expect(ids).toContain(truth.culpritID);
            expect(murderSlot === 1 || murderSlot === 2).toBe(true);

            // The scene is the victim's post, and nobody else works there
            const victim = CHARACTERS.find((ch) => ch.id === truth.victimID)!;
            expect(victim.canBeVictim).toBe(true);
            expect(c.sceneRoomID).toBe(victim.homeRoom);

            // At the time of death: only the culprit is at the scene, and every alibi room is unique
            const atMurder = ids.map((id) => truth.timeline[id][murderSlot]);
            expect(new Set(atMurder).size).toBe(atMurder.length);
            expect(truth.timeline[truth.culpritID][murderSlot]).toBe(c.sceneRoomID);
            for (const id of innocents) {
                const home = CHARACTERS.find((ch) => ch.id === id)!.homeRoom;
                expect(truth.timeline[id][murderSlot]).not.toBe(c.sceneRoomID);
                expect(truth.timeline[id][murderSlot]).not.toBe(home);
                // Every innocent's secret has evidence somewhere in the station
                expect(clue(`secret-${id}`)).toBeDefined();
            }

            // Red herrings: exactly two innocents, at the scene at 21:00, with traces there
            expect(truth.redHerringIDs).toHaveLength(RED_HERRING_COUNT);
            for (const id of truth.redHerringIDs) {
                expect(innocents).toContain(id);
                expect(truth.timeline[id][0]).toBe(c.sceneRoomID);
                expect(clue(`trace-${id}`)?.roomID).toBe(c.sceneRoomID);
            }

            // Three traces at the scene (culprit + herrings), none naming their owner
            const traces = c.clues.filter((cl) => cl.id.startsWith("trace-"));
            expect(traces).toHaveLength(RED_HERRING_COUNT + 1);
            for (const t of traces) {
                expect(t.roomID).toBe(c.sceneRoomID);
                const owner = c.suspects.find((s) => `trace-${s.id}` === t.id)!;
                const lastName = owner.name.split(" ").pop()!;
                if (owner.id !== "sable") expect(t.description).not.toContain(lastName);
            }

            // Motives are never at the scene
            for (const cl of c.clues.filter((x) => x.id.startsWith("motive-"))) expect(cl.roomID).not.toBe(c.sceneRoomID);

            // The weapon is never at the scene, and someone sees the culprit at its hiding place right after
            expect(clue("weapon")?.roomID).toBe(truth.hideRoom);
            expect(truth.hideRoom).not.toBe(c.sceneRoomID);
            expect(innocents.some((id) => truth.timeline[id][murderSlot + 1] === truth.hideRoom)).toBe(true);

            // The proof points at real clues that belong to the culprit
            expect(c.solution.culpritID).toBe(truth.culpritID);
            expect(c.solution.proof).toEqual({ opportunity: `trace-${truth.culpritID}`, motive: `motive-${truth.culpritID}`, means: "weapon" });
            expect(c.solution.howToSolve.length).toBeGreaterThanOrEqual(4);

            // Player-facing text and prompts have no template leftovers or punctuation glitches
            const texts = [c.intro, c.solution.explanation, ...c.solution.howToSolve, ...c.clues.map((cl) => cl.description)];
            for (const s of c.suspects) texts.push(buildSuspectPrompt(c, s, new Set()), buildSuspectPrompt(c, s, new Set(c.clues.map((cl) => cl.id))));
            for (const t of texts) {
                for (const bad of ["{", "}", "..", ".,", " ,", "undefined", "the the "]) expect(t, `"${bad}" in: ${t.slice(0, 120)}`).not.toContain(bad);
            }
            // Cabins never get a stray "the" in front of them ("the Park's Cabin")
            for (const t of texts) expect(t).not.toMatch(/\bthe \w+'s (Cabin|Charging Alcove)/);
        });
    }
});

describe("generateCase determinism and variety", () => {
    it("is deterministic for a seed", () => {
        expect(JSON.stringify(generateCase(777))).toBe(JSON.stringify(generateCase(777)));
    });

    it("produces mostly different cases across seeds", () => {
        const keys = new Set(SEEDS.map((s) => {
            const { truth } = generateCase(s);
            return `${truth.victimID}|${truth.culpritID}|${truth.methodID}|${truth.hideRoom}|${JSON.stringify(truth.timeline)}`;
        }));
        expect(keys.size).toBeGreaterThan(SEEDS.length * 0.95);
    });

    it("spreads victims and culprits across the cast", () => {
        const victims = new Set(SEEDS.map((s) => generateCase(s).truth.victimID));
        const culprits = new Set(SEEDS.map((s) => generateCase(s).truth.culpritID));
        expect(victims.size).toBe(CHARACTERS.filter((c) => c.canBeVictim).length);
        expect(culprits.size).toBe(CHARACTERS.length);
    });

    it("only uses rooms that exist", () => {
        const roomIDs = new Set([...STATION_ROOMS.map((r) => r.id), ...CHARACTERS.map((c) => c.cabin.id), "exterior"]);
        for (const seed of SEEDS.slice(0, 100)) {
            const { case: c, truth } = generateCase(seed);
            for (const rooms of Object.values(truth.timeline)) for (const r of rooms) expect(roomIDs.has(r)).toBe(true);
            for (const cl of c.clues) expect(c.rooms.some((r) => r.id === cl.roomID)).toBe(true);
        }
    });
});

describe("generated sightings", () => {
    it("name the person twice so a witness can't read the carrying as about itself", () => {
        for (const seed of SEEDS.slice(0, 150)) {
            const { case: c } = generateCase(seed);
            for (const s of c.suspects) {
                for (const fact of s.facts.filter((f) => f.includes("you saw"))) {
                    const m = fact.match(/you saw (.+?) in the .+?\.(?: (.+?) was )?/);
                    expect(m).not.toBeNull();
                    if (m && m[2]) expect(m[2]).toBe(m[1]);
                }
            }
        }
    });

    it("list everyone's pronouns, including the victim's", () => {
        const { case: c } = generateCase(5150);
        const aboard = c.sharedFacts.find((f) => f.startsWith("Aboard the station tonight"))!;
        for (const s of c.suspects) expect(aboard).toContain(`${s.name} (${s.pronouns.he})`);
        expect(aboard).toMatch(/\((he|she)\) is dead/);
    });
});
