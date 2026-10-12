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
}

export interface Suspect {
    id: SuspectID;
    name: string;
    role: string;
    personality: string;
    facts: string[];
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
    };
}