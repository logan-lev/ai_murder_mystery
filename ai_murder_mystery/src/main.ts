import type { MLCEngine } from "@mlc-ai/web-llm";
import { checkWebGPU } from "./gpu";
import { loadEngine, streamReply } from "./llm";
import { getSeed } from "./seed";
import { generateCase } from "./case/generate";
import type { SuspectID } from "./case/types";
import { createGameState, buildMessages } from "./game/state";
import { buildReport, downloadText, type ReplyStat } from "./game/export";
import { parseReply, renderWithActions } from "./ui/reply";
import { runDevChecks } from "./dev-checks";

// ---------- Case setup ----------
const seed = getSeed();
const { case: theCase, truth } = generateCase(seed);
const state = createGameState(theCase);
const replyStats: ReplyStat[] = [];

if (import.meta.env.DEV) {
  runDevChecks();
  console.log("Answer key (dev only):", truth);
}

// ---------- DOM elements ----------
const caseNumberEl = document.querySelector<HTMLElement>("#case-number")!;
const exportBtn = document.querySelector<HTMLButtonElement>("#export-btn")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const progressEl = document.querySelector<HTMLProgressElement>("#progress")!;
const tabsEl = document.querySelector<HTMLElement>("#suspect-tabs")!;
const chatLog = document.querySelector<HTMLDivElement>("#chat-log")!;
const form = document.querySelector<HTMLFormElement>("#chat-form")!;
const input = document.querySelector<HTMLInputElement>("#chat-input")!;
const sendBtn = document.querySelector<HTMLButtonElement>("#send-btn")!;

// ---------- Runtime state ----------
let engine: MLCEngine | null = null;
let isGenerating = false;

// ---------- Helpers ----------
function setStatus(text: string): void {
  statusEl.textContent = text;
}

function scrollToBottom(): void {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function suspectName(id: SuspectID): string {
  return theCase.suspects.find((s) => s.id === id)?.name ?? id;
}

// A single "Speaker: text" line. (Parenthesized actions) get styled.
function addLine(speaker: string, text: string, className: string): void {
  const line = document.createElement("p");
  line.className = className;
  const name = document.createElement("strong");
  name.textContent = `${speaker}: `;
  const body = document.createElement("span");
  renderWithActions(body, text);
  line.append(name, body);
  chatLog.append(line);
  scrollToBottom();
}

// A suspect reply block: a narration line plus a speech line.
// Returns an update function that re-renders the block from the raw text so far.
function addSuspectReply(name: string): (raw: string) => void {
  const block = document.createElement("div");
  block.className = "reply";

  const narrationEl = document.createElement("p");
  narrationEl.className = "line-narration";

  const speechLine = document.createElement("p");
  speechLine.className = "line-suspect";
  const nameEl = document.createElement("strong");
  nameEl.textContent = `${name}: `;
  const speechEl = document.createElement("span");
  speechLine.append(nameEl, speechEl);

  block.append(narrationEl, speechLine);
  chatLog.append(block);

  const update = (raw: string) => {
    const { narration, speech } = parseReply(raw);
    narrationEl.textContent = narration;
    narrationEl.hidden = narration === "";
    // Hide the speech line while only narration has arrived; show "…" before anything arrives
    speechLine.hidden = speech === "" && narration !== "";
    renderWithActions(speechEl, raw === "" ? "…" : speech);
    scrollToBottom();
  };

  update("");
  return update;
}

// ---------- Rendering ----------
function renderTabs(): void {
  tabsEl.replaceChildren();
  for (const s of theCase.suspects) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = s.id === state.activeSuspectID ? "tab active" : "tab";
    btn.disabled = !engine || isGenerating;

    const name = document.createElement("strong");
    name.textContent = s.name;
    const role = document.createElement("small");
    role.textContent = s.role;
    btn.append(name, role);

    btn.addEventListener("click", () => selectSuspect(s.id));
    tabsEl.append(btn);
  }
}

function renderChatLog(): void {
  chatLog.replaceChildren();
  const id = state.activeSuspectID;

  if (!id) {
    addLine("Briefing", theCase.intro, "line-intro");
    return;
  }

  const name = suspectName(id);
  const history = state.conversations[id];
  if (history.length === 0) {
    addLine("Briefing", `You begin questioning ${name}.`, "line-intro");
  }
  for (const msg of history) {
    const text = typeof msg.content === "string" ? msg.content : "";
    if (msg.role === "user") addLine("You", text, "line-you");
    else if (msg.role === "assistant") addSuspectReply(name)(text);
  }
}

function updateControls(): void {
  const canChat = engine !== null && !isGenerating && state.activeSuspectID !== null;
  input.disabled = !canChat;
  sendBtn.disabled = !canChat;
  exportBtn.disabled = isGenerating;
  input.placeholder = state.activeSuspectID
    ? `Question ${suspectName(state.activeSuspectID)}...`
    : "Choose a crew member to question...";
  renderTabs();
}

// ---------- Actions ----------
function selectSuspect(id: SuspectID): void {
  if (isGenerating) return;
  state.activeSuspectID = id;
  renderChatLog();
  updateControls();
  input.focus();
}

exportBtn.addEventListener("click", () => {
  const report = buildReport(theCase, truth, state, replyStats);
  downloadText(`dead-orbit-case-${seed}.md`, report);
});

// ---------- Startup ----------
async function init(): Promise<void> {
  caseNumberEl.textContent = `Case #${seed}`;
  document.title = theCase.title;
  renderChatLog();
  updateControls();

  const gpu = await checkWebGPU();
  if (!gpu.ok) {
    setStatus(gpu.reason);
    progressEl.hidden = true;
    return;
  }

  setStatus("Loading the model...");
  try {
    engine = await loadEngine((text, progress) => {
      setStatus(text);
      progressEl.value = progress;
    });
  } catch (err) {
    console.error(err);
    setStatus(`Failed to load the model: ${errorMessage(err)}`);
    return;
  }

  progressEl.hidden = true;
  setStatus("Systems online. Choose a crew member to question.");
  updateControls();
}

// ---------- Sending a question ----------
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Capture the suspect now, so the reply always goes to the right conversation
  const suspectID = state.activeSuspectID;
  const text = input.value.trim();
  if (!text || !engine || isGenerating || !suspectID) return;

  const name = suspectName(suspectID);
  const conversation = state.conversations[suspectID];

  addLine("You", text, "line-you");
  conversation.push({ role: "user", content: text });
  input.value = "";

  isGenerating = true;
  updateControls();
  setStatus(`${name} is responding...`);

  const update = addSuspectReply(name);
  let shown = "";

  try {
    const result = await streamReply(engine, buildMessages(state, theCase, suspectID), (piece) => {
      shown += piece;
      update(shown);
    });
    conversation.push({ role: "assistant", content: result.text });
    replyStats.push({ suspectID, ...result.stats });
    setStatus(`Questioning ${name}.`);
  } catch (err) {
    console.error(err);
    conversation.pop(); // remove the unanswered question
    update("(no response)");
    setStatus(`Something went wrong: ${errorMessage(err)}`);
  } finally {
    isGenerating = false;
    updateControls();
    input.focus();
  }
});

init();