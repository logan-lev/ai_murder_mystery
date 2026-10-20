import { generateCase } from "./case/generate";
import { dayNumber, dailySeed, dailyURL, dayDate, msUntilNextDay, tutorialURL, practiceURL } from "./seed";
import { peekSave, loadHistory, loadStats, readFlag } from "./game/save";
import { TURN_LIMIT } from "./game/state";
import { renderStats, COUNTDOWN_CLASS } from "./ui/results";
import { el, $, formatCountdown } from "./ui/dom";
import { wireHelp, wireSettings } from "./ui/common";

const today = dayNumber();
const history = loadHistory();

function link(className: string, text: string, href: string): HTMLAnchorElement {
    const a = el("a", className, text);
    a.href = href;
    return a;
}

// Today's case: a spoiler-free teaser (who died, and where) plus where the player stands
function renderToday(): void {
    const seed = dailySeed(today);
    const c = generateCase(seed).case;
    const scene = c.rooms.find((r) => r.id === c.sceneRoomID)!.name;
    const save = peekSave(seed);
    const result = history[today];

    let status = "Not started";
    let action = "Play today's case";
    if (result) {
        status = `Closed: ${result.rank}`;
        action = "View result";
    } else if (save && save.turnsUsed > 0) {
        status = `In progress: ${save.turnsUsed} of ${TURN_LIMIT} turns used`;
        action = "Continue";
    }

    $<HTMLElement>("#home-today").replaceChildren(
        el("p", "eyebrow", `Daily #${today} · ${dayDate(today)}`),
        el("h2", "home-title", `${c.victim} has been found dead in the ${scene}.`),
        el("p", result?.solved ? "home-status ok" : "home-status", status),
        link("primary-btn home-play", action, dailyURL(today)),
        el("p", "next-case", "Next case in ", [el("strong", COUNTDOWN_CLASS)]),
    );
}

function renderTraining(): void {
    const done = readFlag("training-done");
    $<HTMLElement>("#home-training").replaceChildren(
        el("h2", "", "Training"),
        el(
            "p",
            "",
            "New here? A guided case that walks through every tool: searching, questioning, catching lies, uncovering secrets, the timeline board, and making an accusation. It takes about five minutes.",
        ),
        done ? el("p", "home-status ok", "Completed") : el("p", "home-status", "Recommended before your first case"),
        link(done ? "text-btn" : "primary-btn", done ? "Replay training" : "Start training", tutorialURL()),
    );
}

function renderArchive(): void {
    const target = $<HTMLElement>("#home-archive");
    const past = Array.from({ length: today - 1 }, (_, i) => today - 1 - i);

    const rows = past.map((day) => {
        const result = history[day];
        const mark = result ? (result.solved ? "✓" : "✗") : "";
        const status = result ? result.rank : "Not played";
        const row = link(
            result?.solved ? "archive-row solved" : result ? "archive-row unsolved" : "archive-row",
            "",
            dailyURL(day),
        );
        row.append(
            el("span", "archive-day", `#${day}`),
            el("span", "archive-date", dayDate(day)),
            el("span", "archive-status", `${mark} ${status}`.trim()),
        );
        return row;
    });

    target.replaceChildren(
        el("h2", "", "Archive"),
        el("p", "hint", "Play any past daily case. Archive results are saved here but don't affect your streak."),
        ...(rows.length > 0
            ? [el("div", "archive-list", "", rows)]
            : [el("p", "hint", "Past cases appear here. Yesterday's case will show up tomorrow.")]),
        el("p", "home-more", "", [link("text-btn", "Play a random practice case", practiceURL())]),
    );
}

function tickCountdowns(): void {
    const text = dayNumber() > today ? "now. Reload!" : formatCountdown(msUntilNextDay());
    document.querySelectorAll(`.${COUNTDOWN_CLASS}`).forEach((node) => (node.textContent = text));
}

$<HTMLElement>("#home").hidden = false;
document.title = "Dead Orbit";
renderToday();
renderTraining();
renderStats($<HTMLElement>("#home-stats"), loadStats(), today, false);
renderArchive();
wireHelp("#home-help-btn");
wireSettings("#home-settings-btn");
tickCountdowns();
setInterval(tickCountdowns, 1000);

// A case finished (or progress deleted) in another tab: show the up-to-date status and stats
window.addEventListener("storage", (event) => {
    if (event.key === null || event.key.startsWith("deadorbit:")) window.location.reload();
});
