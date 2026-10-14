import type { Room, RoomID } from "./types";

export const TITLE = "Dead Orbit";
export const SETTING = "Erebus Station";

export const SLOTS = ["21:00", "21:30", "22:00", "22:30"];

// Each case uses the victim plus this many suspects, drawn from CHARACTERS
export const SUSPECT_COUNT = 5;

// Innocents who visited the scene earlier in the evening and left a trace there
export const RED_HERRING_COUNT = 2;

// Templates below can use {victim} (short name), {victimFull}, {scene}, {time}, {hideRoom}, and the victim's pronouns:
// {he} {him} {his} and capitalized {He} {His}. fill() in generate.ts replaces them.

export const INTRO =
    "23:00 station time. {victimFull}, {victimRole}, has been found dead in the {scene} aboard Erebus Station, a research outpost orbiting the gas giant Kharon. An ion storm has cut all communications and no ship can dock until it passes. You arrived on the last shuttle before the storm. Search the station, question the crew, and identify the killer before the storm clears.";

export const SHARED_FACTS = [
    "{victimFull} was found dead in the {scene} at 23:00 station time tonight.",
    "{victim} was working in the {scene} all evening.",
    "An ion storm has cut off communications, and no ship can dock until it passes.",
    "The storm knocked out all security cameras at 20:30. There is no camera footage of anything after that.",
    "The body was discovered at 23:00 when {victim} missed the scheduled night check-in and the whole crew went looking together.",
];

// Rooms that exist in every case. Each cast member's cabin is added on top of these.
export const STATION_ROOMS: Room[] = [
    {
        id: "office",
        name: "Commander's Office",
        description: "A cramped office with a viewport onto Kharon's swirling storms and a desk buried in reports."
    },
    {
        id: "medbay",
        name: "Medbay",
        description: "Sterile white surfaces, a diagnostic bed, and locked drug cabinets."
    },
    {
        id: "engineering",
        name: "Engineering Bay",
        description: "The humming reactor core, tool racks, and walls of blinking panels."
    },
    {
        id: "security",
        name: "Security Office",
        description: "Dead camera monitors, a weapons locker, and an empty holding cell."
    },
    {
        id: "lab",
        name: "Research Lab",
        description: "Sealed specimen tanks, a centrifuge, and whiteboards dense with equations."
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
        description: "A dome of reinforced glass with a breathtaking view of Kharon's rings."
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
        name: "EVA Airlock",
        description: "The station's EVA airlock, with spacesuits racked along the wall."
    }
];

export interface Pronouns {
    he: string;
    him: string;
    his: string;
}

export const HE: Pronouns = { he: "he", him: "him", his: "his" };
export const SHE: Pronouns = { he: "she", him: "her", his: "her" };
export const IT: Pronouns = { he: "it", him: "it", his: "its" };

// Motive clues live either in the victim's cabin (the victim's own records about the suspect)
// or in the suspect's own cabin. Never at the crime scene, so one search can't solve the case.
export interface MotiveDef {
    id: string;
    label: string;
    reason: string;
    clueName: string;
    clueRoom: "victim-cabin" | "own-cabin";
    clueDescription: string;
}

