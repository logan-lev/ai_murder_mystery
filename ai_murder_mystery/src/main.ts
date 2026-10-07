import "./style.css";
import type { MLCEngine, ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { checkWebGPU } from "./gpu";
import { loadEngine, streamReply } from "./llm";
import { BUTLER_PROMPT } from "./prompts";

// --- DOM ELEMENTS ---
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const progressEl = document.querySelector<HTMLProgressElement>("#progress")!;
const chatLog = document.querySelector<HTMLDivElement>("#chat-log")!;
const form = document.querySelector<HTMLFormElement>("#chat-form")!;
const input = document.querySelector<HTMLInputElement>("#chat-input")!;
const sendBtn = document.querySelector<HTMLButtonElement>("#send-btn")!;

// --- STATE ---
let engine: MLCEngine | null = null;

const messages: ChatCompletionMessageParam[] = [
  { role: "system", content: BUTLER_PROMPT }
];

let isGenerating = false;

// --- UI HELPERS ---
function setStatus(text: string): void {
  statusEl.textContent = text;
}

function setControlsEnabled(enabled: boolean): void {
  input.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

function scrollToBottom(): void {
  chatLog.scrollTop = chatLog.scrollHeight
}

// Adds "Speaker: Text" to the chat log and returns the text span, so streaming replies can keep updating it.
function addLine(speaker: string, text = ""): HTMLSpanElement {
  const line = document.createElement("p");
  line.className = speaker === "You" ? "line-you" : "line-suspect";
  
  const name = document.createElement("strong");
  name.textContent = `${speaker}: `;
  
  const body = document.createElement("span");
  body.textContent = text;

  line.append(name, body);
  chatLog.append(line);
  scrollToBottom();
  return body;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// --- STARTUP ---
async function init(): Promise<void> {
  setControlsEnabled(false);

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
  setStatus("Mr. Graves is ready to talk.");
  setControlsEnabled(true);
  input.focus();
}

// --- SENDING A MESSAGE ---
form.addEventListener("submit", async (event) =>  {
  event.preventDefault();

  const text = input.value.trim();
  if (!text || isGenerating || !engine) return;

  addLine("You", text);
  messages.push({ role: "user", content: text});
  input.value = "";

  isGenerating = true;
  setControlsEnabled(false);
  setStatus("Mr. Graves is thinking...");

  const replyEl = addLine("Mr. Graves");
  let shown = "";

  try {
    const full = await streamReply(engine, messages, (piece) => {
      shown += piece;
      replyEl.textContent = shown;
      scrollToBottom();
    });
    messages.push({ role: "assistant", content: full });
    setStatus("Mr. Graves is ready to talk.");
  } catch (err) {
    console.error(err);
    // Remove the unanswered question so the history stays consistent.
    messages.pop();
    replyEl.textContent = "(no response)";
    setStatus(`Something went wrong: ${errorMessage(err)}`);
  } finally {
    isGenerating = false;
    setControlsEnabled(true);
    input.focus();
  }
});

init();