// The training case and its scripted conversation. Written by hand rather than generated, so the
// coach (coach.ts) can teach with exact answers and no AI is needed.

import type { Case, Clue, Room, Suspect, SuspectID, ClueID } from "../case/types";
import type { Truth } from "../case/generate";
import { CHARACTERS, STATION_ROOMS, SETTING } from "../case/content";

// A hand-built training case. Its logic is a small version of a generated case:
// one killer and two harmless visitors who vouch for each other, a witness who saw the weapon,
// a motive in the victim's cabin, and a hidden weapon. It needs no AI: every answer is scripted.

const character = (id: string) => CHARACTERS.find((c) => c.id === id)!;
const stationRoom = (id: string) => STATION_ROOMS.find((r) => r.id === id)!;

const nair = character("nair");
const ROOMS: Room[] = [
    {
        ...stationRoom("hydroponics"),
        description: `${stationRoom("hydroponics").description} Priya Nair's body lies here.`,
    },
    stationRoom("medbay"),
    stationRoom("engineering"),
    stationRoom("galley"),
    stationRoom("cargo-bay"),
    stationRoom("observation"),
    nair.cabin,
    character("reyes").cabin,
    character("sable").cabin,
];

const CLUES: Clue[] = [
    {
        id: "body",
        name: "The Body",
        roomID: "hydroponics",
        description:
            "Nair is slumped against a grow-tray beside a cold cup of tea, her lips tinged blue. Her wrist monitor recorded her heart stopping at 22:00.",
    },
    {
        id: "trace-okafor",
        name: "Medical Stylus",
        roomID: "hydroponics",
        description:
            "Found in the Hydroponics Bay: a medical stylus from the medbay, still smelling faintly of antiseptic.",
    },
    {
        id: "trace-reyes",
        name: "Coolant-Stained Glove",
        roomID: "hydroponics",
        description: "Found in the Hydroponics Bay: a heavy work glove stained with blue reactor coolant.",
    },
    {
        id: "trace-sable",
        name: "Synthetic Skin Fleck",
        roomID: "hydroponics",
        description: "Found in the Hydroponics Bay: a fleck of pale synthetic skin.",
    },
    {
        id: "motive-reyes",
        name: "Inspection Audit",
        roomID: "nair-cabin",
        description:
            "An audit compiled by Nair proving the last three reactor safety inspections were falsified and signed off by Reyes.",
    },
    {
        id: "motive-okafor",
        name: "Draft Incident Report",
        roomID: "nair-cabin",
        description:
            "A draft incident report by Nair concluding that Dr. Okafor's error caused a crew member's death last year.",
    },
    {
        id: "secret-sable",
        name: "Ring Recording",
        roomID: "sable-alcove",
        description:
            "A data crystal holding a recording of Kharon's rings, made from the Observation Deck at 22:00. SABLE was supposed to be on duty in the Galley.",
    },
    {
        id: "weapon",
        name: "Neurotoxin Vial",
        roomID: "cargo-bay",
        description:
            "An empty neurotoxin vial from the medbay's locked cabinet, wrapped in a cloth and tucked behind a crate.",
    },
];

// Suspect prompts are never sent to a model in the tutorial, but the type needs them filled in
const suspect = (id: string, post: string): Suspect => {
    const c = character(id);
    return {
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        pronouns: { he: c.pronouns.he, his: c.pronouns.his },
        role: c.role,
        personality: c.personality,
        facts: c.facts,
        post,
        story: `You were working alone in the ${post} from 21:00 until the body was found at 23:00.`,
        reactions: [],
        unlocks: [],
    };
};

