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

// The model writes clipped narration like "[Vale rubs temples, eyes narrowing.]".
// This adds the missing possessive before common body parts, in the bracketed narration only.
const BODY = "temples|eyes|hands|head|arms|shoulders|brow|jaw|fingers|lips|hair|neck|chin|gaze|fists|nose|forehead|teeth|face|voice|expression|posture|hand|arm|shoulder";
const DETERMINER = "his|her|its|their|the|a|an|one|both|my|your";

export function polishNarration(reply: string, his: string): string {
    const match = reply.match(/^(\s*\[)([^\]]*)(\][\s\S]*)$/);
    if (!match) return reply;
    let narration = match[2];
    // "rubs temples" -> "rubs his temples"
    narration = narration.replace(new RegExp(`\\b(?!(?:${DETERMINER})\\b)(\\w+s) (?!(?:${DETERMINER})\\b)(${BODY})\\b`, "gi"), `$1 ${his} $2`);
    // ", eyes narrowing" -> ", his eyes narrowing"
    narration = narration.replace(new RegExp(`(,\\s*)(?!(?:${DETERMINER})\\b)(${BODY}) (\\w+ing)\\b`, "gi"), `$1${his} $2 $3`);
    return match[1] + narration + match[3];
}

// A verbal habit of the model: "as I mentioned earlier" on the very first answer, even when told
// it's a first meeting. Used only when the suspect has no earlier replies, so real callbacks survive.
const CALLBACK = "(?:as|like) I (?:mentioned|said|told you|explained|already said)(?: (?:earlier|before|already|previously))?";

export function stripFalseCallbacks(reply: string): string {
    return reply
        // "As I mentioned earlier, I was..." -> "I was..."
        .replace(new RegExp(`(^|[.!?]\\s+|\\]\\s*)${CALLBACK},\\s*(\\w)`, "gi"), (_, before: string, first: string) => before + first.toUpperCase())
        // "...at 21:00, as I mentioned earlier." -> "...at 21:00."
        .replace(new RegExp(`,?\\s*${CALLBACK}(?=[.,!?])`, "gi"), "");
}
