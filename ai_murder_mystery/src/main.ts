import "./style.css";
import type { MLCEngine } from "@mlc-ai/web-llm";
import { checkWebGPU } from "./gpu";
import { loadEngine, streamReply } from "./llm";
import { getSeed } from "./seed";
import { generateCase } from "./case/generate";
import type { SuspectID } from "./case/types";
import { createGameState, buildMessages } from "./game/state";
import { runDevChecks } from "./dev-checks";

// --- CASE SETUP ---
const seed = getSeed();
const { case: theCase, truth } = generateCase(seed);
const state = createGameState(theCase);



if (import.meta.env.DEV) runDevChecks();

// --- DOM ELEMENTS ---
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const progressEl = document.querySelector<HTMLProgressElement>("#progress")!;
const chatLog = document.querySelector<HTMLDivElement>("#chat-log")!;
const form = document.querySelector<HTMLFormElement>("#chat-form")!;
const input = document.querySelector<HTMLInputElement>("#chat-input")!;
const sendBtn = document.querySelector<HTMLButtonElement>("#send-btn")!;
const caseNumberEl = document.querySelector<HTMLParagraphElement>("#case-number")!;
const tabsEl = document.querySelector<HTMLElement>("#suspect-tabs")!;

// --- STATE ---
let engine: MLCEngine | null = null;
let isGenerating = false;

// --- UI HELPERS ---
function setStatus(text: string): void {
  statusEl.textContent = text;
}

function scrollToBottom(): void {
  chatLog.scrollTop = chatLog.scrollHeight
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function suspectName(id: SuspectID): string {
  return theCase.suspects.find((s) => s.id === id)?.name ?? id;
}

// Adds "Speaker: Text" to the chat log and returns the text span, so streaming replies can keep updating it.
function addLine(speaker: string, text: string, className: string): HTMLSpanElement {
  const line = document.createElement("p");
  line.className = className;
  
  const name = document.createElement("strong");
  name.textContent = `${speaker}: `;
  
  const body = document.createElement("span");
  body.textContent = text;

  line.append(name, body);
  chatLog.append(line);
  scrollToBottom();
  return body;
}

// --- RENDERING ---
function renderTabs(): void {
  tabsEl.replaceChildren();
  for (const s of theCase.suspects) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = s.id === state.activeSuspectID ? "tab active" : "tab";
    btn.disabled = !engine || isGenerating;

    const name = document.createElement("strong");
    name.textContent = s.name
    const role = document.createElement("small");
    role.textContent = s.role;
    btn.append(name, role);

    btn.addEventListener("click", () => selectSuspects(s.id));
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
    else if (msg.role === "assistant") addLine(name, text, "line-suspect");
  }
}

function updateControls(): void {
  const canChat = engine !== null && !isGenerating && state.activeSuspectID !== null;
  input.disabled = !canChat;
  sendBtn.disabled = !canChat;
  input.placeholder = state.activeSuspectID ? `Question ${suspectName(state.activeSuspectID)}...` : "Choose a crew member to question...";
  renderTabs();
}

// --- ACTIONS ---
function selectSuspects(id: SuspectID): void {
  if (isGenerating) return;
  state.activeSuspectID = id;
  renderChatLog();
  updateControls();
  input.focus();
}

// --- STARTUP ---
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

// --- SENDING A QUESTION ---
form.addEventListener("submit", async (event) =>  {
  event.preventDefault();

  // Capture the suspect now, so the reply always goes to the right conversation.
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

  const replyEl = addLine(name, "", "line-suspect");
  let shown = "";

  try {
    const full = await streamReply(engine, buildMessages(state, theCase, suspectID), (piece) => {
      shown += piece;
      replyEl.textContent = shown;
      scrollToBottom();
    });
    
    conversation.push({ role: "assistant", content: full });
    setStatus(`Questioning ${name}.`);
  } catch (err) {
    console.error(err);
    conversation.pop();
    replyEl.textContent = "(no response)";
    setStatus(`Something went wrong: ${errorMessage(err)}`);
  } finally {
    isGenerating = false;
    updateControls();
    input.focus();
  }
});

init();