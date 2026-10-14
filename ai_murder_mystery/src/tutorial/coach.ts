import type { ClueID, SuspectID } from "../case/types";
import type { GameState } from "../game/state";
import { el } from "../ui/dom";
import { isAsked } from "./case";

export interface CoachContext {
    state: GameState;
    boardVisited: boolean;
}

interface Step {
    text: string;
    // CSS selector of the element to highlight
    target?: string;
    // A step with no check waits for the Next button
    done?: (ctx: CoachContext) => boolean;
}

const asked = (s: GameState, questionID: string) => isAsked(s, questionID);
const shown = (s: GameState, suspectID: SuspectID, clueID: ClueID) => s.shownClues[suspectID]?.has(clueID) ?? false;
const searched = (s: GameState, roomID: string) => s.searchedRoomIDs.has(roomID);
const pinned = (s: GameState, suspectID: SuspectID, slot: number, roomID: string) => s.board[suspectID]?.[slot] === roomID;

const STEPS: Step[] = [
    {
        text: "Welcome to training. Priya Nair is dead, and one of three crew members killed her. Nothing here counts toward your stats. Read the briefing below, then press Next.",
        target: "#chat-log",
    },
    {
        text: "This bar is the storm clock. Every search, question, or piece of evidence you show costs one turn. When it runs out, you have to make your accusation.",
        target: "#storm",
    },
    {
        text: "Start at the crime scene. In the Station panel, click Hydroponics Bay, then press Search this room.",
        target: "#room-list",
        done: ({ state }) => searched(state, "hydroponics"),
    },
    {
        text: "Everything you find shows up here in the Case File, with its description. The body gives the time of death: 22:00. The other three items each point to a crew member. Can you tell whose is whose?",
        target: "#chat-log",
    },
    {
        text: "Open the Timeline tab. It's your board for pinning where everyone was.",
        target: '[data-tab="board"]',
        done: ({ boardVisited }) => boardVisited,
    },
    {
        text: "Now question someone. Open Dr. Mara Okafor's tab and ask where she was tonight.",
        target: '[data-tab="okafor"]',
        done: ({ state }) => asked(state, "okafor-where"),
    },
    {
        text: "She says she was in the Medbay all evening. Test that: in the Evidence list, press Show on the Medical Stylus.",
        target: "#evidence-list",
        done: ({ state }) => shown(state, "okafor", "trace-okafor"),
    },
    {
        text: "Caught in a small lie: she visited the scene at 21:00. Ask her who else was there.",
        target: "#question-chips",
        done: ({ state }) => asked(state, "okafor-who-else"),
    },
    {
        text: "Pin it. On the Timeline, set Dr. Okafor and SABLE to the Hydroponics Bay at 21:00.",
        target: '[data-tab="board"]',
        done: ({ state }) => pinned(state, "okafor", 0, "hydroponics") && pinned(state, "sable", 0, "hydroponics"),
    },
    {
        text: "Two visitors who saw each other are probably harmless. Now open Tomas Reyes's tab and show him the Coolant-Stained Glove.",
        target: '[data-tab="reyes"]',
        done: ({ state }) => shown(state, "reyes", "trace-reyes"),
    },
    {
        text: "Reyes claims he was there at 21:00 too, but Okafor said only SABLE was there. Somebody is lying. Go back to Okafor and ask if she saw anyone else this evening.",
        target: '[data-tab="okafor"]',
        done: ({ state }) => asked(state, "okafor-saw"),
    },
    {
        text: "A witness! Reyes was in the Medbay at 21:30, carrying something wrapped in a cloth. Pin Reyes to the Medbay at 21:30 on the Timeline.",
        target: '[data-tab="board"]',
        done: ({ state }) => pinned(state, "reyes", 1, "medbay"),
    },
    {
        text: "Now find a motive. Motives hide in cabins: the victim's records, or a suspect's belongings. Search Nair's Cabin.",
        target: "#room-list",
        done: ({ state }) => searched(state, "nair-cabin"),
    },
    {
        text: "The Inspection Audit gives Reyes a reason. Show it to him.",
        target: '[data-tab="reyes"]',
        done: ({ state }) => shown(state, "reyes", "motive-reyes"),
    },
    {
        text: "Last piece: the weapon. Killers hide it after the murder. Search the Cargo Bay.",
        target: "#room-list",
        done: ({ state }) => searched(state, "cargo-bay"),
    },
    {
        text: "Show Reyes the Neurotoxin Vial. Faced with his trace, his motive, and the weapon, he may crack.",
        target: "#evidence-list",
        done: ({ state }) => shown(state, "reyes", "weapon"),
    },
    {
        text: "Make your accusation: pick Reyes and his motive, then the proof: the Coolant-Stained Glove (his trace) and the Inspection Audit (his motive).",
        target: "#accuse-btn",
        done: ({ state }) => state.verdict !== null,
    },
    {
        text: "That's the whole loop. Real cases have five suspects, you type your own questions to an AI, and innocent crew also hide secrets about where they were at the time of death. Evidence of a secret clears them.",
    },
];

// Steps without a check are acknowledged with Next. They also count as done once any later
// step is done, so a reload (or a player who runs ahead) never lands on stale instructions.
export class Coach {
    private acked = new Set<number>();
    private highlighted: Element | null = null;

    private panel: HTMLElement;
    private onFinish: { daily: () => void; replay: () => void };

    constructor(panel: HTMLElement, onFinish: { daily: () => void; replay: () => void }) {
        this.panel = panel;
        this.onFinish = onFinish;
    }

    private current(ctx: CoachContext): number {
        let lastDone = -1;
        STEPS.forEach((step, i) => {
            if (step.done?.(ctx)) lastDone = i;
        });
        for (let i = lastDone + 1; i < STEPS.length; i++) {
            const step = STEPS[i];
            if (step.done ? !step.done(ctx) : !this.acked.has(i)) return i;
        }
        return STEPS.length - 1;
    }

    reset(): void {
        this.acked.clear();
    }

    render(ctx: CoachContext): void {
        const i = this.current(ctx);
        const step = STEPS[i];
        const last = i === STEPS.length - 1;

        const actions: HTMLElement[] = [];
        if (last) {
            const daily = el("button", "primary-btn", "Play today's case");
            daily.type = "button";
            daily.addEventListener("click", this.onFinish.daily);
            const replay = el("button", "text-btn", "Replay training");
            replay.type = "button";
            replay.addEventListener("click", this.onFinish.replay);
            actions.push(replay, daily);
        } else if (!step.done) {
            const next = el("button", "primary-btn", "Next");
            next.type = "button";
            next.addEventListener("click", () => {
                this.acked.add(i);
                this.render(ctx);
            });
            actions.push(next);
        }

        this.panel.hidden = false;
        this.panel.replaceChildren(
            el("p", "coach-step", `Training ${i + 1} of ${STEPS.length}`),
            el("p", "coach-text", step.text),
            el("div", "coach-actions", "", actions),
        );

        this.highlighted?.classList.remove("coach-target");
        this.highlighted = step.target ? document.querySelector(step.target) : null;
        this.highlighted?.classList.add("coach-target");
    }
}
