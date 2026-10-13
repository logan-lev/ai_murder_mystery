import type { Case, ClueID, SuspectID } from "../case/types";

// Without a cap, ticking every clue would always "prove" the case. Picking the right few is the skill.
export const MAX_ACCUSE_EVIDENCE = 3;

// Best to worst, used for the stats chart
export const RANKS = ["Master Investigator", "Sharp Inspector", "Lucky Guess", "Case Unsolved"] as const;

export interface Accusation {
    suspectID: SuspectID;
    motiveID: string;
    clueIDs: ClueID[];
}

export interface Verdict {
    correctCulprit: boolean;
    correctMotive: boolean;
    hasEvidence: boolean;
    rank: string;
    explanation: string;
}

export function scoreAccusation(c: Case, a: Accusation): Verdict {
    const correctCulprit = a.suspectID === c.solution.culpritID;
    const correctMotive = a.motiveID === c.solution.motiveID;
    const chosen = a.clueIDs.slice(0, MAX_ACCUSE_EVIDENCE);
    const hasEvidence = c.solution.requiredClueIDs.every((id) => chosen.includes(id));

    let rank: string;
    if (!correctCulprit) rank = "Case Unsolved";
    else if (correctMotive && hasEvidence) rank = "Master Investigator";
    else if (correctMotive || hasEvidence) rank = "Sharp Inspector";
    else rank = "Lucky Guess";

    return { correctCulprit, correctMotive, hasEvidence, rank, explanation: c.solution.explanation };
}