import type { Case } from "./types";

export function validateCase(c: Case): string[] {
    const errors: string[] = [];
    const roomIDs = new Set(c.rooms.map((r) => r.id));
    const clueIDs = new Set<string>();
    const suspectIDs = new Set(c.suspects.map((s) => s.id));

    for (const clue of c.clues) {
        if (clueIDs.has(clue.id)) errors.push(`Duplicate Clue ID: "${clue.id}`);
        clueIDs.add(clue.id);
        if (!roomIDs.has(clue.roomID)) errors.push(`Clue "${clue.id}" is in an unknown room: "${clue.roomID}.`);
    }

    for (const s of c.suspects) {
        for (const u of s.unlocks) {
            for (const id of u.requires) {
                if (!clueIDs.has(id)) errors.push(`Suspect, "${s.id}", has an unlock needing unknown clue: "${id}".`)
            }
        }
    }

    if (!suspectIDs.has(c.solution.culpritID)) errors.push(`Unknown Culprit: "${c.solution.culpritID}"`);
    if (!c.motives.some((m) => m.id === c.solution.motiveID)) errors.push(`Unknown Motive: "${c.solution.motiveID}"`);

    for (const id of c.solution.requiredClueIDs) {
        if (!clueIDs.has(id)) errors.push(`Solution needs an unknown clue: "${id}".`);
    }

    return errors;
}