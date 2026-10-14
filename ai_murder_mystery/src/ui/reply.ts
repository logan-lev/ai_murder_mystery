export interface ParsedReply {
    narration: string;
    speech: string;
}

// Splits "[narration] speech" into parts. Works mid-stream, before the "]" has arrived.
export function parseReply(raw: string): ParsedReply {
    const text = raw.trimStart();
    if (!text.startsWith("[")) return { narration: "", speech: text };
    const end = text.indexOf("]");
    if (end === -1) return { narration: text.slice(1), speech: "" };
    return { narration: text.slice(1, end).trim(), speech: text.slice(end + 1).trim() };
}

// Fills an element with text, turning (parenthesized) or [bracketed] actions into styled <em> elements.
// The model sometimes adds bracketed actions mid-reply even when the opening narration was skipped.
// The closing ")" or "]" is optional so an action still renders correctly while it's streaming in.
export function renderWithActions(el: HTMLElement, text: string): void {
  el.replaceChildren();
  for (const part of text.split(/(\([^)]*\)?|\[[^\]]*\]?)/)) {
    if (!part) continue;
    if (part.startsWith("(") || part.startsWith("[")) {
      const em = document.createElement("em");
      em.className = "action";
      em.textContent = part.replace(/^[([]|[)\]]$/g, "");
      el.append(em);
    } else {
      el.append(document.createTextNode(part));
    }
  }
}
// A reply cut off by the token limit ends mid-word ("It was... pa"). This trims it back to the last
// complete sentence, and drops a narration or action bracket that was opened but never closed.
export function trimIncomplete(text: string): string {
    let out = text;
    const ends = [...out.matchAll(/[.!?…]["')\]]?(?=\s|$)/g)];
    const last = ends[ends.length - 1];
    if (last && last.index !== undefined) out = out.slice(0, last.index + last[0].length);
    for (const [open, close] of [["[", "]"], ["(", ")"]]) {
        if (out.lastIndexOf(open) > out.lastIndexOf(close)) out = out.slice(0, out.lastIndexOf(open));
    }
    return out.trimEnd();
}
