import type { Case } from "../case/types";
import type { Truth } from "../case/generate";
import { SLOTS } from "../case/content";
import { RANKS, type Verdict } from "../game/accuse";
import { currentStreak, type Stats } from "../game/save";
import { TURN_LIMIT, type GameState } from "../game/state";
import type { CaseInfo } from "../seed";
import { el } from "./dom";

// Elements with this class get their text refreshed every second by main.ts
export const COUNTDOWN_CLASS = "countdown";

function nextCaseBlock(info: CaseInfo): HTMLElement {
    if (info.mode !== "daily") return el("p", "hint", "Practice cases don't count toward your stats.");
    return el("p", "next-case", "Next case in ", [el("strong", COUNTDOWN_CLASS)]);
}

function resultRow(label: string, ok: boolean, detail: string): HTMLElement {
    return el("li", ok ? "result ok" : "result bad", "", [
        el("span", "result-mark", ok ? "✓" : "✗"),
        el("strong", "", label),
        el("span", "", detail),
    ]);
}

// The reveal: where everyone really was. Innocents' secret rooms finally make sense here.
function timelineTable(c: Case, truth: Truth): HTMLElement {
    const roomName = (id: string) => (id === "exterior" ? "Outside (EVA)" : c.rooms.find((r) => r.id === id)?.name ?? id);
    const murderSlot = SLOTS.indexOf(truth.murderTime);
    const head = el("tr", "", "", [
        el("th", "", "Crew"),
        ...SLOTS.map((t, i) => el("th", i === murderSlot ? "murder-slot" : "", t)),
    ]);
    const rows = c.suspects.map((s) =>
        el("tr", s.id === truth.culpritID ? "culprit-row" : "", "", [
            el("th", "", s.name),
            ...truth.timeline[s.id].map((room, i) => el("td", i === murderSlot ? "murder-slot" : "", roomName(room))),
        ]),
    );
    return el("div", "table-wrap", "", [el("table", "timeline", "", [el("thead", "", "", [head]), el("tbody", "", "", rows)])]);
}

export function renderEnd(target: HTMLElement, c: Case, truth: Truth, info: CaseInfo, state: GameState, verdict: Verdict): void {
    const accusation = state.accusation;
    const name = (id: string) => c.suspects.find((s) => s.id === id)?.name ?? id;
    const motive = (id: string) => c.motives.find((m) => m.id === id)?.label ?? id;
    const clue = (id: string) => c.clues.find((cl) => cl.id === id)?.name ?? id;

    const rows = accusation
        ? [
              resultRow("Killer", verdict.correctCulprit, `You named ${name(accusation.suspectID)}.`),
              resultRow("Motive", verdict.correctMotive, motive(accusation.motiveID)),
              resultRow(
                  "Proof",
                  verdict.hasEvidence,
                  accusation.clueIDs.length > 0 ? accusation.clueIDs.map(clue).join(", ") : "No evidence",
              ),
          ]
        : [];

    target.replaceChildren(
        el("p", "eyebrow", verdict.correctCulprit ? "Case closed" : "The killer got away"),
        el("h2", "rank", verdict.rank),
        el("p", "hint", `${state.actions.length} of ${TURN_LIMIT} turns used`),
        el("ul", "results", "", rows),
        el("h3", "", "What really happened"),
        el("p", "", verdict.explanation),
        el("p", "hint", `Needed proof: ${c.solution.requiredClueIDs.map(clue).join(" and ")}.`),
        timelineTable(c, truth),
        nextCaseBlock(info),
    );
}

export function renderStats(target: HTMLElement, stats: Stats, today: number): void {
    const winPct = stats.played > 0 ? Math.round((stats.solved / stats.played) * 100) : 0;
    const tile = (value: number, label: string) => el("div", "stat", "", [el("strong", "", String(value)), el("small", "", label)]);
    const most = Math.max(1, ...RANKS.map((r) => stats.ranks[r] ?? 0));

    target.replaceChildren(
        el("h2", "", "Statistics"),
        el("div", "stat-row", "", [
            tile(stats.played, "Played"),
            tile(winPct, "Solved %"),
            tile(currentStreak(stats, today), "Streak"),
            tile(stats.maxStreak, "Best streak"),
        ]),
        el("h3", "", "Ranks"),
        el(
            "div",
            "rank-chart",
            "",
            RANKS.map((r) => {
                const count = stats.ranks[r] ?? 0;
                const bar = el("span", "bar", String(count));
                bar.style.width = `${Math.max(8, (count / most) * 100)}%`;
                return el("div", "rank-row", "", [el("span", "rank-label", r), el("span", "bar-track", "", [bar])]);
            }),
        ),
        el("p", "next-case", "Next case in ", [el("strong", COUNTDOWN_CLASS)]),
    );
}
