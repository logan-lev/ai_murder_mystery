import type { ClueID, SuspectID } from "../case/types";
import type { GameState } from "../game/state";
import { el } from "../ui/dom";
import { isAsked, TUTORIAL_CASE } from "./case";

export interface CoachContext {
    state: GameState;
    // Whether the Timeline tab is showing right now
    boardOpen: boolean;
    save: () => void;
}

interface Step {
    text: string;
    // CSS selector of the element to highlight
    target?: string;
    // A step with no check waits for the Next button
    done?: (ctx: CoachContext) => boolean;
    // The only action controls that work during this step (tabs always work). Keeps players in order.
    allow?: string[];
}

// Must match the selector list in style.css
const LOCKABLE = ".room-chip, #room-detail button, .chip, .show-btn, .pin-select, #accuse-btn";

const room = (id: string) => [`.room-chip[data-room="${id}"]`, `#room-detail[data-room="${id}"] button`];
const showTo = (suspectID: string, clueID: string) => [`.show-btn[data-for="${suspectID}"][data-clue="${clueID}"]`];
const question = (id: string) => [`.chip[data-q="${id}"]`];
const pin = (suspectID: string, slot: number) => [`.pin-select[data-pin="${suspectID}-${slot}"]`];

const asked = (s: GameState, questionID: string) => isAsked(s, questionID);
// Like questions, shown evidence counts once the suspect has answered it
const shown = (s: GameState, suspectID: SuspectID, clueID: ClueID) => {
    if (!s.shownClues[suspectID]?.has(clueID)) return false;
    const name = TUTORIAL_CASE.clues.find((cl) => cl.id === clueID)?.name ?? "";
    const convo = s.conversations[suspectID] ?? [];
    return convo.some((m, i) => m.role === "user" && typeof m.content === "string" && m.content.includes(`shows you the ${name}:`) && convo[i + 1]?.role === "assistant");
};
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
        allow: room("hydroponics"),
        done: ({ state }) => searched(state, "hydroponics"),
    },
    {
        text: "Everything you find shows up here in the Case File, with its description. The body gives the time of death: 22:00. It's information, not proof against anyone. The other three items each point to a crew member who was in this room tonight. Can you tell whose is whose?",
        target: "#chat-log",
    },
    {
        text: "Open the Timeline tab. It's your board for pinning where everyone was.",
        target: '[data-tab="board"]',
        done: ({ boardOpen }) => boardOpen,
    },
    {
        text: "Now question someone. Open Dr. Mara Okafor's tab and ask where she was tonight.",
        target: '[data-tab="okafor"]',
        allow: question("okafor-where"),
        done: ({ state }) => asked(state, "okafor-where"),
    },
    {
        text: "She says she was in the Medbay all evening. Test that: in the Evidence list, press Show on the Medical Stylus.",
        target: "#evidence-list",
        allow: showTo("okafor", "trace-okafor"),
        done: ({ state }) => shown(state, "okafor", "trace-okafor"),
    },
    {
        text: "Caught in a small lie: she visited the scene at 21:00. Ask her who else was there.",
        target: "#question-chips",
        allow: question("okafor-who-else"),
        done: ({ state }) => asked(state, "okafor-who-else"),
    },
    {
        text: "Pin it. On the Timeline, set Dr. Okafor and SABLE to the Hydroponics Bay at 21:00.",
        target: '[data-tab="board"]',
        allow: [...pin("okafor", 0), ...pin("sable", 0)],
        done: ({ state }) => pinned(state, "okafor", 0, "hydroponics") && pinned(state, "sable", 0, "hydroponics"),
    },
    {
        text: "Two visitors who saw each other are probably harmless. Now open Tomas Reyes's tab and show him the Coolant-Stained Glove.",
        target: '[data-tab="reyes"]',
        allow: showTo("reyes", "trace-reyes"),
        done: ({ state }) => shown(state, "reyes", "trace-reyes"),
    },
    {
        text: "Reyes claims he was there at 21:00 too, but Okafor said only SABLE was there. Somebody is lying. Go back to Okafor and ask if she saw anyone else this evening.",
        target: '[data-tab="okafor"]',
        allow: question("okafor-saw"),
        done: ({ state }) => asked(state, "okafor-saw"),
    },
    {
        text: "A witness! Reyes was in the Medbay at 21:30, carrying something wrapped in a cloth. Pin Reyes to the Medbay at 21:30 on the Timeline.",
        target: '[data-tab="board"]',
        allow: pin("reyes", 1),
        done: ({ state }) => pinned(state, "reyes", 1, "medbay"),
    },
    {
        text: "Now find a motive. Motives hide in cabins: the victim's records, or a suspect's belongings. Search Nair's Cabin.",
        target: "#room-list",
        allow: room("nair-cabin"),
        done: ({ state }) => searched(state, "nair-cabin"),
    },
    {
        text: "The Inspection Audit gives Reyes a reason. Show it to him.",
        target: '[data-tab="reyes"]',
        allow: showTo("reyes", "motive-reyes"),
        done: ({ state }) => shown(state, "reyes", "motive-reyes"),
    },
    {
        text: "Last piece: the weapon. Killers hide it right after the murder, so ask who was around at 22:30. Open SABLE's tab and ask if it saw anyone else this evening.",
        target: '[data-tab="sable"]',
        allow: question("sable-saw"),
        done: ({ state }) => asked(state, "sable-saw"),
    },
    {
        text: "SABLE saw Reyes in the Cargo Bay at 22:30, still holding something wrapped in a cloth. Search the Cargo Bay.",
        target: "#room-list",
        allow: room("cargo-bay"),
        done: ({ state }) => searched(state, "cargo-bay"),
    },
    {
        text: "Show Reyes the Neurotoxin Vial. Faced with his trace, his motive, and the weapon, he may crack.",
        target: "#evidence-list",
        allow: showTo("reyes", "weapon"),
        done: ({ state }) => shown(state, "reyes", "weapon"),
    },
    {
        text: "Make your accusation. Pick Reyes, then one piece of evidence for each: Opportunity, the Coolant-Stained Glove (it puts him at the scene). Motive, the Inspection Audit. Means, the Neurotoxin Vial.",
        target: "#accuse-btn",
        allow: ["#accuse-btn"],
        done: ({ state }) => state.verdict !== null,
    },
    {
        text: "That's the whole loop. Real cases have five suspects, you type your own questions to an AI, and innocent crew also hide secrets about where they were at the time of death. Evidence of a secret clears them.",
    },
];

