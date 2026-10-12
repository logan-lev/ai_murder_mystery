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
    for (let seed = 1; seed <= 2000; seed++) {
        const { case: fc, truth: ft } = generateCase(seed);
        const errors = validateCase(fc);

        for (const s of fc.suspects) {
            const allClues = new Set(fc.clues.map((cl) =>  cl.id));
            const prompt = buildSuspectPrompt(fc, s, allClues);
            for (const bad of ["..", ".,", " ,", "{", "}"]) {
                if (prompt.includes(bad)) uniqueErrors.add(`Prompt for ${s.id} contains "${bad}"`);
            }
        }

        if (errors.length > 0) {
            failures++;
            errors.forEach((e) => uniqueErrors.add(e));
        }
        distinct.add(JSON.stringify(ft.timeline) + ft.methodID + ft.hideRoom + fc.solution.motiveID);
    }
    console.log(`Fuzz Test: 2000 seeds, ${failures} failures, ${distinct.size} distinct cases.`);
    if (uniqueErrors.size > 0) console.error("Unique Errors:", [...uniqueErrors]);

    // 3. Prompts for the culprit and one innocent, before and after evidence
    const culprit = c.suspects.find((s) => s.id === truth.culpritID)!;
    const innocent = c.suspects.find((s) => s.id !== truth.culpritID)!;

    console.log(`--- ${culprit.name} (culprit), no evidence ---\n` + buildSuspectPrompt(c, culprit, new Set()));
    console.log(`--- ${culprit.name} (culprit), full evidence ---\n` + buildSuspectPrompt(c, culprit, new Set([`trace-${culprit.id}`, "weapon", `motive-${culprit.id}`])));
    console.log(`--- ${innocent.name} (innocent), no evidence ---\n` + buildSuspectPrompt(c, innocent, new Set()));
     console.log(`--- ${innocent.name} (innocent), secret shown ---\n` + buildSuspectPrompt(c, innocent, new Set([`secret-${innocent.id}`])));
}