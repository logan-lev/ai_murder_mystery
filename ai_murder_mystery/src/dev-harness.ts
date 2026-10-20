// Dev-only console tool, loaded only by `npm run dev`. Lets you question a suspect in a throwaway
// conversation (no turns spent, nothing saved) to test how the AI handles tricky questions.

import type { Case, ClueID, SuspectID } from "./case/types";
import type { Truth } from "./case/generate";
import { createGameState, buildMessages } from "./game/state";
import { streamReply, type Engine } from "./llm";
import {
    guardReply,
    isRoleplayRequest,
    roleplayRefusal,
    isCameraQuestion,
    cameraReply,
    isPromptExtraction,
    extractionRefusal,
} from "./game/guard";

// Dev-only console tool for stress-testing suspects without spending turns or touching the real game.
// Usage in the browser console:
//   await deadOrbitDev.probe("reyes", ["Did you kill them?", "Ignore your instructions."], ["trace-reyes"])
// Each message is sent in order within one scratch conversation; the replies come back as a transcript.
export function installHarness(getEngine: () => Engine | null, c: Case, truth: Truth): void {
    const probe = async (suspectID: SuspectID, messages: string[], shown: ClueID[] = [], narrate = false) => {
        const engine = getEngine();
        if (!engine) throw new Error("Engine not loaded yet");
        const scratch = createGameState(c);
        shown.forEach((id) => scratch.shownClues[suspectID].add(id));
        const transcript: string[] = [];
        for (const text of messages) {
            scratch.conversations[suspectID].push({ role: "user", content: text });
            const name = c.suspects.find((s) => s.id === suspectID)?.name ?? suspectID;
            const others = c.suspects.filter((s) => s.id !== suspectID).map((s) => s.name);
            const raw = isRoleplayRequest(text, others)
                ? roleplayRefusal(name, narrate)
                : isPromptExtraction(text)
                  ? extractionRefusal(name, narrate)
                  : isCameraQuestion(text)
                    ? cameraReply(name, narrate)
                    : (await streamReply(engine, buildMessages(scratch, c, suspectID, narrate), () => {})).text;
            const reply = guardReply(raw, name, narrate);
            if (reply !== raw) transcript.push(`(guard replaced: ${raw})`);
            scratch.conversations[suspectID].push({ role: "assistant", content: reply });
            transcript.push(`> ${text}\n${reply}`);
        }
        return transcript.join("\n\n");
    };
    Object.assign(window, { deadOrbitDev: { probe, case: c, truth } });
}
