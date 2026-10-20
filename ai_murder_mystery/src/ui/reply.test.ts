import { describe, it, expect } from "vitest";
import { parseReply, renderWithActions, trimIncomplete } from "./reply";

describe("parseReply", () => {
    it("splits narration from speech", () => {
        expect(parseReply("[Reyes rubs his neck.] I was in Engineering.")).toEqual({
            narration: "Reyes rubs his neck.",
            speech: "I was in Engineering.",
        });
    });
    it("treats a reply without brackets as all speech", () => {
        expect(parseReply("I was in Engineering.")).toEqual({ narration: "", speech: "I was in Engineering." });
    });
    it("handles narration still streaming in (no closing bracket yet)", () => {
        expect(parseReply("[Reyes rubs")).toEqual({ narration: "Reyes rubs", speech: "" });
    });
    it("ignores leading whitespace", () => {
        expect(parseReply("   [Nods.] Yes.")).toEqual({ narration: "Nods.", speech: "Yes." });
    });
    it("only treats a bracket at the very start as narration", () => {
        expect(parseReply("Yes. [pauses] No.")).toEqual({ narration: "", speech: "Yes. [pauses] No." });
    });
    it("handles an empty reply", () => {
        expect(parseReply("")).toEqual({ narration: "", speech: "" });
    });
});

describe("renderWithActions", () => {
    const render = (text: string) => {
        const div = document.createElement("div");
        renderWithActions(div, text);
        return div;
    };

    it("styles (parenthesized) and [bracketed] actions", () => {
        const div = render("Fine. (sighs) I was there. [looks away] That's all.");
        const ems = [...div.querySelectorAll("em.action")].map((e) => e.textContent);
        expect(ems).toEqual(["sighs", "looks away"]);
        expect(div.textContent).toBe("Fine. sighs I was there. looks away That's all.");
    });

    it("renders an action that's still streaming (no closing mark)", () => {
        expect(render("Well (pau").querySelector("em.action")?.textContent).toBe("pau");
    });

    it("never parses text as HTML", () => {
        const div = render('<img src=x onerror="alert(1)"> <b>hi</b>');
        expect(div.querySelector("img")).toBeNull();
        expect(div.querySelector("b")).toBeNull();
        expect(div.textContent).toContain("<img");
    });
});

describe("trimIncomplete", () => {
    it.each([
        [
            "[Nair looks down.] I remember seeing SABLE in the lab. It was... pa",
            "[Nair looks down.] I remember seeing SABLE in the lab. It was...",
        ],
        [
            "[Castellanos steps back.] That's just a device. I had nothing to do with... [pauses, her",
            "[Castellanos steps back.] That's just a device. I had nothing to do with...",
        ],
        ["I was there at 21:00. He was alive (mostly", "I was there at 21:00."],
        ["Short. Then 'quoted.' and more wor", "Short. Then 'quoted.'"],
        ["Done? Yes! Finished.", "Done? Yes! Finished."],
    ])("%s", (input, expected) => expect(trimIncomplete(input)).toBe(expected));
});
