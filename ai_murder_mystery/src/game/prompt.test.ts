import { describe, it, expect } from "vitest";
import { generateCase } from "../case/generate";
import { buildSuspectPrompt } from "./prompt";
import { SECRETS } from "../case/content";

// Principle 2: "The model cannot leak what it was never told." These tests check what each prompt
// does and does not contain, before and after evidence is shown.
const SEEDS = [1, 7, 42, 777, 1001, 2024, 3141, 4242, 5150, 31337];

describe("secrets stay out of prompts until unlocked", () => {
    for (const seed of SEEDS) {
        const { case: c, truth } = generateCase(seed);
        const culprit = c.suspects.find((s) => s.id === truth.culpritID)!;
        const innocents = c.suspects.filter((s) => s.id !== truth.culpritID);

        it(`seed ${seed}: no innocent is told their secret before it's shown`, () => {
            for (const s of innocents) {
                const unlock = s.unlocks.find((u) => u.requires.includes(`secret-${s.id}`))!;
                const locked = buildSuspectPrompt(c, s, new Set());
                expect(locked).not.toContain(unlock.reveals);
                // Not even the activity itself (the "don't think of an elephant" problem)
                const activity = SECRETS.find((sec) => unlock.reveals.includes(sec.activity))!.activity;
                expect(locked).not.toContain(activity);

                const opened = buildSuspectPrompt(c, s, new Set([`secret-${s.id}`]));
                expect(opened).toContain(activity);
                expect(opened).toContain("your story now");
            }
        });

        it(`seed ${seed}: the culprit is never told they're guilty before the confession unlock`, () => {
            const partial = buildSuspectPrompt(c, culprit, new Set([`trace-${culprit.id}`, `motive-${culprit.id}`]));
            expect(partial).not.toMatch(/you killed|confess to killing|composure breaks/i);
            // Shown their trace, they claim the same harmless 21:00 visit as the herrings
            expect(partial).toContain("claim it was a short visit at 21:00");

            const full = buildSuspectPrompt(c, culprit, new Set([`trace-${culprit.id}`, `motive-${culprit.id}`, "weapon"]));
            expect(full).toMatch(/You confess to killing/);
            // Denials and hiding rules are dropped so they can't fight the confession
            expect(full).not.toContain("insist you did not kill");
            expect(full).not.toContain("Never reveal your thoughts or what you are hiding");
            expect(full.trimEnd().split("\n").pop()).toMatch(/^IMPORTANT: The evidence has broken you/);
        });

        it(`seed ${seed}: red herrings learn their scene visit and sightings only with their trace`, () => {
            for (const id of truth.redHerringIDs) {
                const s = c.suspects.find((x) => x.id === id)!;
                const locked = buildSuspectPrompt(c, s, new Set());
                expect(locked).not.toMatch(new RegExp(`At 21:00 you saw .+ in the ${c.rooms.find((r) => r.id === c.sceneRoomID)!.name}`));
                expect(locked).not.toContain("is yours");
                const opened = buildSuspectPrompt(c, s, new Set([`trace-${id}`]));
                expect(opened).toContain("is yours");
                expect(opened).toMatch(/At 21:00 you saw .+ in the /);
            }
        });

        it(`seed ${seed}: innocents admit motives, the culprit denies theirs`, () => {
            for (const s of c.suspects) {
                const p = buildSuspectPrompt(c, s, new Set([`motive-${s.id}`]));
                if (s.id === culprit.id) expect(p).toMatch(/is exaggerated or a misunderstanding/);
                else expect(p).toMatch(/You admit that/);
            }
        });
    }
});

describe("prompt format flags", () => {
    const { case: c } = generateCase(42);
    const s = c.suspects[0];

    it("asks for bracketed narration only when narrate is on", () => {
        expect(buildSuspectPrompt(c, s, new Set(), true)).toContain("square brackets");
        expect(buildSuspectPrompt(c, s, new Set(), false)).toContain("No brackets, no actions");
    });

    it("uses the suspect's own pronoun in the narration example", () => {
        expect(buildSuspectPrompt(c, s, new Set(), true)).toContain(`[${s.shortName} rubs ${s.pronouns.his} temples.]`);
    });

    it("marks a first meeting so the model doesn't say 'as I mentioned'", () => {
        expect(buildSuspectPrompt(c, s, new Set(), false, true)).toContain("first time the investigator has spoken to you");
        expect(buildSuspectPrompt(c, s, new Set(), false, false)).not.toContain("first time the investigator");
    });

    it("puts turn-specific reminders near the end under RIGHT NOW", () => {
        const p = buildSuspectPrompt(c, s, new Set(), false, false, ["Remember the cameras."]);
        expect(p).toContain("RIGHT NOW:\n- Remember the cameras.");
        expect(p.indexOf("RIGHT NOW")).toBeGreaterThan(p.indexOf("RULES:"));
    });

    it("always lists shown evidence, and says so when there's none", () => {
        expect(buildSuspectPrompt(c, s, new Set())).toContain("- None yet.");
        const withBody = buildSuspectPrompt(c, s, new Set(["body"]));
        expect(withBody).toContain("The Body:");
        expect(withBody).not.toContain("- None yet.");
    });

    it("tells suspects to answer in English and to name the victim", () => {
        const p = buildSuspectPrompt(c, s, new Set());
        expect(p).toContain("Always reply in English.");
        expect(p).toContain(`Call ${c.victim} by name`);
    });
});