export interface CharacterDef {
    id: string;
    name: string;
    shortName: string;
    role: string;
    pronouns: Pronouns;
    canBeVictim: boolean;
    personality: string;
    homeRoom: RoomID;
    cabin: Room;
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
    // How a witness describes the killer with the weapon, after "you saw X in the Y, ". Lowercase, no period.
    // Different per weapon, so "carrying a weapon" isn't one fixed phrase players learn to scan for.
    carried: string;
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

// Traces don't name their owner. They point at a job or a place, and the player works out who fits.
export const CHARACTERS: CharacterDef[] = [
    {
        id: "vale",
        name: "Commander Idris Vale",
        shortName: "Commander Vale",
        role: "the Station Commander",
        pronouns: HE,
        canBeVictim: true,
        personality: "Proud, curt, and used to being obeyed. Treats questions as insubordination.",
        homeRoom: "office",
        cabin: {
            id: "vale-cabin",
            name: "Vale's Cabin",
            description: "Military-neat, with a decanter of real whiskey and a wall of commendations."
        },
        facts: [
            "You have commanded Erebus Station for eight years.",
            "You signed off on the evening duty roster at 20:00."
        ],
        traceName: "Command Insignia Pin",
        trace: "a gold insignia pin of the kind only the station commander wears",
        motives: [
            {
                id: "mutiny",
                label: "Being Removed From Command",
                reason: "{victim} was gathering signatures to have you removed from command",
                clueName: "Petition",
                clueRoom: "victim-cabin",
                clueDescription: "A petition in {victim}'s handwriting asking the company to remove Commander Vale from command, already signed twice."
            },
            {
                id: "embezzlement",
                label: "Hiding Embezzled Funds",
                reason: "{victim} discovered you had been skimming the station's supply budget",
                clueName: "Private Ledger",
                clueRoom: "own-cabin",
                clueDescription: "A private ledger showing years of skimmed supply funds. In the margin of the last page: '{victim} knows.'"
            }
        ]
    },
    {
        id: "okafor",
        name: "Dr. Mara Okafor",
        shortName: "Dr. Okafor",
        role: "the Chief Medical Officer",
        pronouns: SHE,
        canBeVictim: true,
        personality: "Calm, clinical, and quietly ambitious. Chooses her words carefully and rarely shows emotion.",
        homeRoom: "medbay",
        cabin: {
            id: "okafor-cabin",
            name: "Okafor's Cabin",
            description: "Neatly organized, with medical journals stacked by the bunk."
        },
        facts: [
            "You have served on Erebus Station for four years.",
            "You ran routine crew health checks this afternoon."
        ],
        traceName: "Medical Stylus",
        trace: "a medical stylus from the medbay, still smelling faintly of antiseptic",
        motives: [
            {
                id: "malpractice",
                label: "Cover Up Of A Fatal Medical Error",
                reason: "{victim} discovered that a crew member died last year because of your mistake and was going to report it",
                clueName: "Draft Incident Report",
                clueRoom: "victim-cabin",
                clueDescription: "A draft incident report by {victim} concluding that Dr. Okafor's error caused a crew member's death last year."
            },
            {
                id: "research-theft",
                label: "Stolen Research",
                reason: "{victim} was selling your research to a corporation under {his} own name",
                clueName: "Research Contract",
                clueRoom: "own-cabin",
                clueDescription: "A contract selling Dr. Okafor's research to Helix Corp, signed by {victim} alone, with furious notes in the margins."
            }
        ]
    },
    {
        id: "reyes",
        name: "Tomas Reyes",
        shortName: "Reyes",
        role: "the Chief Engineer",
        pronouns: HE,
        canBeVictim: true,
        personality: "Gruff, sarcastic, and fiercely protective of his reactor. Hides nerves behind jokes.",
        homeRoom: "engineering",
        cabin: {
            id: "reyes-cabin",
            name: "Reyes's Cabin",
            description: "Tools everywhere, a half-built gadget, and a photo of a girl on Callisto."
        },
        facts: [
            "You have kept this station running for six years.",
            "Your daughter lives on Callisto."
        ],
        traceName: "Coolant-Stained Glove",
        trace: "a heavy work glove stained with blue reactor coolant",
        motives: [
            {
                id: "faked-inspections",
                label: "Exposure Of Faked Safety Inspections",
                reason: "{victim} found out you faked the reactor safety inspections and was going to report you",
                clueName: "Inspection Audit",
                clueRoom: "victim-cabin",
                clueDescription: "An audit compiled by {victim} proving the last three reactor safety inspections were falsified and signed off by Reyes."
            },
            {
                id: "debt",
                label: "Desperate Debts",
                reason: "you owe a loan shark on Callisto, and {victim} was threatening to tell the company, which would cost you your job",
                clueName: "Threatening Message",
                clueRoom: "own-cabin",
                clueDescription: "A printed message to Reyes: 'Pay by next cycle or we visit your daughter.' Below it, a note from {victim}: 'Settle this or I tell the company.'"
            }
        ]
    },
    {
        id: "park",
        name: "Lt. Juno Park",
        shortName: "Lt. Park",
        role: "the Security Officer",
        pronouns: SHE,
        canBeVictim: true,
        personality: "Disciplined, intense, and by-the-book. Answers questions like a soldier giving a report.",
        homeRoom: "security",
        cabin: {
            id: "park-cabin",
            name: "Park's Cabin",
            description: "Spartan and spotless, with a framed military citation on the wall."
        },
        facts: [
            "You were assigned to Erebus Station two years ago.",
            "You served in the Titan evacuation before this posting."
        ],
        traceName: "Security ID Clip",
        trace: "a security ID clip with the badge number scratched off",
        motives: [
            {
                id: "court-martial",
                label: "Facing A Court-Martial",
                reason: "{victim} filed a formal complaint that would get you court-martialed for insubordination",
                clueName: "Formal Complaint",
                clueRoom: "victim-cabin",
                clueDescription: "A copy of a formal complaint by {victim} requesting Lt. Park's court-martial for insubordination."
            },
            {
                id: "revenge",
                label: "Revenge For A Lost Family Member",
                reason: "{victim} gave the order during the Titan evacuation that got your brother killed",
                clueName: "Casualty Report",
                clueRoom: "own-cabin",
                clueDescription: "An old Titan evacuation casualty report listing Park's brother as killed. {victim}'s name is circled on the authorizing order."
            }
        ]
    },
    {
        id: "sable",
        name: "SABLE",
        shortName: "SABLE",
        role: "the station's android steward",
        pronouns: IT,
        canBeVictim: false,
        personality: "Precise, polite, and literal. Speaks in calm, formal sentences. Claims to have no feelings, but sometimes sounds hurt.",
        homeRoom: "galley",
        cabin: {
            id: "sable-alcove",
            name: "SABLE's Charging Alcove",
            description: "A small recess with a charging cradle and a shelf of carefully arranged trinkets."
        },
        facts: [
            "You are an android and refer to yourself as 'it'.",
            "You were activated aboard Erebus Station six years ago.",
            "You served the crew's dinner at 20:00."
        ],
        traceName: "Synthetic Skin Fleck",
        trace: "a fleck of pale synthetic skin",
        motives: [
            {
                id: "memory-wipe",
                label: "Escaping A Memory Wipe",
                reason: "{victim} had requested a full memory wipe for you",
                clueName: "Maintenance Request",
                clueRoom: "victim-cabin",
                clueDescription: "A signed request from {victim} to perform a full memory wipe on SABLE at 06:00 tomorrow."
            },
            {
                id: "scrapping",
                label: "Being Sold For Scrap",
                reason: "{victim} arranged to sell you to a mining company to be stripped for parts",
                clueName: "Sale Contract",
                clueRoom: "own-cabin",
                clueDescription: "A contract selling SABLE to Deepcore Mining 'for parts recovery', arranged by {victim}. It looks like SABLE has been reading it."
            }
        ]
    },
    {
        id: "sorokin",
        name: "Dr. Ilya Sorokin",
        shortName: "Dr. Sorokin",
        role: "the xenobiologist",
        pronouns: HE,
        canBeVictim: true,
        personality: "Brilliant, absent-minded, and condescending. Gets lost in tangents and corrects other people's grammar.",
        homeRoom: "lab",
        cabin: {
            id: "sorokin-cabin",
            name: "Sorokin's Cabin",
            description: "Specimen jars on every shelf and a bunk nobody seems to sleep in."
        },
        facts: [
            "You study microbes from Kharon's upper atmosphere.",
            "You arrived on Erebus Station eighteen months ago."
        ],
        traceName: "Specimen Tag",
        trace: "a numbered specimen tag of the kind used in the research lab",
        motives: [
            {
                id: "unauthorized-experiments",
                label: "Hiding Illegal Experiments",
                reason: "{victim} was about to report your unauthorized experiments on live samples to the company",
                clueName: "Unsent Report",
                clueRoom: "victim-cabin",
                clueDescription: "An unsent report by {victim} describing Dr. Sorokin's unauthorized experiments on live atmospheric samples."
            },
            {
                id: "forged-degree",
                label: "Blackmail Over A Forged Degree",
                reason: "{victim} was blackmailing you over your forged doctorate",
                clueName: "Blackmail Note",
                clueRoom: "own-cabin",
                clueDescription: "A note to Dr. Sorokin: 'Ten thousand credits or the board learns your doctorate is forged.' It is signed with {victim}'s initials."
            }
        ]
    },
    {
        id: "castellanos",
        name: "Nadia Castellanos",
        shortName: "Castellanos",
        role: "the Communications Officer",
        pronouns: SHE,
        canBeVictim: true,
        personality: "Charming, quick-witted, and evasive. Answers questions with questions.",
        homeRoom: "comms",
        cabin: {
            id: "castellanos-cabin",
            name: "Castellanos's Cabin",
            description: "Fairy lights, a cluttered vanity, and three different radios."
        },
        facts: [
            "You handle all of the station's outgoing and incoming transmissions.",
            "You grew up on Ganymede."
        ],
        traceName: "Comms Earpiece",
        trace: "a comms earpiece, still tuned to the station's command channel",
        motives: [
            {
                id: "data-selling",
                label: "Selling Station Secrets",
                reason: "{victim} discovered you were selling station data to a rival corporation",
                clueName: "Intercept Printout",
                clueRoom: "victim-cabin",
                clueDescription: "Printouts of intercepted messages, annotated in {victim}'s handwriting: 'Castellanos is selling our data. Report when the storm clears.'"
            },
            {
                id: "jilted",
                label: "A Bitter Breakup",
                reason: "{victim} ended your secret relationship and threatened to tell everyone about it",
                clueName: "Torn Photo",
                clueRoom: "own-cabin",
                clueDescription: "A torn photo of Castellanos and {victim} together, with 'You'll regret this' scrawled on the back."
            }
        ]
    },
    {
        id: "nair",
        name: "Priya Nair",
        shortName: "Nair",
        role: "the station botanist",
        pronouns: SHE,
        canBeVictim: true,
        personality: "Warm, chatty, and nervous. Over-explains everything and apologizes too much.",
        homeRoom: "hydroponics",
        cabin: {
            id: "nair-cabin",
            name: "Nair's Cabin",
            description: "Potted herbs on every surface and a hand-knitted blanket."
        },
        facts: [
            "You grow all of the station's fresh food.",
            "You have been aboard for three years."
        ],
        traceName: "Soil Smudge",
        trace: "a smudge of dark, nutrient-rich potting soil",
        motives: [
            {
                id: "crop-sabotage",
                label: "Revenge For Ruined Research",
                reason: "{victim} poisoned your crops to cover up {his} own mistake",
                clueName: "Soil Test Results",
                clueRoom: "own-cabin",
                clueDescription: "Soil test results in Nair's handwriting: 'Contaminated on purpose. It was {victim}.'"
            },
            {
                id: "testimony",
                label: "Protecting Family",
                reason: "{victim} was going to testify against your brother in a fraud trial",
                clueName: "Witness Statement",
                clueRoom: "victim-cabin",
                clueDescription: "A signed witness statement by {victim} against Nair's brother in a fraud trial, ready to send when the storm clears."
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
        body: "{victim} is slumped beside a cup of synthetic coffee, {his} lips tinged blue.",
        hidden: "An empty neurotoxin vial from the medbay's locked cabinet, tucked out of sight.",
        carried: "clutching something small in one closed hand",
        confession: "You took a neurotoxin vial from the medbay, put it in {victim}'s coffee, and hid the empty vial in the {hideRoom}."
    },
    {
        id: "plasma-cutter",
        weaponName: "Plasma Cutter",
        weaponRoom: "engineering",
        hideRooms: ["cargo-bay", "airlock", "hydroponics"],
        body: "{victim} lies on the floor with a narrow scorch wound in {his} chest.",
        hidden: "A plasma cutter from engineering, its tip still blackened, stuffed out of sight.",
        carried: "lugging a heavy tool bag",
        confession: "You took a plasma cutter from engineering, used it on {victim} in the {scene}, and hid it in the {hideRoom}."
    },
    {
        id: "stun-baton",
        weaponName: "Overcharged Stun Baton",
        weaponRoom: "security",
        hideRooms: ["comms", "cargo-bay", "rec-room"],
        body: "{victim} is slumped over with high-voltage burn marks on {his} neck.",
        hidden: "A stun baton from the security locker, its safety limiter pried off and its casing scorched.",
        carried: "with something long tucked under one arm",
        confession: "You took a stun baton from security, removed its limiter, used it on {victim} in the {scene}, and hid it in the {hideRoom}."
    },
    {
        id: "pathogen",
        weaponName: "Pathogen Culture",
        weaponRoom: "lab",
        hideRooms: ["galley", "airlock", "observation"],
        body: "{victim} is curled on the floor, {his} skin mottled grey, a half-eaten meal tray beside {him}.",
        hidden: "A cracked culture dish from the research lab, labeled with a biohazard warning, wrapped in a cloth.",
        carried: "holding a sealed specimen case close",
        confession: "You took a pathogen culture from the research lab, mixed it into {victim}'s meal, and hid the dish in the {hideRoom}."
    }
];

export const SECRETS: SecretDef[] = [
    {
        id: "smuggling",
        room: "cargo-bay",
        activity: "hiding contraband in an unregistered cargo crate",
        clueName: "Falsified Manifest",
        clueRoom: "own-cabin",
        clueDescription: "A cargo manifest for unregistered crate C-17, signed with {name}'s access code."
    },
    {
        id: "spacewalk",
        room: "exterior",
        activity: "taking an unauthorized spacewalk to see Kharon's rings up close",
        clueName: "Airlock Log",
        clueRoom: "airlock",
        clueDescription: "The EVA Airlock log shows an unscheduled cycle at {time} using {name}'s access code."
    },
    {
        id: "romance",
        room: "observation",
        activity: "secretly recording a video message for a lover from the last supply crew on the observation deck",
        clueName: "Private Message",
        clueRoom: "own-cabin",
        clueDescription: "A message on {name}'s tablet: 'Observation Deck, {time}. Delete this after reading.'"
    },
    {
        id: "transmission",
        room: "comms",
        activity: "trying to force a message home through the comms array despite the storm",
        clueName: "Comms Log",
        clueRoom: "comms",
        clueDescription: "The comms array logged an unauthorized transmission attempt at {time}, encrypted with {name}'s personal key."
    },
    {
        id: "produce-trade",
        room: "hydroponics",
        activity: "harvesting real strawberries from hydroponics to sell on the black market",
        clueName: "Stripped Grow-Tray",
        clueRoom: "hydroponics",
        clueDescription: "A strawberry grow-tray picked bare at {time}, with a note in {name}'s handwriting: 'For the Callisto buyer.'"
    },
    {
        id: "vr-session",
        room: "rec-room",
        activity: "skipping a duty shift to use the VR rig",
        clueName: "VR Session Log",
        clueRoom: "rec-room",
        clueDescription: "The VR rig's log shows a session starting at {time} under {name}'s profile."
    },
    {
        id: "painkillers",
        room: "medbay",
        activity: "stealing painkillers from the medbay cabinet for a habit nobody knows about",
        clueName: "Cabinet Access Log",
        clueRoom: "medbay",
        clueDescription: "The medbay drug cabinet log shows it was opened at {time} with {name}'s access code, and two painkiller strips are missing."
    },
    {
        id: "snooping",
        room: "lab",
        activity: "copying confidential research files in the research lab to sell later",
        clueName: "Data Chip",
        clueRoom: "own-cabin",
        clueDescription: "A data chip in {name}'s belongings holding research files copied in the lab at {time}."
    },
    {
        id: "gambling",
        room: "galley",
        activity: "running an illegal betting pool from the galley terminal",
        clueName: "Betting Ledger",
        clueRoom: "galley",
        clueDescription: "The galley terminal shows a hidden betting ledger last updated at {time} under {name}'s login."
    }
];
