import type { Case, ClueID, SuspectID } from "../case/types";

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
    const hasEvidence = c.solution.requiredClueIDs.every((id) => a.clueIDs.includes(id));

    let rank: string;
    if (!correctCulprit) rank = "Case Unsolved";
    else if (correctMotive && hasEvidence) rank = "Master Investigator";
    else if (correctMotive || hasEvidence) rank = "Sharp Inspector";
    else rank = "Lucky Guess";

    return { correctCulprit, correctMotive, hasEvidence, rank, explanation: c.solution.explanation };
}