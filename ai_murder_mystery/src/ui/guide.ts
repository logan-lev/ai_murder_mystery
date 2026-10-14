// How a case is built, told to the player. Rules like Wordle's: knowing the logic is the point,
// the puzzle is applying it with limited turns.
export const SOLVING_GUIDE: string[] = [
    "Search the crime scene first. The body tells you the time of death, and items left there tell you who has been in the room. Work out whose they are from what they are.",
    "More than one person left something at the scene. The innocent ones visited earlier and saw each other there. Ask them when they visited and who they saw. The killer will claim the same visit, but nobody will back it up.",
    "Everyone lies about where they were at the time of death. Innocents are hiding something else, and evidence of their secret clears them.",
    "Ask the crew who they saw this evening. Someone spotted the killer carrying the weapon, and right after the murder someone saw where it went.",
    "Motives are hidden in cabins: the victim's records, or the suspect's own belongings.",
    "To win, name the killer and back it up with one piece of evidence each: opportunity (what they left at the scene), motive, and means (the weapon). The body tells you what happened, but it isn't proof against anyone.",
];
