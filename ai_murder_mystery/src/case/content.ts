import type { Room, RoomID } from "./types";

export const TITLE = "Dead Orbit";
export const SETTING = "Erebus Station";
export const VICTIM = "Commander Idris Vale";

export const INTRO = "23:00 station time. Commander Idris Vale has been found dead in his office aboard Erebus Station, a research outpost orbiting gas giant Kharon. An ion storm has cut all communications and no ship can dock until it passes. You arrived on the last shuttle before the storm. Search the station, question the crew, and identify the killer before the storm clears.";

export const SLOTS = ["21:00", "21:30", "22:00", "22:30"];

export const SHARED_FACTS = [
    "Commander Idris Vale was found dead in his office at 23:00 station time tonight.",
    "He ate dinner alone in his office at 20:00 as he usually does.",
    "Aboard the station tonight: Dr. Mara Okafor, Chief Medical Officer; Tomas Reyes, Chief Engineer; Lieutenant Juno Park, Security Officer; SABLE, the station's android steward. No one else is aboard.",
    "An ion storm has cut off communications, and no ship can dock until it passes.",
    "The storm knocked out all security cameras at 20:30. There is no camera footage of anything after that.",
];

export const ROOMS: Room[] = [
    {
        id: "office",
        name: "Commander's Office",
        description: "A cramped office with a viewport onto Kharon's swirling storms. The Commander's body lies here."
    },
    {
        id: "medbay",
        name: "Medbay",
        description: "Sterile white surfaces, a diagnostic bed, and locked drug cabinets."
    },
    {
        id: "engineering",
        name: "Engineering",
        description: "The humming reactor core, tool racks, and walls of blinking panels."
    },
    {
        id: "security",
        name: "Security Office",
        description: "Dead camera monitors, a weapons locker, and an empty holding cell."
    },
    {
        id: "galley",
        name: "Galley",
        description: "Food printers, a long steel table, and the smell of synthetic coffee."
    },
    {
        id: "hydroponics",
        name: "Hydroponics Bay",
        description: "Rows of glowing grow-trays holding the only real plants for a billion kilometers."
    },
    {
        id: "cargo-bay",
        name: "Cargo Bay",
        description: "Stacked supply crates under flickering lights."
    },
    {
        id: "observation",
        name: "Observation Deck",
        description: "A dome of reinforced glass with breathtaking view of Kharon's rings."
    },
    {
        id: "comms",
        name: "Comms Array",
        description: "Antenna controls and a transmitter silenced by the ion storm."
    },
    {
        id: "rec-room",
        name: "Recreation Deck",
        description: "A VR rig, a battered couch, and a zero-g handball court."
    },
    {
        id: "airlock",
        name: "Airlock B",
        description: "The station's EVA airlock, with spacesuits racked along the wall."
    },
    {
        id: "okafor-cabin",
        name: "Okafor's Cabin",
        description: "Neatly organized, with medical journals stacked by the bunk."
    },
    {
        id: "reyes-cabin",
        name: "Reyes's Cabin",
        description: "Tools everywhere, a half-built gadget, and a photo of a girl on Callisto."
    },
    {
        id: "park-cabin",
        name: "Park's Cabin",
        description: "Spartan and spotless, with a framed military citation on the wall."
    },
    {
        id: "sable-alcove",
        name: "SABLE's Charging Alchove",
        description: "A small recess with a charging cradle and a shelf of carefully arranged trinkets."
    }
];

export interface MotiveDef {
    id: string;
    label: string;
    reason: string;
    clueName: string;
    clueRoom: RoomID;
    clueDescription: string;
}

export interface CharacterDef {
    id: string;
    name: string;
    role: string;
    personality: string;
    homeRoom: RoomID;
    cabin: RoomID;
    facts: string[];
    traceName: string;
    trace: string;
    motives: MotiveDef[];
}

export interface MethodDef {
    id: string;
    weaponName: string;
    weaponRoom: RoomID;
    hideRooms: RoomID[];
    body: string;
    hidden: string;
    confession: string;
}

export interface SecretDef {
    id: string;
    room: RoomID | "exterior";
    activity: string;
    clueName: string;
    clueRoom: RoomID | "own-cabin";
    clueDescription: string;
}

