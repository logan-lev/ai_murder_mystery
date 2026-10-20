// Scoring an accusation: the right killer, plus one piece of evidence each for opportunity, motive,
// and means. Three correct is Master Investigator; the wrong killer is always Case Unsolved.

import type { Case, ClueID, SuspectID } from "../case/types";

// Best to worst, used for the stats chart
export const RANKS = ["Master Investigator", "Sharp Inspector", "Lucky Guess", "Case Unsolved"] as const;

// The classic case for the prosecution: one piece of evidence for each.
// Each slot has exactly one right answer, so there's nothing to gain from guessing broadly.
export const PROOF_SLOTS = [
    { key: "opportunity", label: "Opportunity", question: "What puts them at the scene?" },
    { key: "motive", label: "Motive", question: "What gave them a reason?" },
    { key: "means", label: "Means", question: "What did they use?" },
] as const;

export type ProofKey = (typeof PROOF_SLOTS)[number]["key"];
export type Proof = Record<ProofKey, ClueID | "">;

export interface Accusation {
    suspectID: SuspectID;
    proof: Proof;
}

export interface Verdict {
    correctCulprit: boolean;
    correctProof: Record<ProofKey, boolean>;
    rank: string;
    explanation: string;
}

export function scoreAccusation(c: Case, a: Accusation): Verdict {
    const correctCulprit = a.suspectID === c.solution.culpritID;
    const correctProof = {
        opportunity: a.proof.opportunity === c.solution.proof.opportunity,
        motive: a.proof.motive === c.solution.proof.motive,
        means: a.proof.means === c.solution.proof.means,
    };
    const proven = Object.values(correctProof).filter(Boolean).length;

    let rank: string;
    if (!correctCulprit) rank = "Case Unsolved";
    else if (proven === 3) rank = "Master Investigator";
    else if (proven === 2) rank = "Sharp Inspector";
    else rank = "Lucky Guess";

    return { correctCulprit, correctProof, rank, explanation: c.solution.explanation };
}