// Steps without a check are acknowledged with Next. They also count as done once any later
// step is done, so a reload (or a player who runs ahead) never lands on stale instructions.
// Progress is a single index stored in the game state that only moves forward, one step at a time.
// A step's check is only consulted while it's the current step, so doing something early (like
// opening the Timeline tab) can never skip a step that comes before it.
export class Coach {
    private highlighted: Element | null = null;
    private shownIndex = -1;
    private scrolledAllowedFor = -1;
    private panel: HTMLElement;
    private onFinish: { daily: () => void; replay: () => void };

    constructor(panel: HTMLElement, onFinish: { daily: () => void; replay: () => void }) {
        this.panel = panel;
        this.onFinish = onFinish;

        const isLocked = (target: EventTarget | null) => {
            const control = (target as Element | null)?.closest?.(LOCKABLE);
            return !!control && document.body.classList.contains("tutorial-locked") && !control.classList.contains("coach-allowed");
        };
        // The CSS lock stops pointer clicks. These also stop programmatic and keyboard clicks,
        // and keyboard changes to a locked dropdown (arrow keys change a select without a click).
        document.addEventListener("click", (event) => {
            if (isLocked(event.target)) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Tab" && isLocked(event.target)) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);
        document.addEventListener("change", (event) => {
            if (isLocked(event.target)) event.stopPropagation();
        }, true);
    }

    render(ctx: CoachContext): void {
        const { state } = ctx;
        // Finishing the case ends training wherever the player is
        if (state.verdict) state.tutorialStep = STEPS.length - 1;
        // Advance past every step whose check is met, one at a time, in order
        while (state.tutorialStep < STEPS.length - 1 && STEPS[state.tutorialStep].done?.(ctx)) {
            state.tutorialStep++;
            ctx.save();
        }
        const i = Math.min(Math.max(state.tutorialStep, 0), STEPS.length - 1);
        const step = STEPS[i];
        const last = i === STEPS.length - 1;

        const actions: HTMLElement[] = [];
        if (last) {
            const replay = el("button", state.verdict && !this.solved(state) ? "primary-btn" : "text-btn", "Replay training");
            replay.type = "button";
            replay.addEventListener("click", this.onFinish.replay);
            const daily = el("button", "primary-btn", "Play today's case");
            daily.type = "button";
            daily.addEventListener("click", this.onFinish.daily);
            actions.push(replay, daily);
        } else if (!step.done) {
            const next = el("button", "primary-btn", "Next");
            next.type = "button";
            next.addEventListener("click", () => {
                // Only advance from the step this button was made for, so a double click moves one step
                if (state.tutorialStep !== i) return;
                state.tutorialStep = i + 1;
                ctx.save();
                this.render(ctx);
            });
            actions.push(next);
        }

        this.panel.hidden = false;
        this.panel.replaceChildren(
            el("p", "coach-step", `Training ${i + 1} of ${STEPS.length}`),
            el("p", "coach-text", last ? this.finalText(state) : step.text),
            el("div", "coach-actions", "", actions),
        );

        this.highlighted?.classList.remove("coach-target");
        this.highlighted = step.target ? document.querySelector(step.target) : null;
        this.highlighted?.classList.add("coach-target");
        // On a new step, bring what it points at into view (it can be off-screen on a phone)
        if (i !== this.shownIndex) {
            this.shownIndex = i;
            this.highlighted?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        // Lock every action control except this step's, until the final step frees everything
        document.body.classList.toggle("tutorial-locked", !last);
        document.querySelectorAll(".coach-allowed").forEach((node) => node.classList.remove("coach-allowed"));
        for (const selector of step.allow ?? []) {
            document.querySelectorAll(selector).forEach((node) => node.classList.add("coach-allowed"));
        }

        // On a phone the allowed control may sit below the fold too (e.g. the question chips)
        if (i !== this.scrolledAllowedFor) {
            const allowed = document.querySelector(".coach-allowed");
            if (allowed) {
                this.scrolledAllowedFor = i;
                const box = allowed.getBoundingClientRect();
                if (box.bottom > window.innerHeight || box.top < 0) allowed.scrollIntoView({ block: "center", behavior: "smooth" });
            }
        }
    }

    private solved(state: GameState): boolean {
        return state.verdict?.rank === "Master Investigator";
    }

    private finalText(state: GameState): string {
        const wrap = "Real cases have five suspects, you type your own questions to an AI, and innocent crew also hide secrets about where they were at the time of death. Evidence of a secret clears them.";
        if (!state.verdict || this.solved(state)) return `That's the whole loop. ${wrap}`;
        if (!state.verdict.correctCulprit) return "Not quite: Tomas Reyes was the killer. His glove put him at the scene, Okafor and SABLE never saw him there at 21:00, and both saw him carrying the vial. Replay training to try it again.";
        return "You got the killer, but not all of the proof. Opportunity was the Coolant-Stained Glove, motive the Inspection Audit, and means the Neurotoxin Vial. Replay training to try it again, or move on to a real case.";
    }
}
