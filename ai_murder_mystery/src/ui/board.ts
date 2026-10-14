import type { Case, SuspectID } from "../case/types";
import { SLOTS } from "../case/content";
import type { GameState } from "../game/state";
import { el } from "./dom";

export interface BoardOptions {
    // Index into SLOTS once the player has found the body (which gives the time of death), else null
    deathSlot: number | null;
    onPin: (suspectID: SuspectID, slot: number, roomID: string) => void;
}

// The player's notebook: where they think everyone was at each time slot.
// Nothing here is checked against the truth. It's a thinking tool, and a pinned board makes
// patterns visible (two people vouching for each other, someone nobody can place).
export function renderBoard(target: HTMLElement, c: Case, state: GameState, opts: BoardOptions): void {
    const scene = c.rooms.find((r) => r.id === c.sceneRoomID)!;
    const places = [...c.rooms.map((r) => ({ id: r.id, name: r.name })), { id: "exterior", name: "Outside the station" }];

    const slotClass = (i: number) => (i === opts.deathSlot ? "death-slot" : "");
    const head = el("tr", "", "", [
        el("th", "", "Crew"),
        ...SLOTS.map((t, i) => el("th", slotClass(i), i === opts.deathSlot ? `${t} (death)` : t)),
    ]);

    // The victim was at the scene all evening (a shared fact everyone knows)
    const victimRow = el("tr", "victim-row", "", [
        el("th", "", c.victim),
        ...SLOTS.map((_, i) => el("td", slotClass(i), "", [el("span", "pin at-scene", scene.name)])),
    ]);

    const rows = c.suspects.map((s) =>
        el("tr", "", "", [
            el("th", "", s.name),
            ...SLOTS.map((t, i) => {
                const select = el("select", "pin-select");
                select.setAttribute("aria-label", `${s.name} at ${t}`);
                select.dataset.pin = `${s.id}-${i}`;
                const unknown = el("option", "", "?");
                unknown.value = "";
                select.append(unknown, ...places.map((p) => {
                    const opt = el("option", "", p.name);
                    opt.value = p.id;
                    return opt;
                }));
                select.value = state.board[s.id]?.[i] ?? "";
                const paint = () => {
                    select.classList.toggle("pinned", select.value !== "");
                    select.classList.toggle("at-scene", select.value === c.sceneRoomID);
                };
                paint();
                select.addEventListener("change", () => {
                    paint();
                    opts.onPin(s.id, i, select.value);
                });
                return el("td", slotClass(i), "", [select]);
            }),
        ]),
    );

    target.replaceChildren(
        el("p", "board-intro", "Pin where you think each crew member was. Use their answers, what others saw, and the evidence. Anyone pinned to the crime scene shows up in red."),
        el("div", "table-wrap", "", [el("table", "board", "", [el("thead", "", "", [head]), el("tbody", "", "", [victimRow, ...rows])])]),
    );
}