export const TUTORIAL_CASE: Case = {
    id: "tutorial",
    title: "Dead Orbit: Training",
    setting: SETTING,
    victim: nair.name,
    victimID: nair.id,
    sceneRoomID: "hydroponics",
    intro: "Training case. 23:00 station time. Priya Nair, the station botanist, has been found dead in the Hydroponics Bay. Three crew members are aboard: Dr. Okafor, Tomas Reyes, and SABLE. One of them did it. The yellow note above will walk you through how to find out who.",
    sharedFacts: [],
    rooms: ROOMS,
    clues: CLUES,
    suspects: [suspect("okafor", "Medbay"), suspect("reyes", "Engineering Bay"), suspect("sable", "Galley")],
    solution: {
        culpritID: "reyes",
        proof: { opportunity: "trace-reyes", motive: "motive-reyes", means: "weapon" },
        explanation:
            "Tomas Reyes killed Priya Nair in the Hydroponics Bay at 22:00. Motive: exposure of faked safety inspections. The weapon, a neurotoxin vial, was hidden in the Cargo Bay. Dr. Mara Okafor and SABLE left traces too, but only from a harmless visit at 21:00.",
        howToSolve: [
            "The Hydroponics Bay held three traces. Dr. Okafor and SABLE visited at 21:00 and saw each other there, so theirs were harmless.",
            "The coolant-stained glove pointed to Tomas Reyes, who claimed the same 21:00 visit, but neither visitor saw him there.",
            "Dr. Okafor saw Reyes in the Medbay at 21:30, clutching something small: the neurotoxin, before the murder.",
            "SABLE saw Reyes in the Cargo Bay at 22:30, right after the murder, still clutching it. That's where the weapon was hidden.",
            "Reyes's motive was in Nair's Cabin: the Inspection Audit.",
            "SABLE lied about 22:00 too: it was secretly recording Kharon's rings on the Observation Deck (proof: the Ring Recording in SABLE's Charging Alcove). A proven secret clears an innocent.",
        ],
    },
};

export const TUTORIAL_TRUTH: Truth = {
    seed: 0,
    victimID: "nair",
    culpritID: "reyes",
    methodID: "neurotoxin",
    hideRoom: "cargo-bay",
    murderTime: "22:00",
    redHerringIDs: ["okafor", "sable"],
    timeline: {
        okafor: ["hydroponics", "medbay", "medbay", "medbay"],
        reyes: ["engineering", "medbay", "hydroponics", "cargo-bay"],
        sable: ["hydroponics", "galley", "observation", "cargo-bay"],
    },
};

// ---------- Scripted conversation ----------

export interface ScriptedQuestion {
    id: string;
    text: string;
    answer: string;
    // Only offered once these clues have been shown to this suspect
    afterShown?: ClueID[];
    // Only offered once these questions (by id, to anyone) have been asked
    afterAsked?: string[];
}

export interface ScriptedShow {
    clueID: ClueID;
    answer: string;
    // This version is used only if these clues were already shown to the same suspect
    afterShown?: ClueID[];
}

export const QUESTIONS: Record<SuspectID, ScriptedQuestion[]> = {
    okafor: [
        {
            id: "okafor-where",
            text: "Where were you tonight?",
            answer: "[Okafor folds her hands neatly.] In the Medbay, working, from 21:00 until we found Priya.",
        },
        {
            id: "okafor-why-lie",
            text: "You told me you were in the Medbay all evening. Why did you lie?",
            answer: "[Okafor exhales slowly.] Because Priya and I argued at 21:00, and I knew how it would look if I was the last one seen with her. It was stupid. But I didn't hurt Priya.",
            afterShown: ["trace-okafor"],
        },
        {
            id: "okafor-who-else",
            text: "Who else was in the Hydroponics Bay at 21:00?",
            answer: "Only SABLE. It was bringing Priya her tea. Nobody else came in while I was there.",
            afterShown: ["trace-okafor"],
        },
        {
            id: "okafor-saw",
            text: "Did you see anyone else this evening?",
            answer: "Tomas Reyes came into the Medbay at 21:30. He was clutching something small in one closed hand, and he left without saying a word.",
        },
    ],
    reyes: [
        {
            id: "reyes-where",
            text: "Where were you tonight?",
            answer: "[Reyes wipes his hands on a rag.] In Engineering. All night. The reactor doesn't babysit itself.",
        },
        {
            id: "reyes-hydroponics",
            text: "Did you go to the Hydroponics Bay tonight?",
            answer: "No. Why would I?",
        },
        {
            id: "reyes-nobody-saw",
            text: "Okafor and SABLE were there at 21:00, and neither of them saw you.",
            answer: "Then they weren't paying attention. I was in and out.",
            afterShown: ["trace-reyes"],
        },
        {
            id: "reyes-carrying",
            text: "Okafor saw you in the Medbay at 21:30, clutching something in your hand.",
            answer: "A spare part. I borrow things. That's all.",
            afterAsked: ["okafor-saw"],
        },
        {
            id: "reyes-cargo",
            text: "SABLE saw you in the Cargo Bay at 22:30. What were you doing there?",
            answer: "Looking for a coolant valve. Is that a crime now?",
            afterAsked: ["sable-saw"],
        },
    ],
    sable: [
        {
            id: "sable-where",
            text: "Where were you tonight?",
            answer: "[SABLE tilts its head politely.] In the Galley, from 21:00 until the body was found.",
        },
        {
            id: "sable-2200",
            text: "Where exactly were you at 22:00?",
            answer: "[SABLE pauses for a fraction of a second.] In the Galley. Mostly.",
        },
        {
            id: "sable-who-else",
            text: "Who else was in the Hydroponics Bay at 21:00?",
            answer: "Dr. Okafor. No one else was present.",
            afterShown: ["trace-sable"],
        },
        {
            id: "sable-saw",
            text: "Did you see anyone else this evening?",
            answer: "At 22:30 I collected supplies from the Cargo Bay. Tomas Reyes was there, clutching something small in one closed hand. He told me to mind my own business.",
        },
    ],
};

