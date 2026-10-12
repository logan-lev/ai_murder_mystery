import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import type { Case, Clue, ClueID, RoomID, SuspectID } from "../case/types";
import { buildSuspectPrompt } from "./prompt";

export interface GameState {
    currentRoomID: RoomID | null;
    searchedRoomIDs: Set<RoomID>;
    foundClueIDs: Set<ClueID>;
    activeSuspectID: SuspectID | null;
    conversations: Record<SuspectID, ChatCompletionMessageParam[]>;
    shownClues: Record<SuspectID, Set<ClueID>>;
}

export function createGameState(c: Case): GameState {
    const conversations: Record<SuspectID, ChatCompletionMessageParam[]> = {};
    const shownClues: Record<SuspectID, Set<ClueID>> = {};

    for (const s of c.suspects) {
        conversations[s.id] = [];
        shownClues[s.id] = new Set();
    }
    return {
        currentRoomID: null,
        searchedRoomIDs: new Set(),
        foundClueIDs: new Set(),
        activeSuspectID: null,
        conversations,
        shownClues
    };
}

// Returns only the newly found clues, so that the UI can announce them
export function searchRoom(state: GameState, c: Case, roomID: RoomID): Clue[] {
    state.searchedRoomIDs.add(roomID);
    const newClues = c.clues.filter((cl) => cl.roomID === roomID && !state.foundClueIDs.has(cl.id));
    for (const cl of newClues) state.foundClueIDs.add(cl.id);
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
export function buildMessages(state: GameState, c: Case, suspectID: SuspectID): ChatCompletionMessageParam[] {
    const suspect = c.suspects.find((s) => s.id === suspectID);
    if (!suspect) throw new Error(`Unknown Suspect: "${suspectID}`);
    return [
        {
            role: "system",
            content: buildSuspectPrompt(c, suspect, state.shownClues[suspectID])
        },
        ...state.conversations[suspectID]
    ];
}