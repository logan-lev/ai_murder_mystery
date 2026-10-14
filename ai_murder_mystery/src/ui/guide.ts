// How a case is built, told to the player. Rules like Wordle's: knowing the logic is the point,
// the puzzle is applying it with limited turns.
export const SOLVING_GUIDE: string[] = [
    "Search the crime scene first. The body tells you the time of death, and items left there tell you who has been in the room. Work out whose they are from what they are.",
    "More than one person left something at the scene. The innocent ones visited earlier and saw each other there. Ask them when they visited and who they saw. The killer will claim the same visit, but nobody will back it up.",
    "Everyone lies about where they were at the time of death. Innocents are hiding something else, and evidence of their secret clears them.",
    "Ask the crew who they saw this evening. Someone may have spotted the killer carrying the weapon.",
    "Motives are hidden in cabins: the victim's records, or the suspect's own belongings.",
    "To win, accuse the killer with their motive, and pick the evidence that proves it: what they left at the scene, and their motive.",
];