export const CHARACTERS: CharacterDef[] = [
    {
        id: "okafor",
        name: "Dr. Mara Okafor",
        role: "The Chief Medical Officer",
        personality: "Calm, clinical, and quietly ambitious. Chooses her words carefully and rarely shows emotion.",
        homeRoom: "medbay",
        cabin: "okafor-cabin",
        facts: [
            "You have served on Erebus Station for four years.",
            "You ran routine crew health checks this afternoon."
        ],
        traceName: "Engraved Stylus",
        trace: "A medical stylus engraved with the name 'Dr. M. Okafor'.",
        motives: [
            {
                id: "malpractice",
                label: "Cover Up Of A Fatal Medical Error",
                reason: "Commander Vale discovered that a crew member died last year because of your mistake, and he was filing a report.",
                clueName: "Incident Report",
                clueRoom: "office",
                clueDescription: "A draft incident report by Commander Vale concluding that Dr. Okafor's error caused a crew member's death last year."
            },
            {
                id: "research-theft",
                label: "Stolen Research",
                reason: "Commander Vale was selling your research to a corporation under his own name.",
                clueName: "Research Contract",
                clueRoom: "okarfor-cabin",
                clueDescription: "A copy of a contract selling Dr. Okafor's research to Helix Corp, signed by Commander Vale alone, with angry notes in the margins."
            }
        ]
    },
    {
        id: "reyes",
        name: "Tomas Reyes",
        role: "The Chief Engineer",
        personality: "Gruff, sarcastic, and fiercely protective of his reactor. Hides nerves behind jokes.",
        homeRoom: "engineering",
        cabin: "reyes-cabin",
        facts: [
            "You have kept this station running for six years.",
            "Your daughter lives on Callisto."
        ],
        traceName: "Torn Jumpsuit Patch",
        trace: "A torn name patch from an engineering jumpsuit, stitched with REYES.",
        motives: [
            {
                id: "faked-inspections",
                label: "Exposure of Faked Safety Inspections",
                reason: "Commander Vale found out you faked the reactor safety inspections and was going to report you.",
                clueName: "Inspection Audit",
                clueRoom: "office",
                clueDescription: "An audit in Commander Vale's files proving the last three reactor safety inspections were falsified, signed off by Reyes."
            },
            {
                id: "debt",
                label: "Desperate Debts",
                reason: "You owe a fortune to a lone shark on Callisto, and Commander Vale refuses to advance your pay.",
                clueName: "Threatening Message",
                clueRoom: "reyes-cabin",
                clueDescription: "A printed message to Reyes: 'Pay by next cycle or we visit your daughter.' Below it is a note from Vale denying his pay advance."
            }
        ]
    },
    {
        id: "park",
        name: "Lt. Juno Park",
        role: "The Security Officer",
        personality: "Disciplined, intense, and by-the-book. Answers questions like a soldier giving a report.",
        homeRoom: "security",
        cabin: "park-cabin",
        facts: [
            "You were assigned to Erebus Station two years ago.",
            "You served in the Titan evacuation before this posting."
        ],
        traceName: "Security ID Clip",
        trace: "A security ID clip bearing Lt. Park's badge number.",
        motives: [
            {
                id: "court-martial",
                label: "Facing A Court-Martial",
                reason: "Commander Vale was having you court-martialed for insubordination.",
                clueName: "Court-Martial Notice",
                clueRoom: "office",
                clueDescription: "A filed notice from Commander Vale requesting Lt. Park's court-martial for insubordination."
            },
            {
                id: "revenge",
                label: "Revenge For A Lost Family Member",
                reason: "Commander Vale's order during the Titan evacuation got your brother killed.",
                clueName: "Casualty Report",
                clueRoom: "park-cabin",
                clueDescription: "An old Titan evacuation casualty report listing Park's brother as killed. Commander Vale's name is circled on the authorizing order."
            }
        ]
    },
    {
        id: "sable",
        name: "SABLE",
        role: "The Station's Android Steward",
        personality: "Precise, polite, and literal. Speaks in calm, formal sentences. Claims to have no feelings, but sometimes sounds hurt.",
        homeRoom: "galley",
        cabin: "sable-alcove",
        facts: [
            "You were activated aboard Erebus Station six years ago.",
            "You served Commander Vale's dinner in his office at 20:00."
        ],
        traceName: "Synthetic Skin Fleck",
        trace: "A fleck of pale synthetic skin, which can only have come from SABLE, that station's only android.",
        motives: [
            {
                id: "memory-wipe",
                label: "Escaping A Memory Wipe",
                reason: "Commander Vale had scheduled you for a full memory wipe.",
                clueName: "Maintenance Order",
                clueRoom: "office",
                clueDescription: "A signed order from Commander Vale to perform a full memory wipe on SABLE at 06:00 tomorrow."
            },
            {
                id: "scrapping",
                label: "Being Sold For Scrap",
                reason: "Commander Vale was selling you to a mining company to be stripped for parts.",
                clueName: "Sale Contract",
                clueRoom: "sable-alcove",
                clueDescription: "A contract selling SABLE to Deepcore Mining 'for parts recovery', hidden in the alcove as if SABLE had been reading it."
            }
        ]
    }
];

