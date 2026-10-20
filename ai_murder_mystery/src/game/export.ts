import type { Case } from "../case/types";
import type { Truth } from "../case/generate";
import { SLOTS } from "../case/content";
import { MODEL_ID, type ReplyStats } from "../llm";
import type { GameState } from "./state";
import { buildSuspectPrompt } from "./prompt";

export interface ReplyStat extends ReplyStats {
  suspectID: string;
}

export function buildReport(c: Case, truth: Truth, state: GameState, stats: ReplyStat[]): string {
  const suspectName = (id: string) => c.suspects.find((s) => s.id === id)?.name ?? id;
  const clueName = (id: string) => c.clues.find((cl) => cl.id === id)?.name ?? id;
  const roomName = (id: string) =>
    id === "exterior" ? "Outside the station" : c.rooms.find((r) => r.id === id)?.name ?? id;

  const out: string[] = [
    `# ${c.title}`,
    "",
    `- Exported: ${new Date().toLocaleString()}`,
    `- Model: ${MODEL_ID}`,
    `- Replies: ${stats.length}`,
  ];

  if (stats.length > 0) {
    const avg = (key: keyof ReplyStats) =>
      Math.round(stats.reduce((sum, s) => sum + s[key], 0) / stats.length);
    out.push(
      `- Average wait for first token: ${avg("firstTokenMs")} ms`,
      `- Average total reply time: ${avg("totalMs")} ms`,
      `- Average reply length: ${avg("tokens")} tokens`,
    );
  }

  out.push(
    "",
    "## Solution",
    "",
    c.solution.explanation,
    "",
    `- Victim: ${c.victim}, found in ${roomName(c.sceneRoomID)}`,
    `- Culprit: ${suspectName(truth.culpritID)}`,
    `- Method: ${truth.methodID}`,
    `- Weapon hidden in: ${roomName(truth.hideRoom)}`,
    `- Time of death: ${truth.murderTime}`,
    `- Red herrings: ${truth.redHerringIDs.map(suspectName).join(", ")}`,
    "",
    "### True timeline",
    "",
    `| Crew | ${SLOTS.join(" | ")} |`,
    `|---|${SLOTS.map(() => "---").join("|")}|`,
    ...c.suspects.map((s) => `| ${s.name} | ${truth.timeline[s.id].map(roomName).join(" | ")} |`),
    "",
    "## Evidence found",
    "",
    ...(state.foundClueIDs.size > 0 ? [...state.foundClueIDs].map((id) => `- ${clueName(id)}`) : ["- None"]),
    "",
    "## Interrogations",
  );

  for (const s of c.suspects) {
    const role = s.id === truth.culpritID ? "culprit" : truth.redHerringIDs.includes(s.id) ? "innocent, red herring" : "innocent";
    const shown = [...state.shownClues[s.id]].map(clueName);
    out.push("", `### ${s.name} (${role})`, "", `Evidence shown: ${shown.length > 0 ? shown.join(", ") : "none"}`, "");

    const convo = state.conversations[s.id];
    if (convo.length === 0) out.push("_Not questioned._", "");
    for (const msg of convo) {
      const text = typeof msg.content === "string" ? msg.content : "";
      out.push(`**${msg.role === "user" ? "You" : s.name}:** ${text}`, "");
    }

    out.push(
      "<details><summary>Final system prompt</summary>",
      "",
      "```text",
      buildSuspectPrompt(c, s, state.shownClues[s.id]),
      "```",
      "",
      "</details>",
    );
  }

  return out.join("\n");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}