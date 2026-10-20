// The training coach: the yellow sticky note that walks a new player through the training case,
// one step at a time. Each step explains why, says exactly what to do, highlights where, and locks
// every other action control so the player can't get ahead of the lesson.

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

export interface Step {
    // Why this step matters, in plain words
    text: string;
    // The one thing to do now, shown on its own line so new players know exactly what to click
    todo?: string;
    // Selectors to highlight, in priority order; the first one that's visible wins. Listing the tab
    // first (with :not(.active)) points at the tab until it's open, then at the control inside it.
    target?: string[];
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
    return convo.some(
        (m, i) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes(`shows you the ${name}:`) &&
            convo[i + 1]?.role === "assistant",
    );
};
const searched = (s: GameState, roomID: string) => s.searchedRoomIDs.has(roomID);
const pinned = (s: GameState, suspectID: SuspectID, slot: number, roomID: string) =>
    s.board[suspectID]?.[slot] === roomID;

export const STEPS: Step[] = [
    {
        text: "A crew member named Priya Nair has been killed, and your job is to find out who did it. This yellow note walks you through it one step at a time. Whatever you need to click is outlined in red. Nothing in training counts toward your stats.",
        todo: "Press Next.",
        target: ["#coach"],
    },
    {
        text: "First, read the briefing in the search log below. It tells you who died and where.",
        todo: "Read the briefing, then press Next.",
        target: ["#search-log"],
    },
    {
        text: "This bar shows how many turns you have left. Searching a room, asking a question, or showing evidence each uses up one turn. When the turns run out, you have to name the killer.",
        todo: "Press Next.",
        target: ["#storm"],
    },
    {
        text: "Start where the body was found: the Hydroponics Bay.",
        todo: "In the Rooms list, click Hydroponics Bay, then click Search this room.",
        target: ['[data-tab="station"]:not(.active)', '.room-chip[data-room="hydroponics"]'],
        allow: room("hydroponics"),
        done: ({ state }) => searched(state, "hydroponics"),
    },
    {
        text: "You found four things. They're listed here and saved in the Evidence tab. The Body tells you when Priya died: 22:00, but it doesn't point to anyone.\n\nThe other three items were dropped by three different crew members, so all three were in this room tonight.\n\nA medical stylus belongs to the doctor, Okafor. A coolant-stained glove belongs to the engineer, Reyes. A flake of synthetic skin belongs to the android, SABLE. One of them is the killer.",
        todo: "Press Next.",
        target: ["#search-log"],
    },
    {
        text: "The Timeline tab is your notepad for where everyone was at each time. You'll fill it in as you learn things.",
        todo: "Click the Timeline tab.",
        target: ['[data-tab="timeline"]'],
        done: ({ boardOpen }) => boardOpen,
    },
    {
        text: "Now talk to a suspect. Each crew member has their own tab. In training you pick questions from buttons; in real cases you type them.",
        todo: 'Click Dr. Okafor\'s tab, then click "Where were you tonight?"',
        target: ['[data-tab="okafor"]:not(.active)', "#question-chips"],
        allow: question("okafor-where"),
        done: ({ state }) => asked(state, "okafor-where"),
    },
    {
        text: "She says she never left the Medbay. But her stylus was found next to the body. Showing someone evidence makes them respond to it.",
        todo: "Under the conversation, click Medical Stylus to show it to her.",
        target: ['[data-tab="okafor"]:not(.active)', "#evidence-tray"],
        allow: showTo("okafor", "trace-okafor"),
        done: ({ state }) => shown(state, "okafor", "trace-okafor"),
    },
    {
        text: "Now she admits she was there at 21:00. So her first answer was a lie.",
        todo: 'Click "Why did you lie?"',
        target: ['[data-tab="okafor"]:not(.active)', "#question-chips"],
        allow: question("okafor-why-lie"),
        done: ({ state }) => asked(state, "okafor-why-lie"),
    },
    {
        text: "Innocent people lie too, usually to avoid looking guilty. A lie doesn't prove someone is the killer. It tells you to dig deeper.",
        todo: 'Click "Who else was in the Hydroponics Bay at 21:00?"',
        target: ['[data-tab="okafor"]:not(.active)', "#question-chips"],
        allow: question("okafor-who-else"),
        done: ({ state }) => asked(state, "okafor-who-else"),
    },
    {
        text: "Okafor and SABLE were both there at 21:00, and they saw each other. Write that down.",
        todo: "Click the Timeline tab. In the 21:00 column, set Dr. Okafor and SABLE to Hydroponics Bay.",
        target: ['[data-tab="timeline"]:not(.active)', "#board"],
        allow: [...pin("okafor", 0), ...pin("sable", 0)],
        done: ({ state }) => pinned(state, "okafor", 0, "hydroponics") && pinned(state, "sable", 0, "hydroponics"),
    },
    {
        text: "Two people who saw each other there are probably telling the truth. Now check the third item.",
        todo: "Click Tomas Reyes's tab, then click Coolant-Stained Glove under the conversation.",
        target: ['[data-tab="reyes"]:not(.active)', "#evidence-tray"],
        allow: showTo("reyes", "trace-reyes"),
        done: ({ state }) => shown(state, "reyes", "trace-reyes"),
    },
    {
        text: "Reyes says he was there at 21:00 too. But Okafor said only SABLE was there with her. Someone is lying.",
        todo: 'Go back to Dr. Okafor\'s tab and click "Did you see anyone else this evening?"',
        target: ['[data-tab="okafor"]:not(.active)', "#question-chips"],
        allow: question("okafor-saw"),
        done: ({ state }) => asked(state, "okafor-saw"),
    },
    {
        text: "Okafor saw Reyes in the Medbay at 21:30, holding something small. The Medbay is where the poison is kept.",
        todo: "Click the Timeline tab. In the 21:30 column, set Tomas Reyes to Medbay.",
        target: ['[data-tab="timeline"]:not(.active)', "#board"],
        allow: pin("reyes", 1),
        done: ({ state }) => pinned(state, "reyes", 1, "medbay"),
    },
    {
        text: "Real cases have one more layer. At the time of death (22:00), innocent people are often hiding something unrelated, so they lie about where they were. Uncovering their secret proves they didn't do it.",
        todo: 'Click SABLE\'s tab, then click "Where exactly were you at 22:00?"',
        target: ['[data-tab="sable"]:not(.active)', "#question-chips"],
        allow: question("sable-2200"),
        done: ({ state }) => asked(state, "sable-2200"),
    },
    {
        text: "SABLE said \"Mostly.\" That small word means it's hiding something. Secrets leave evidence too, often in the person's own room.",
        todo: "Click the Station tab, then search SABLE's Charging Alcove.",
        target: ['[data-tab="station"]:not(.active)', "#room-list"],
        allow: room("sable-alcove"),
        done: ({ state }) => searched(state, "sable-alcove"),
    },
    {
        text: "You found a recording made from the Observation Deck at 22:00, when SABLE said it was in the Galley.",
        todo: "Click SABLE's tab, then click Ring Recording under the conversation.",
        target: ['[data-tab="sable"]:not(.active)', "#evidence-tray"],
        allow: showTo("sable", "secret-sable"),
        done: ({ state }) => shown(state, "sable", "secret-sable"),
    },
    {
        text: "SABLE was secretly on the Observation Deck at 22:00, far from the body. It lied, but not about murder. That clears SABLE.",
        todo: "Click the Timeline tab. In the 22:00 column, set SABLE to Observation Deck.",
        target: ['[data-tab="timeline"]:not(.active)', "#board"],
        allow: pin("sable", 2),
        done: ({ state }) => pinned(state, "sable", 2, "observation"),
    },
    {
        text: "Now find out why Reyes would do it. Reasons, called motives, are found in cabins: the victim's papers or the suspect's own belongings.",
        todo: "Click the Station tab, then search Nair's Cabin.",
        target: ['[data-tab="station"]:not(.active)', "#room-list"],
        allow: room("nair-cabin"),
        done: ({ state }) => searched(state, "nair-cabin"),
    },
    {
        text: "The Inspection Audit shows Priya was about to report Reyes for faking safety checks. That's his motive.",
        todo: "Click Reyes's tab, then click Inspection Audit under the conversation.",
        target: ['[data-tab="reyes"]:not(.active)', "#evidence-tray"],
        allow: showTo("reyes", "motive-reyes"),
        done: ({ state }) => shown(state, "reyes", "motive-reyes"),
    },
    {
        text: "Last, the weapon. The killer hid it right after the murder, around 22:30, and someone may have seen where.",
        todo: 'Click SABLE\'s tab, then click "Did you see anyone else this evening?"',
        target: ['[data-tab="sable"]:not(.active)', "#question-chips"],
        allow: question("sable-saw"),
        done: ({ state }) => asked(state, "sable-saw"),
    },
    {
        text: "SABLE saw Reyes in the Cargo Bay at 22:30, still holding something small. That's where the weapon is.",
        todo: "Click the Station tab, then search the Cargo Bay.",
        target: ['[data-tab="station"]:not(.active)', "#room-list"],
        allow: room("cargo-bay"),
        done: ({ state }) => searched(state, "cargo-bay"),
    },
    {
        text: "You now have all three: proof Reyes was there, why he did it, and what he used. See how he reacts.",
        todo: "Click Reyes's tab, then click Neurotoxin Vial under the conversation.",
        target: ['[data-tab="reyes"]:not(.active)', "#evidence-tray"],
        allow: showTo("reyes", "weapon"),
        done: ({ state }) => shown(state, "reyes", "weapon"),
    },
    {
        text: "Time to name the killer. Back it up with three pieces of evidence: Opportunity (proof they were there), Motive (why), and Means (the weapon).",
        todo: "Click Accuse. Choose Tomas Reyes. Pick Coolant-Stained Glove for Opportunity, Inspection Audit for Motive, and Neurotoxin Vial for Means. Then click Accuse at the bottom.",
        target: ["#accuse-btn"],
        allow: ["#accuse-btn"],
        done: ({ state }) => state.verdict !== null,
    },
    {
        text: "That's the whole loop. Real cases have five suspects and you type your own questions to an AI.",
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
            return (
                !!control &&
                document.body.classList.contains("tutorial-locked") &&
                !control.classList.contains("coach-allowed")
            );
        };
        // The CSS lock stops pointer clicks. These also stop programmatic and keyboard clicks,
        // and keyboard changes to a locked dropdown (arrow keys change a select without a click).
        document.addEventListener(
            "click",
            (event) => {
                if (isLocked(event.target)) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            true,
        );
        document.addEventListener(
            "keydown",
            (event) => {
                if (event.key !== "Tab" && isLocked(event.target)) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            true,
        );
        document.addEventListener(
            "change",
            (event) => {
                if (isLocked(event.target)) event.stopPropagation();
            },
            true,
        );
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
            const replay = el(
                "button",
                state.verdict && !this.solved(state) ? "primary-btn" : "text-btn",
                "Replay training",
            );
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
            // "\n\n" in a step's text starts a new paragraph, so long explanations come in small pieces
            ...(last ? this.finalText(state) : step.text).split("\n\n").map((para) => el("p", "coach-text", para)),
            ...(step.todo && !last ? [el("p", "coach-todo", "", [el("strong", "", "Do this: "), step.todo])] : []),
            el("div", "coach-actions", "", actions),
        );

        this.highlighted?.classList.remove("coach-target");
        this.highlighted = this.firstVisible(step.target ?? []);
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
                if (box.bottom > window.innerHeight || box.top < 0)
                    allowed.scrollIntoView({ block: "center", behavior: "smooth" });
            }
        }
    }

    private firstVisible(selectors: string[]): Element | null {
        for (const selector of selectors) {
            const node = [...document.querySelectorAll<HTMLElement>(selector)].find((n) => n.offsetParent !== null);
            if (node) return node;
        }
        return null;
    }

    private solved(state: GameState): boolean {
        return state.verdict?.rank === "Master Investigator";
    }

    private finalText(state: GameState): string {
        const wrap =
            "Real cases have five suspects and you type your own questions to an AI. Every innocent hides a secret like SABLE's about the time of death, and proving it clears them.";
        if (!state.verdict || this.solved(state)) return `That's the whole loop. ${wrap}`;
        if (!state.verdict.correctCulprit)
            return "Not quite: Tomas Reyes was the killer. His glove put him at the scene, Okafor and SABLE never saw him there at 21:00, and both saw him carrying the vial. Replay training to try it again.";
        return "You got the killer, but not all of the proof. Opportunity was the Coolant-Stained Glove, motive the Inspection Audit, and means the Neurotoxin Vial. Replay training to try it again, or move on to a real case.";
    }
}
