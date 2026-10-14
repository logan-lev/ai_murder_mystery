import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import type { Case, Clue, ClueID, RoomID, SuspectID } from "../case/types";
import type { Accusation, Verdict } from "./accuse";
import { buildSuspectPrompt } from "./prompt";
import { SLOTS } from "../case/content";
import { bluffReminders } from "./guard";

// Every search, question, or shown clue costs one turn. The storm clears when they run out.
export const TURN_LIMIT = 20;

// Older turns are dropped from what the model sees. Fewer messages means less prefill per reply.
// The system prompt (which holds every fact that matters) is always included in full.
const MAX_HISTORY = 8;

// What a turn was spent on. Stored in order, it doubles as the spoiler-free share grid.
export type ActionKind = "search-hit" | "search-miss" | "question" | "show";

export interface GameState {
    selectedRoomID: RoomID | null;
    searchedRoomIDs: Set<RoomID>;
    foundClueIDs: Set<ClueID>;
    activeSuspectID: SuspectID | null;
    conversations: Record<SuspectID, ChatCompletionMessageParam[]>;
    shownClues: Record<SuspectID, Set<ClueID>>;
    actions: ActionKind[];
    accusation: Accusation | null;
    verdict: Verdict | null;
    // The player's own timeline board: for each suspect, a pinned room ID (or "") per time slot
    board: Record<SuspectID, string[]>;
    // 1 for the first try. Retries don't count toward stats and are labeled when shared.
    attempt: number;
    // Training only: index of the coach step the player is on. Saved so a reload resumes in place.
    tutorialStep: number;
}

export function createGameState(c: Case): GameState {
    const conversations: Record<SuspectID, ChatCompletionMessageParam[]> = {};
    const shownClues: Record<SuspectID, Set<ClueID>> = {};
    const board: Record<SuspectID, string[]> = {};

    for (const s of c.suspects) {
        conversations[s.id] = [];
        shownClues[s.id] = new Set();
        board[s.id] = SLOTS.map(() => "");
    }
    return {
        selectedRoomID: null,
        searchedRoomIDs: new Set(),
        foundClueIDs: new Set(),
        activeSuspectID: null,
        conversations,
        shownClues,
        actions: [],
        accusation: null,
        verdict: null,
        board,
        attempt: 1,
        tutorialStep: 0
    };
}

export function turnsLeft(state: GameState): number {
    return Math.max(0, TURN_LIMIT - state.actions.length);
}

export function isOver(state: GameState): boolean {
    return state.verdict !== null;
}

// Returns only the newly found clues, so that the UI can announce them
export function searchRoom(state: GameState, c: Case, roomID: RoomID): Clue[] {
    if (state.searchedRoomIDs.has(roomID)) return [];
    state.searchedRoomIDs.add(roomID);
    const newClues = c.clues.filter((cl) => cl.roomID === roomID && !state.foundClueIDs.has(cl.id));
    for (const cl of newClues) state.foundClueIDs.add(cl.id);
    state.actions.push(newClues.length > 0 ? "search-hit" : "search-miss");
    return newClues;
}

// Returns false if the player doesn't have the clue or already showed it
export function showClue(state: GameState, suspectID: SuspectID, clueID: ClueID): boolean {
    if (!state.foundClueIDs.has(clueID)) return false;
    const shown = state.shownClues[suspectID];
    if (!shown || shown.has(clueID)) return false;
    shown.add(clueID);
    return true;
}

// The full message list to send for a suspect's next reply
export function buildMessages(state: GameState, c: Case, suspectID: SuspectID, narrate = false): ChatCompletionMessageParam[] {
    const suspect = c.suspects.find((s) => s.id === suspectID);
    if (!suspect) throw new Error(`Unknown Suspect: "${suspectID}"`);
    const convo = state.conversations[suspectID];
    const last = convo[convo.length - 1];
    const lastText = last?.role === "user" && typeof last.content === "string" ? last.content : "";
    const others = c.suspects.filter((s) => s.id !== suspectID).map((s) => s.name);
    return [
        {
            role: "system",
            content: buildSuspectPrompt(c, suspect, state.shownClues[suspectID], narrate, convo.length <= 1, bluffReminders(lastText, others))
        },
        ...state.conversations[suspectID].slice(-MAX_HISTORY)
    ];
}
