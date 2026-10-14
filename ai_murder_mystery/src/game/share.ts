import { caseLabel, caseURL, type CaseInfo } from "../seed";
import type { Verdict } from "./accuse";
import { TURN_LIMIT, type ActionKind, type GameState } from "./state";

// Spoiler-free: shows how turns were spent, never which room or suspect
const ACTION_ICONS: Record<ActionKind, string> = {
    "search-hit": "🔦",
    "search-miss": "⬛",
    question: "💬",
    show: "🧾",
};

const RANK_ICONS: Record<string, string> = {
    "Master Investigator": "🏅",
    "Sharp Inspector": "🔎",
    "Lucky Guess": "🍀",
    "Case Unsolved": "💀",
};

const mark = (ok: boolean) => (ok ? "✅" : "❌");

export function buildShareText(info: CaseInfo, state: GameState, verdict: Verdict): string {
    const icons = state.actions.map((a) => ACTION_ICONS[a]);
    const rows: string[] = [];
    for (let i = 0; i < icons.length; i += 8) rows.push(icons.slice(i, i + 8).join(""));

    return [
        `Dead Orbit ${caseLabel(info)}${state.attempt > 1 ? ` (retry ${state.attempt - 1})` : ""} 🛰️`,
        `${RANK_ICONS[verdict.rank] ?? ""} ${verdict.rank}`,
        `Killer ${mark(verdict.correctCulprit)} Means ${mark(verdict.correctProof.means)} Motive ${mark(verdict.correctProof.motive)} Opportunity ${mark(verdict.correctProof.opportunity)}`,
        ...rows,
        `${state.actions.length}/${TURN_LIMIT} turns`,
        caseURL(info),
    ].join("\n");
}

// Clipboard first (works everywhere on https), the native share sheet as a fallback
export async function shareText(text: string): Promise<"copied" | "shared" | "failed"> {
    try {
        await navigator.clipboard.writeText(text);
        return "copied";
    } catch {
        if (navigator.share) {
            try {
                await navigator.share({ text });
                return "shared";
            } catch {
                return "failed";
            }
        }
        return "failed";
    }
}
