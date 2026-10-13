import type { Case, Clue, Suspect, Unlock, Room, RoomID, Motive } from "./types";
import {
    TITLE, SETTING, INTRO, SLOTS, SHARED_FACTS, STATION_ROOMS, CHARACTERS, METHODS, SECRETS,
    SUSPECT_COUNT, RED_HERRING_COUNT, type CharacterDef, type SecretDef
} from "./content";
import { mulberry32, pick, shuffle } from "./random";

export interface Truth {
    seed: number;
    victimID: string;
    culpritID: string;
    methodID: string;
    hideRoom: RoomID;
    murderTime: string;
    redHerringIDs: string[];
    timeline: Record<string, string[]>;
}

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

export function generateCase(seed: number): { case: Case; truth: Truth } {
    const rng = mulberry32(seed);

    // 1. Pick the victim and the suspects. The crime scene is wherever the victim works.
    const victim = pick(rng, CHARACTERS.filter((c) => c.canBeVictim));
    const scene = victim.homeRoom;
    // Shuffled to choose who's aboard, then put back in a fixed order so tabs look the same every case
    const chosen = new Set(shuffle(rng, CHARACTERS.filter((c) => c.id !== victim.id)).slice(0, SUSPECT_COUNT).map((c) => c.id));
    const cast = CHARACTERS.filter((c) => chosen.has(c.id));

    // 2. Pick the crime. The weapon can't come from the scene, and it can't be hidden there.
    const culprit = pick(rng, cast);
    const innocents = cast.filter((c) => c.id !== culprit.id);
    const method = pick(rng, METHODS.filter((m) => m.weaponRoom !== scene));
    const hideRoom = pick(rng, method.hideRooms.filter((r) => r !== scene));
    const murderIDx = pick(rng, [1, 2]);
    const murderTime = SLOTS[murderIDx];

    // 3. Rooms: the fixed station plus a cabin for everyone in this case (the victim included)
    const rooms: Room[] = [
        ...STATION_ROOMS.map((r) => (r.id === scene ? { ...r, description: `${r.description} ${victim.name}'s body lies here.` } : r)),
        ...[victim, ...cast].map((c) => c.cabin),
    ];
    const roomName = (id: string) => (id === "exterior" ? "outside the station" : rooms.find((r) => r.id === id)?.name ?? id);
    const sceneName = roomName(scene);

    const p = victim.pronouns;
    const vars = {
        victim: victim.shortName,
        victimFull: victim.name,
        victimRole: victim.role,
        scene: sceneName,
        time: murderTime,
        hideRoom: roomName(hideRoom),
        he: p.he, him: p.him, his: p.his,
        He: capitalize(p.he), His: capitalize(p.his),
    };

    // 4. Motives for everyone, secrets for innocents, red herrings
    const motives = new Map(cast.map((c) => [c.id, pick(rng, c.motives)]));

    // An innocent's secret must take them away from their own post (or they wouldn't need to lie)
    // and away from the scene (or they'd have been with the victim at the time of death).
    const secretPool = shuffle(rng, SECRETS.filter((s) => s.room !== scene));
    const secrets = new Map<string, SecretDef>();
    for (const c of innocents) {
        const i = secretPool.findIndex((s) => s.room !== c.homeRoom);
        secrets.set(c.id, secretPool.splice(i, 1)[0]);
    }
    const redHerrings = shuffle(rng, innocents).slice(0, RED_HERRING_COUNT);
    const isRedHerring = (id: string) => redHerrings.some((c) => c.id === id);

    // 5. Simulate the true timeline
    const timeline: Record<string, string[]> = {};
    for (const c of cast) timeline[c.id] = SLOTS.map(() => c.homeRoom);
    timeline[culprit.id][murderIDx - 1] = method.weaponRoom;
    timeline[culprit.id][murderIDx] = scene;
    timeline[culprit.id][murderIDx + 1] = hideRoom;
    for (const c of innocents) timeline[c.id][murderIDx] = secrets.get(c.id)!.room;
    for (const c of redHerrings) timeline[c.id][0] = scene;

    // 6. Who saw each other in the same room at the same time
    const sightings = new Map<string, { slot: number; text: string }[]>(cast.map((c) => [c.id, []]));
    for (let s = 0; s < SLOTS.length; s++) {
        for (const a of innocents) {
            for (const b of cast) {
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

    // 7. Clues
    const motiveRoom = (r: string, c: CharacterDef) => (r === "own-cabin" ? c.cabin.id : victim.cabin.id);
    const secretRoom = (r: string, c: CharacterDef) => (r === "own-cabin" ? c.cabin.id : r);

    const clues: Clue[] = [
        {
            id: "body",
            name: "The Body",
            roomID: scene,
            description: `${fill(method.body, vars)} ${vars.His} wrist monitor recorded ${p.his} heart stopping at ${murderTime}.`
        },
        {
            id: "weapon",
            name: method.weaponName,
            roomID: hideRoom,
            description: method.hidden
        }
    ];

    // Shuffled so the culprit's trace isn't always listed first
    for (const c of shuffle(rng, [culprit, ...redHerrings])) {
        clues.push({
            id: `trace-${c.id}`,
            name: c.traceName,
            roomID: scene,
            description: `Found in the ${sceneName}: ${c.trace}.`
        });
    }

    for (const c of cast) {
        const m = motives.get(c.id)!;
        clues.push({
            id: `motive-${c.id}`,
            name: m.clueName,
            roomID: motiveRoom(m.clueRoom, c),
            description: fill(m.clueDescription, vars)
        });
    }

    for (const c of innocents) {
        const s = secrets.get(c.id)!;
        clues.push({
            id: `secret-${c.id}`,
            name: s.clueName,
            roomID: secretRoom(s.clueRoom, c),
            description: fill(s.clueDescription, { ...vars, name: c.name })
        });
    }

    // 8. Suspects
    const aboard = cast.map((c) => `${c.name}, ${c.role}`).join("; ");
    const sharedFacts = [
        ...SHARED_FACTS.map((f) => fill(f, vars)),
        `Aboard the station tonight: ${aboard}. ${victim.shortName} is dead. No one else is aboard.`,
    ];
    if (cast.some((c) => c.id === "sable")) sharedFacts.push("SABLE is an android and is referred to as 'it'.");

    const suspects: Suspect[] = cast.map((c) => {
        const isCulprit = c.id === culprit.id;
        const motive = motives.get(c.id)!;
        const secret = secrets.get(c.id);
        const seen = sightings.get(c.id)!;
        const reason = fill(motive.reason, vars);

        const facts = [...c.facts];
        if (isRedHerring(c.id)) {
            facts.push(`At ${SLOTS[0]} you briefly visited the ${sceneName} to speak with ${victim.shortName}. ${vars.He} was alive and in a foul mood. You will admit this if asked.`);
        }

        // Sightings outside the murder slot are told freely
        facts.push(...seen.filter((s) => s.slot !== murderIDx).map((s) => s.text));

        const unlocks: Unlock[] = [
            {
                requires: [`motive-${c.id}`],
                reveals: `You admit that ${reason}. You insist you did not kill ${victim.shortName}.`
            }
        ];

        if (secret) {
            // Sightings during the murder are hidden; admitting them means admitting where you were during the murder
            const atMurder = seen.filter((s) => s.slot === murderIDx).map((s) => s.text);
            unlocks.push({
                requires: [`secret-${c.id}`],
                reveals: [
                    `You confess that at ${murderTime} you were actually ${secret.activity}. You lied because you would be in serious trouble.`,
                    ...atMurder,
                ].join(" ")
            });
        }

        if (isRedHerring(c.id)) {
            unlocks.push({
                requires: [`trace-${c.id}`],
                reveals: `You readily explain that you visited the ${sceneName} at ${SLOTS[0]}, and ${victim.shortName} was alive when you left.`
            });
        }

        if (isCulprit) {
            unlocks.push(
                {
                    requires: [`trace-${c.id}`],
                    // A lie: the culprit claims the same harmless early visit as the red herrings.
                    // The herrings saw each other at that time and can't place the culprit there.
                    reveals: `You admit you went to the ${sceneName}, but claim it was a short visit at ${SLOTS[0]} and ${victim.shortName} was alive when you left. Stick to that time.`
                },
                {
                    requires: ["weapon"],
                    reveals: `You deny ever seeing the ${method.weaponName.toLowerCase()} before.`
                },
                {
                    requires: [`trace-${c.id}`, "weapon", `motive-${c.id}`],
                    reveals: `Your composure breaks. You confess: ${reason}. ${fill(method.confession, vars)}`
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
            reactions: isCulprit
                ? [`If asked about the ${sceneName}, say you did not go there tonight.`]
                : ["If the investigator suggests you were somewhere else, insist on your story."],
            unlocks
        };
    });

    // 9. Accusation options and solution
    // Only motives of people in this case, so the list doesn't hint at who's aboard
    const motiveOptions: Motive[] = cast.flatMap((c) => c.motives.map((m) => ({ id: m.id, label: m.label })));
    const culpritMotive = motives.get(culprit.id)!;

    const theCase: Case = {
        id: `case-${seed}`,
        title: `${TITLE}: Case #${seed}`,
        setting: SETTING,
        victim: victim.name,
        victimID: victim.id,
        sceneRoomID: scene,
        intro: fill(INTRO, vars),
        sharedFacts,
        rooms,
        clues,
        suspects,
        motives: motiveOptions,
        solution: {
            culpritID: culprit.id,
            motiveID: culpritMotive.id,
            requiredClueIDs: [`trace-${culprit.id}`, `motive-${culprit.id}`],
            explanation: `${culprit.name} killed ${victim.name} in the ${sceneName} at ${murderTime}. Motive: ${culpritMotive.label.toLowerCase()}. The weapon, ${withArticle(method.weaponName.toLowerCase())}, was hidden in the ${roomName(hideRoom)}. ${redHerrings.map((c) => c.name).join(" and ")} left traces too, but only from a harmless visit at ${SLOTS[0]}.`
        }
    };

    return {
        case: theCase,
        truth: {
            seed,
            victimID: victim.id,
            culpritID: culprit.id,
            methodID: method.id,
            hideRoom,
            murderTime,
            redHerringIDs: redHerrings.map((c) => c.id),
            timeline
        }
    };
}
