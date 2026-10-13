import type { Case, Clue, Suspect, Unlock, RoomID, Motive } from "./types";
import { TITLE, SETTING, VICTIM, INTRO, SLOTS, SHARED_FACTS, ROOMS, CHARACTERS, METHODS, SECRETS, type CharacterDef } from "./content";
import { mulberry32, pick, shuffle } from "./random";

export interface Truth {
    seed: number;
    culpritID: string;
    methodID: string;
    hideRoom: RoomID;
    murderTime: string;
    redHerringID: string;
    timeline: Record<string, string[]>;
}

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
const roomName = (id: string) => id === "exterior" ? "outside the station" : ROOMS.find((r) => r.id === id)?.name ?? id;

export function generateCase(seed: number): { case: Case; truth: Truth } {
    const rng = mulberry32(seed);

    // 1. Pick the crime
    const culprit = pick(rng, CHARACTERS)
    const innocents = CHARACTERS.filter((c) => c.id !== culprit.id);
    const method = pick(rng, METHODS);
    const hideRoom = pick(rng, method.hideRooms);
    const murderIDx = pick(rng, [1, 2]);
    const murderTime = SLOTS[murderIDx];

    // 2. Motives for everyone, secrets for innocents, one red herring
    const motives = new Map(CHARACTERS.map((c) => [c.id, pick(rng, c.motives)]));
    const secretPool = shuffle(rng, SECRETS);
    const secrets = new Map(innocents.map((c, i) => [c.id, secretPool[i]]));
    const redHerring = pick(rng, innocents);

    // 3. Simulate the true timeline
    const timeline: Record<string, string[]> = {};
    
    for (const c of CHARACTERS) timeline[c.id] = SLOTS.map(() => c.homeRoom);
    timeline[culprit.id][murderIDx - 1] = method.weaponRoom;
    timeline[culprit.id][murderIDx] = "office";
    timeline[culprit.id][murderIDx + 1] = hideRoom;
    for (const c of innocents) timeline[c.id][murderIDx] = secrets.get(c.id)!.room;
    timeline[redHerring.id][0] = "office";

    // 4. Who saw each other in the same room at the same time
    const sightings = new Map<string, { slot: number; text: string }[]>( CHARACTERS.map((c) => [c.id, []]));
    for (let s = 0; s < SLOTS.length; s++) {
        for (const a of innocents) {
            for (const b of CHARACTERS) {
                if (a.id === b.id) continue;
                const room = timeline[a.id][s];
                if (room === "exterior" || room !== timeline[b.id][s]) continue;
                // The culprit only has the weapon on them right before (fetching it) and right after (hiding it)
                const hasWeapon = b.id === culprit.id && Math.abs(s - murderIDx) === 1;
                const carrying = hasWeapon ? ", carrying something wrapped in a cloth" : "";
                sightings.get(a.id)!.push({
                    slot: s,
                    text: `At ${SLOTS[s]} you saw ${b.name} in the ${roomName(room)}${carrying}.`
                });
            }
        }
    }

    // 5. Clues
    const roomFor = (r: string, c: CharacterDef) => (r === "own-cabin" ? c.cabin : r);
    
    const clues: Clue[] = [
        {
            id: "body",
            name: "The Body",
            roomID: "office",
            description: `${method.body} His personal log is open on the desk. The last entry is timestamped ${murderTime} and stops mid-sentence.`
        },
        {
            id: "weapon",
            name: method.weaponName,
            roomID: hideRoom,
            description: method.hidden
        }
    ];

    for (const c of [culprit, redHerring]) {
        clues.push({
            id: `trace-${c.id}`,
            name: c.traceName,
            roomID: "office",
            description: `Found in the Commander's Office: ${c.trace}.`
        });
    }

    for (const c of CHARACTERS) {
        const m = motives.get(c.id)!;
        clues.push({
            id: `motive-${c.id}`,
            name: m.clueName,
            roomID: m.clueRoom,
            description: m.clueDescription
        });
    }

    for (const c of innocents) {
        const s = secrets.get(c.id)!;
        clues.push({
            id: `secret-${c.id}`,
            name: s.clueName,
            roomID: roomFor(s.clueRoom, c),
            description: fill(s.clueDescription, {name: c.name, time: murderTime})
        });
    }

    //6. Suspects
    const suspects: Suspect[] = CHARACTERS.map((c) =>  {
        const isCulprit = c.id === culprit.id;
        const motive = motives.get(c.id)!;
        const secret = secrets.get(c.id)!;
        const seen = sightings.get(c.id)!;

        const facts = [...c.facts];
        if (c.id === redHerring.id) {
            facts.push(`At ${SLOTS[0]} you briefly visited the Commander's Office to speak with ${VICTIM}. He was alive and in a foul mood. You will admit this if asked.`);
        }

        // Sightings outside the murder slot are told freely
        facts.push(...seen.filter((s) => s.slot !== murderIDx).map((s) => s.text));

        const unlocks: Unlock[] = [
            {
                requires: [`motive-${c.id}`],
                reveals: `You admit that ${motive.reason}. You insist you did not kill him.`
            }
        ];

        if (secret) {
            // Sightings during the murder are hidden; Admitting them means admitting where you were during the murder
            const atMurder = seen.filter((s) => s.slot === murderIDx).map((s) => s.text);
            unlocks.push({
                    requires: [`secret-${c.id}`],
                    reveals: [
                        `You confess that at ${murderTime} you were actually ${secret.activity}. You lied because you would be in serious trouble.`,
                        ...atMurder,
                    ].join(" ")
                });
        }

        if (c.id === redHerring.id) {
            unlocks.push({
                requires: [`trace-${c.id}`],
                reveals: `You readily explain that you visited the office at ${SLOTS[0]}, and he was alive when you left.`
            });
        }

        if (isCulprit) {
            unlocks.push(
                {
                    requires: [`trace-${c.id}`],
                    reveals: `You admit you went to the Commander's Office at ${murderTime}, but insist he was alive when you left.`
                },
                {
                    requires: ["weapon"],
                    reveals: `You deny ever seeing the ${method.weaponName.toLowerCase()} before.`
                },
                {
                    requires: [`trace-${c.id}`, "weapon", `motive-${c.id}`],
                    reveals: `Your composure breaks. You confess: ${motive.reason}. ${fill(method.confession, {
                        hideRoom: roomName(hideRoom)
                    })}`
                }
            );
        }

        return {
            id: c.id,
            name: c.name,
            role: c.role,
            personality: c.personality,
            facts,
            story: `You were in the ${roomName(c.homeRoom)} from 21:00 until the body was found at 23:00.`,
            reactions: isCulprit ? ["If asked about the Commander's Office, say you did not go there after dinner."] : ["If the investigator suggests you were somewhere else, insist on your story."],
            unlocks
        };
    });

    // 7. Accusation Options and Solutions
    const motiveOptions: Motive[] = CHARACTERS.flatMap((c) => c.motives.map((m) => ({ id: m.id, label: m.label})));
    const culpritMotive = motives.get(culprit.id)!;

    const theCase: Case = {
        id: `case-${seed}`,
        title: `${TITLE}: Case #${seed}`,
        setting: SETTING,
        victim: VICTIM,
        intro: INTRO,
        sharedFacts: SHARED_FACTS,
        rooms: ROOMS,
        clues,
        suspects,
        motives: motiveOptions,
        solution: {
            culpritID: culprit.id,
            motiveID: culpritMotive.id,
            requiredClueIDs: [`trace-${culprit.id}`, `motive-${culprit.id}`],
            explanation: `${culprit.name} killed ${VICTIM} at ${murderTime}. Motive: ${culpritMotive.label.toLowerCase()}. The weapon, ${withArticle(method.weaponName.toLowerCase())}, was hidden in the ${roomName(hideRoom)}.`
        }
    };

    return {
        case: theCase,
        truth: {
            seed,
            culpritID: culprit.id,
            methodID: method.id,
            hideRoom,
            murderTime,
            redHerringID: redHerring.id,
            timeline
        }
    };
}