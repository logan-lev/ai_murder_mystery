import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import type { Case, Clue, ClueID, RoomID, SuspectID } from "../case/types";
import type { Accusation, Verdict } from "./accuse";
import { buildSuspectPrompt } from "./prompt";

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
}

export function createGameState(c: Case): GameState {
    const conversations: Record<SuspectID, ChatCompletionMessageParam[]> = {};
    const shownClues: Record<SuspectID, Set<ClueID>> = {};

    for (const s of c.suspects) {
        conversations[s.id] = [];
        shownClues[s.id] = new Set();
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
        verdict: null
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
    return [
        {
            role: "system",
            content: buildSuspectPrompt(c, suspect, state.shownClues[suspectID], narrate, state.conversations[suspectID].length <= 1)
        },
        ...state.conversations[suspectID].slice(-MAX_HISTORY)
    ];
}
