// "How to crack the case": shown in the help dialog and the Station tab.

// How a case is built, told to the player. Rules like Wordle's: knowing the logic is the point,
// the puzzle is applying it with limited turns. Plain words, one idea per step, in the order to play.
export const SOLVING_GUIDE: string[] = [
    "Search the room where the body was found first. The body tells you what time the victim died. Any other items there were left behind by crew members, which means those people were in the room tonight. Match each item to its owner by their job: a medical stylus belongs to the doctor, an engineering glove to the engineer.",
    "Usually three people left something behind. Two of them visited earlier, harmlessly, and saw each other there. Show each person their item, then ask who else they saw. The killer will claim they visited at the same time, but the other two won't remember seeing them.",
    "Everyone lies about where they were at the time of death, even innocent people. The innocent ones are hiding an unrelated secret. If you find evidence of someone's secret, it proves they weren't at the murder.",
    "Ask the crew who they saw during the evening. Someone saw the killer carrying the weapon before the murder, and someone else saw where they took it afterwards.",
    "Motives, the reasons someone wanted the victim dead, are hidden in cabins: in the victim's papers or in the suspect's own belongings.",
    "When you're ready, press Accuse. Name the killer and pick one piece of evidence for each: Opportunity (the item that puts them at the scene), Motive (why they did it), and Means (the weapon). The body explains what happened, but it doesn't count as proof against anyone.",
];