export const SHOWS: Record<SuspectID, ScriptedShow[]> = {
    okafor: [
        {
            clueID: "trace-okafor",
            answer: "[Okafor glances at the stylus.] That's mine. I stopped by the Hydroponics Bay at 21:00 to check on Priya. Priya was alive, and in a foul mood, when I left.",
        },
        {
            clueID: "motive-okafor",
            answer: "[Okafor's jaw tightens.] Yes. Priya found out about my mistake last year and was going to report it. But I didn't kill Priya.",
        },
        {
            clueID: "weapon",
            answer: "[Okafor frowns at the vial.] That's from my Medbay cabinet. Someone took it without signing it out.",
        },
    ],
    reyes: [
        {
            clueID: "trace-reyes",
            answer: "[Reyes stares at the glove.] Fine, that's mine. I dropped by the Hydroponics Bay at 21:00 to fix a pump. Priya was alive when I left.",
        },
        {
            clueID: "motive-reyes",
            answer: "[Reyes crosses his arms.] So the inspections were a little creative. That's not murder.",
        },
        {
            clueID: "weapon",
            afterShown: ["trace-reyes", "motive-reyes"],
            answer: "[Reyes's shoulders sag.] All right. Priya was going to report the inspections, and I'd have lost everything. I took the vial from the Medbay, put it in Priya's tea, and hid it in the Cargo Bay.",
        },
        { clueID: "weapon", answer: "[Reyes barely looks at it.] Never seen it before." },
        { clueID: "body", answer: "[Reyes looks away.] I don't need to see that." },
    ],
    sable: [
        {
            clueID: "trace-sable",
            answer: "[SABLE examines the fleck.] That is mine. I delivered tea to the Hydroponics Bay at 21:00. Dr. Okafor was also there. Priya was alive when I left.",
        },
        { clueID: "weapon", answer: "[SABLE regards the vial.] I do not recognize this object." },
        {
            clueID: "secret-sable",
            answer: "[SABLE lowers its head.] I left my post at 22:00 to record the rings from the Observation Deck. Stewards are not permitted to. I lied because I did not wish to be reported. I saw no one there.",
        },
    ],
};

export const SHOW_FALLBACK = "I don't know anything about that.";

// A question counts once it has been answered, not when it's clicked, so the coach never moves on
// while the reply is still arriving (and a reload mid-reply can't skip it)
export function isAsked(
    state: { conversations: Record<string, { role: string; content?: unknown }[]> },
    questionID: string,
): boolean {
    for (const [suspectID, list] of Object.entries(QUESTIONS)) {
        const q = list.find((x) => x.id === questionID);
        if (!q) continue;
        const convo = state.conversations[suspectID] ?? [];
        return convo.some((m, i) => m.role === "user" && m.content === q.text && convo[i + 1]?.role === "assistant");
    }
    return false;
}