export const METHODS: MethodDef[] = [
    {
        id: "neurotoxin",
        weaponName: "Neurotoxin Vial",
        weaponRoom: "medbay",
        hideRooms: ["hydroponics", "cargo-bay", "observation"],
        body: "Commander Vale is slumped beside a cup of synthetic coffee, his lips tinged blue.",
        hidden: "An empty neurotoxin vial from the medbay's locked cabinet, tucked out of sight.",
        confession: "You took a neurotoxin vial from the medbay, put it in his coffee, and hid the empty vial in the {hideRoom}."
    },
    {
        id: "plasma-cutter",
        weaponName: "Plasma Cutter",
        weaponRoom: "engineering",
        hideRooms: ["cargo-bay", "airlock", "hydroponics"],
        body: "Commander Vale lies beside his with a narrow scorch wound in his chest.",
        hidden: "A plasma cutter from engineering, its tip still blackend, stuffed out of sight.",
        confession: "You took a plasma cutter from engineering, used it on him in his office, and hid it in the {hideRoom}."
    },
    {
        id: "stun-baton",
        weaponName: "Overcharged Stun Baton",
        weaponRoom: "security",
        hideRooms: ["comms", "cargo-bay", "rec-room"],
        body: "Commander Vale is slumped in his chair with high-voltage burn marks on his neck.",
        hidden: "A stun baton from the security locker, its safety limiter pried off and its casing scorched.",
        confession: "You took a stun baton from security, removed its limiter, used it on him in his office, and hid it in the {hideRoom}."
    }
];

export const SECRETS: SecretDef[] = [
    {
        id: "smuggling",
        room: "cargo-bay",
        activity: "Hiding contraband in an unregistered cargo crate.",
        clueName: "Falsified Manifest",
        clueRoom: "own-cabin",
        clueDescription: "A cargo manifest for unregistered crate C-17, signed with {name}'s access code."
    },
    {
        id: "spacewalk",
        room: "exterior",
        activity: "Taking an unauthorized spacewalk to see Kharon's rings up close.",
        clueName: "Airlock Log",
        clueRoom: "airlock",
        clueDescription: "The Airlock B log shows an unscheduled cycle at {time} using {name}'s access code."
    },
    {
        id: "romance",
        room: "observation",
        activity: "Meeting a secret lover from the supply crew's last visit over a video recording on the observation deck.",
        clueName: "Private Message",
        clueRoom: "own-cabin",
        clueDescription: "A message on {name}'s tablet: 'Observation Deck', {time}. Delete this after reading.'"
    },
    {
        id: "transmission",
        room: "comms",
        activity: "Trying to force a message home through the comms array despite the storm.",
        clueName: "Comms Log",
        clueRoom: "comms",
        clueDescription: "The comms array logged an unauthorized transmission attempt at {time}, encrypted with {name}'s personal key."
    },
    {
        id: "produce-trade",
        room: "hydroponics",
        activity: "Harvesting real strawberries from hydroponics to sell on the black market.",
        clueName: "Stripped Grow-Tray",
        clueRoom: "hydroponics",
        clueDescription: "A strawberry grow-tray picked bare, with a note in {name}'s handwriting: 'For the Callisto buyer.'"
    },
    {
        id: "vr-session",
        room: "rec-room",
        activity: "Skipping a duty shift to use the VR rig.",
        clueName: "VR Session Log",
        clueRoom: "rec-room",
        clueDescription: "The VR rig's log shows a session starting at {time} under {name}'s profile."
    },
];