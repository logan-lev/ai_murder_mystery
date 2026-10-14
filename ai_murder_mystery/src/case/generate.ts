import type { Case, Clue, Suspect, Unlock, Room, RoomID } from "./types";
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

    // The weapon must be findable by reasoning, not luck: someone sees the killer at the hiding place
    // right after the murder. If nobody works there, an innocent's short errand puts them there.
    // A separate RNG keeps every earlier pick (and so every existing case) unchanged.
    const afterIDx = murderIDx + 1;
    let errandRunner: CharacterDef | null = null;
    if (!innocents.some((c) => timeline[c.id][afterIDx] === hideRoom)) {
        errandRunner = pick(mulberry32(seed ^ 0x5eed5), innocents);
        timeline[errandRunner.id][afterIDx] = hideRoom;
    }

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
                const carrying = hasWeapon ? `, ${method.carried}` : "";
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

        // A red herring's visit to the scene stays out of the prompt until they're shown their trace.
        // Told freely, the model mentioned who it saw at the scene while claiming it never left its post.
        const atScene = (s: { slot: number }) => isRedHerring(c.id) && s.slot === 0;

        // Other sightings outside the murder slot are told freely
        facts.push(...seen.filter((s) => s.slot !== murderIDx && !atScene(s)).map((s) => s.text));

        // Innocents admit their motive; the culprit denies it until the confession.
        // The model tended to deny it anyway once cornered, so code makes that consistent,
        // and it becomes a tell the player can learn to read.
        const unlocks: Unlock[] = [
            {
                requires: [`motive-${c.id}`],
                reveals: isCulprit
                    ? `You claim the ${motive.clueName.toLowerCase()} is exaggerated or a misunderstanding. You insist you did not kill ${victim.shortName}.`
                    : `You admit that ${reason}. You insist you did not kill ${victim.shortName}.`
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
                ].join(" "),
                storyChange: `At ${murderTime} you were ${secret.activity}.`
            });
        }

        if (isRedHerring(c.id)) {
            unlocks.push({
                requires: [`trace-${c.id}`],
                // Suspects aren't told which trace is theirs until shown it, or they guess (often wrongly)
                reveals: [
                    `The ${c.traceName.toLowerCase()} is yours: you left it when you briefly visited the ${sceneName} at ${SLOTS[0]} to speak with ${victim.shortName}. ${victim.shortName} was alive and in a foul mood when you left. You readily admit this now.`,
                    ...seen.filter(atScene).map((s) => s.text),
                ].join(" "),
                storyChange: `At ${SLOTS[0]} you briefly visited the ${sceneName}. ${victim.shortName} was alive when you left.`
            });
        }

        if (isCulprit) {
            unlocks.push(
                {
                    requires: [`trace-${c.id}`],
                    // A lie: the culprit claims the same harmless early visit as the red herrings.
                    // The herrings saw each other at that time and can't place the culprit there.
                    reveals: `The ${c.traceName.toLowerCase()} is yours. You admit you went to the ${sceneName}, but claim it was a short visit at ${SLOTS[0]} and ${victim.shortName} was alive when you left. Stick to that time.`,
                    storyChange: `At ${SLOTS[0]} you briefly visited the ${sceneName}. ${victim.shortName} was alive when you left. (Insist on this time.)`
                },
                {
                    requires: ["weapon"],
                    reveals: `You deny ever seeing the ${method.weaponName.toLowerCase()} before.`
                },
                {
                    requires: [`trace-${c.id}`, "weapon", `motive-${c.id}`],
                    reveals: `Your composure breaks. You confess to killing ${victim.shortName}: ${reason}. ${fill(method.confession, vars)}`,
                    confession: true
                }
            );
        }

        return {
            id: c.id,
            name: c.name,
            shortName: c.shortName,
            pronouns: { he: c.pronouns.he, his: c.pronouns.his },
            role: c.role,
            personality: c.personality,
            facts,
            post: roomName(c.homeRoom),
            // "Alone" stops the model from inventing alibi witnesses
            story: errandRunner?.id === c.id
                ? `You were working alone in the ${roomName(c.homeRoom)} from 21:00 until the body was found at 23:00, apart from a quick trip to the ${roomName(hideRoom)} at ${SLOTS[afterIDx]}.`
                : `You were working alone in the ${roomName(c.homeRoom)} from 21:00 until the body was found at 23:00.`,
            reactions: isCulprit
                ? [`If asked about the ${sceneName}, say you did not go there tonight.`]
                : ["If the investigator suggests you were somewhere else, insist on your story."],
            unlocks
        };
    });

    // 9. Solution
    const culpritMotive = motives.get(culprit.id)!;

    // 10. The reasoning path, built from the same data the suspects were given
    // "the Galley" but "Park's Cabin", never "the Park's Cabin"
    const clueRoom = (id: string) => {
        const name = roomName(clues.find((cl) => cl.id === id)!.roomID);
        return name.includes("'s ") ? name : `the ${name}`;
    };
    const [h1, h2] = redHerrings;
    const howToSolve = [
        `The ${sceneName} held three traces. ${h1.name} and ${h2.name} visited at ${SLOTS[0]} and saw each other there, so theirs were harmless.`,
        `The ${culprit.traceName.toLowerCase()} pointed to ${culprit.name}, who claimed the same ${SLOTS[0]} visit, but neither visitor saw ${culprit.pronouns.him} there.`,
    ];
    for (const a of innocents) {
        for (const s of [murderIDx - 1, murderIDx + 1]) {
            if (timeline[a.id][s] !== timeline[culprit.id][s]) continue;
            const where = roomName(timeline[a.id][s]);
            howToSolve.push(
                s === afterIDx
                    ? `${a.name} saw ${culprit.name} in the ${where} at ${SLOTS[s]}, right after the murder, ${method.carried}. That's where the weapon was hidden.`
                    : `${a.name} saw ${culprit.name} in the ${where} at ${SLOTS[s]}, ${method.carried}: the weapon, before the murder.`,
            );
        }
    }
    howToSolve.push(
        `${culprit.name}'s motive was in ${clueRoom(`motive-${culprit.id}`)}: the ${motives.get(culprit.id)!.clueName}.`,
        ...innocents.map((c) => `${c.name} was really ${secrets.get(c.id)!.activity} at ${murderTime} (proof: the ${secrets.get(c.id)!.clueName} in ${clueRoom(`secret-${c.id}`)}).`),
    );

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
        solution: {
            culpritID: culprit.id,
            proof: { opportunity: `trace-${culprit.id}`, motive: `motive-${culprit.id}`, means: "weapon" },
            howToSolve,
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
