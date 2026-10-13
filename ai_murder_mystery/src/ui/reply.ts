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

// Fills an element with text, turning (parenthesized actions) into styled <em> elements.
// The ")" is optional so an action still renders correctly while it's streaming in.
export function renderWithActions(el: HTMLElement, text: string): void {
  el.replaceChildren();
  for (const part of text.split(/(\([^)]*\)?)/)) {
    if (!part) continue;
    if (part.startsWith("(")) {
      const em = document.createElement("em");
      em.className = "action";
      em.textContent = part.replace(/^\(|\)$/g, "");
      el.append(em);
    } else {
      el.append(document.createTextNode(part));
    }
  }
}