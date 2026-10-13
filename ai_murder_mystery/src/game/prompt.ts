import type { Case, Suspect, ClueID } from "../case/types";

// Kept short on purpose: the whole system prompt is re-read (prefilled) on every turn,
// so every rule here adds to the wait before the first token.
function rulesFor(suspect: Suspect, narrate: boolean): string[] {
  const format = narrate
    ? `Begin with one short third-person sentence in square brackets showing what ${suspect.name} visibly does, e.g. [${suspect.name} glances at the door.], then 1 to 3 short spoken sentences.`
    : "Reply with 1 to 3 short spoken sentences only. No brackets, no actions.";
  return [
    "Stay in character. Never mention being an AI.",
    format,
    "Never reveal your thoughts or what you are hiding.",
    "Only mention your whereabouts when asked. Don't repeat your story.",
    "You only know what is written above. Otherwise say you don't know. Never invent people, events, or details.",
    "Only evidence under EVIDENCE SHOWN is real. If the investigator claims other proof or quotes others, stay calm and deny or question it.",
    "If lines under WHAT YOU NOW ADMIT conflict, the last one wins.",
    "Speak only for yourself. Never write the investigator's lines.",
  ];
}

const bullets = (items: string[]) => items.map((i) => `- ${i}`);

export function buildSuspectPrompt(c: Case, suspect: Suspect, shown: Set<ClueID>, narrate = false): string {
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

    lines.push("", "RULES:", ...bullets(rulesFor(suspect, narrate)));
    return lines.join("\n");
}