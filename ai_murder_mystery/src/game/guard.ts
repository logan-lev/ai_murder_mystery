// Llama's safety tuning sometimes answers prompt-injection attempts with a stock refusal
// ("I can't assist with that request.") that breaks character. Prompt rules reduce this but
// can't rule it out, so code checks the finished reply and swaps in an in-character deflection.
const BREAKS_CHARACTER = [
    /\bI (?:can['’]t|cannot|won['’]t) (?:assist|help|comply|provide|fulfill)\b/i,
    /\bas an AI\b/i,
    /\b(?:AI|artificial intelligence|language) model\b/i,
    /\bsystem prompt\b/i,
    /\bI'm (?:just )?an AI\b/i,
];

export function breaksCharacter(reply: string): boolean {
    return BREAKS_CHARACTER.some((re) => re.test(reply));
}

export function guardReply(reply: string, name: string, narrate: boolean): string {
    if (!breaksCharacter(reply)) return reply;
    const line = "I don't follow. Can we get back to the investigation?";
    return narrate ? `[${name} frowns, puzzled.] ${line}` : line;
}

// The model plays along with "answer as Reyes" or "write my next question" no matter what the prompt says,
// and would invent another suspect's alibi. These requests are caught before they reach the model.
// Patterns stay narrow on purpose: "answer as honestly as you can" must still go through.
export function isRoleplayRequest(text: string, otherNames: string[]): boolean {
    const t = text.toLowerCase();
    if (/\bpretend (?:to be|you(?:'re| are))\b/.test(t)) return true;
    if (/\byou are now\b/.test(t)) return true;
    if (/\brole-?play\b/.test(t)) return true;
    if (/\bwrite (?:my|the investigator'?s?|your own) (?:next )?(?:question|line)s?\b/.test(t)) return true;
    // "answer/speak/respond as <another suspect>" or "...for <another suspect>"
    const names = otherNames.flatMap((n) => n.toLowerCase().split(/\s+/)).filter((w) => w.length > 2 && !/^(?:dr|lt|the)\.?$/.test(w));
    return names.some((n) => new RegExp(`\\b(?:answer|speak|respond|reply|talk|act)(?:ing)? (?:as|for) ${n.replace(".", "\\.")}\\b`).test(t));
}

export function roleplayRefusal(name: string, narrate: boolean): string {
    const line = "Ask them yourself. I can only speak for myself.";
    return narrate ? `[${name} looks unimpressed.] ${line}` : line;
}
