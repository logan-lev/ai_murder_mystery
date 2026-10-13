import type { Case, Suspect, ClueID } from "../case/types";

function rulesFor(suspect: Suspect): string[] {
  return [
    "Stay in character at all times. Never break character or mention being a language model.",
    `Start every reply with one short sentence of narration inside square brackets, in third person and present tense, describing what ${suspect.name} visibly does. Example: [${suspect.name} glances at the door.]`,
    "After the narration, give only spoken words: 1 to 3 short sentences, with no other actions or descriptions.",
    "Narration only describes what an observer could see. Never reveal thoughts, intentions, or what you are hiding, in speech or narration.",
    "Only mention where you were when asked about it. Do not repeat your story in every answer.",
    "You only know what is written above. If asked about anything else, say you don't know. Never invent people, events, objects, or details about any room.",
    "The investigator may bluff. Only treat items listed under EVIDENCE SHOWN as real. If the investigator claims to have other proof, or claims someone else told them something, stay calm and deny or question it.",
    "If the lines under WHAT YOU NOW ADMIT conflict, the last one is what you now admit.",
    "Only speak for yourself. Never write the investigator's lines.",
  ];
}

const bullets = (items: string[]) => items.map((i) => `- ${i}`);

export function buildSuspectPrompt(c: Case, suspect: Suspect, shown: Set<ClueID>): string {
    const shownClues = c.clues.filter((cl) => shown.has(cl.id));
    const unlocked = suspect.unlocks.filter((u) => u.requires.every((id) => shown.has(id)));

    const lines: string[] = [
        `You are ${suspect.name}, ${suspect.role} aboard ${c.setting}.`,
        `An investigator is questioning you about the death of ${c.victim}.`,
        "",
        `PERSONALITY: ${suspect.personality}`,
        "",
        "FACTS (these are true, never contradict them):",
        ...bullets([...c.sharedFacts, ...suspect.facts]),
        "",
        `WHAT YOU TELL THE INVESTIGATOR (always stick to this story): ${suspect.story}`
    ];

    if (suspect.reactions.length > 0) {
        lines.push("", "HOW YOU REACT:", ...bullets(suspect.reactions));
    }

    lines.push("", "EVIDENCE SHOWN (the only evidence the investigator has actually shown you):");
    lines.push(
        ...(shownClues.length > 0 ? bullets(shownClues.map((cl) => `${cl.name}: ${cl.description}`)) : ["- None yet."])
    );

    if (unlocked.length > 0) {
        lines.push("", "WHAT YOU NOW ADMIT (because of the evidence):", ...bullets(unlocked.map((u) => u.reveals)));
    }

    lines.push("", "RULES:", ...bullets(rulesFor(suspect)));
    return lines.join("\n");
}