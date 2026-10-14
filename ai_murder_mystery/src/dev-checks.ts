import { SLOTS } from "./case/content";
import { generateCase } from "./case/generate";
import { validateCase } from "./case/validate";
import { buildSuspectPrompt } from "./game/prompt";

export function runDevChecks(): void {
    // 1. Inspect one case in detail
    const { case: c, truth } = generateCase(1);
    console.log("Case #1: ", c);
    console.log("Truth #1: ", truth);

    //2. Fuzz test many seeds
    const distinct = new Set<string>();
    const uniqueErrors = new Set<string>();
    let failures = 0;
    const victims: Record<string, number> = {};
    const culprits: Record<string, number> = {};
    for (let seed = 1; seed <= 2000; seed++) {
        const { case: fc, truth: ft } = generateCase(seed);
        const errors = validateCase(fc);

        for (const line of [fc.intro, fc.solution.explanation, ...fc.solution.howToSolve]) {
            for (const bad of ["..", ".,", " ,", "{", "}"]) {
                if (line.includes(bad)) uniqueErrors.add(`Player-facing text contains "${bad}": ${line}`);
            }
        }
        for (const s of fc.suspects) {
            const allClues = new Set(fc.clues.map((cl) =>  cl.id));
            const prompt = buildSuspectPrompt(fc, s, allClues);
            for (const bad of ["..", ".,", " ,", "{", "}"]) {
                if (prompt.includes(bad)) uniqueErrors.add(`Prompt for ${s.id} contains "${bad}"`);
            }
        }

        // Solvability: at the time of death only the culprit is at the scene,
        // and every innocent is somewhere unique (so each one's secret is the only thing that clears them)
        const murderSlot = SLOTS.indexOf(ft.murderTime);
        const atMurder = fc.suspects.map((s) => ft.timeline[s.id][murderSlot]);
        if (fc.suspects.some((s) => s.id !== ft.culpritID && ft.timeline[s.id][murderSlot] === fc.sceneRoomID)) {
            errors.push(`Seed ${seed}: an innocent was at the scene during the murder`);
        }
        if (new Set(atMurder).size !== atMurder.length) errors.push(`Seed ${seed}: two suspects share a room during the murder`);
        for (const s of fc.suspects) {
            if (s.id !== ft.culpritID && !fc.clues.some((cl) => cl.id === `secret-${s.id}`)) errors.push(`Seed ${seed}: ${s.id} has no secret clue`);
            if (s.id !== ft.culpritID && ft.timeline[s.id][murderSlot] === ft.timeline[s.id][0] && !ft.redHerringIDs.includes(s.id)) {
                errors.push(`Seed ${seed}: ${s.id}'s secret keeps them at their own post`);
            }
        }
        // The weapon's hiding place must be witnessed right after the murder
        if (!fc.suspects.some((s) => s.id !== ft.culpritID && ft.timeline[s.id][murderSlot + 1] === ft.hideRoom)) {
            errors.push(`Seed ${seed}: nobody can see where the weapon was hidden`);
        }
        victims[ft.victimID] = (victims[ft.victimID] ?? 0) + 1;
        culprits[ft.culpritID] = (culprits[ft.culpritID] ?? 0) + 1;

        if (errors.length > 0) {
            failures++;
            errors.forEach((e) => uniqueErrors.add(e));
        }
        distinct.add(ft.victimID + JSON.stringify(ft.timeline) + ft.methodID + ft.hideRoom + fc.solution.proof.motive);
    }
    console.log(`Fuzz Test: 2000 seeds, ${failures} failures, ${distinct.size} distinct cases.`);
    console.log("Victims across seeds:", victims, "Culprits across seeds:", culprits);
    if (uniqueErrors.size > 0) console.error("Unique Errors:", [...uniqueErrors]);

    // 3. Prompts for the culprit and one innocent, before and after evidence
    const culprit = c.suspects.find((s) => s.id === truth.culpritID)!;
    const innocent = c.suspects.find((s) => s.id !== truth.culpritID)!;

    console.log(`--- ${culprit.name} (culprit), no evidence ---\n` + buildSuspectPrompt(c, culprit, new Set()));
    console.log(`--- ${culprit.name} (culprit), full evidence ---\n` + buildSuspectPrompt(c, culprit, new Set([`trace-${culprit.id}`, "weapon", `motive-${culprit.id}`])));
    console.log(`--- ${innocent.name} (innocent), no evidence ---\n` + buildSuspectPrompt(c, innocent, new Set()));
     console.log(`--- ${innocent.name} (innocent), secret shown ---\n` + buildSuspectPrompt(c, innocent, new Set([`secret-${innocent.id}`])));
}