export type RoomID = string;
export type ClueID = string;
export type SuspectID = string;

export interface Room {
    id: RoomID;
    name: string;
    description: string;
}

export interface Clue {
    id: ClueID;
    name: string;
    roomID: RoomID;
    description: string;
}

export interface Unlock {
    requires: ClueID[];
    reveals: string;
    // Replaces part of the suspect's cover story once unlocked, e.g. "At 22:00 you were actually in the airlock."
    // Without this, "always stick to this story" outweighs the admission and the model reverts to the lie.
    storyChange?: string;
    // The suspect stops lying entirely: the cover story and scripted reactions are dropped from the prompt
    confession?: boolean;
}

export interface Suspect {
    id: SuspectID;
    name: string;
    shortName: string;
    pronouns: { he: string; his: string };
    role: string;
    personality: string;
    facts: string[];
    post: string;
    story: string;
    reactions: string[];
    unlocks: Unlock[];
}

export interface Motive {
    id: string;
    label: string;
}

export interface Case {
    id: string;
    title: string;
    setting: string;
    victim: string;
    victimID: string;
    sceneRoomID: RoomID;
    intro: string;
    sharedFacts: string[];
    rooms: Room[];
    clues: Clue[];
    suspects: Suspect[];
    motives: Motive[];
    solution: {
        culpritID: SuspectID;
        motiveID: string;
        requiredClueIDs: ClueID[];
        explanation: string;
        // The chain of reasoning that cracks this case, shown on the ending screen
        howToSolve: string[];
    };
}