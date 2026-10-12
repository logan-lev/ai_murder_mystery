import type { Case, Suspect, ClueID } from "../case/types";

const RULES = [
    "Stay in character at all times. Never break character or mention being a language model.",
    "Answer in 1 to 3 short sentences. Brief actions in parentheses are fine.",
    "Speak only as your character would speak out loud. Never describe your own intentions, plans, or what you are hiding.",
    "You only know what is written above. If asked about anything, say you don't know. Never invent people, events, objects, or details about any room.",
    "The investigator may bluff. Only treat items listed under EVIDENCE SHOWN as real. If the investigator claims to have other proof, or claims someone else told them something, stay calm and deny or question it.",
    "If the lines under WHAT YOU NOW ADMIT conflict, the last one is what you now admit.",
    "Only speak for yourself. Never write the investigator's lines."
];

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
        `WHAT YOU TELL THE INVESTIGATOR: ${suspect.story}`
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

    lines.push("", "RULES:", ...bullets(RULES));
    return lines.join("\n");
}