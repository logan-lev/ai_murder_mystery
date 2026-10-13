import { checkWebGPU } from "./gpu";
import { loadEngine, streamReply, getModelChoice, setModelChoice, type Engine } from "./llm";
import { getCaseInfo, caseLabel, dayNumber, dailySeed, msUntilNextDay, practiceURL } from "./seed";
import { generateCase } from "./case/generate";
import type { ClueID, RoomID, SuspectID } from "./case/types";
import {
  createGameState,
  buildMessages,
  searchRoom,
  showClue,
  turnsLeft,
  isOver,
  TURN_LIMIT,
  type ActionKind,
} from "./game/state";
import { scoreAccusation, MAX_ACCUSE_EVIDENCE, type Accusation } from "./game/accuse";
import { loadGame, saveGame, pruneSaves, loadStats, recordDailyResult, readFlag, writeFlag } from "./game/save";
import { buildShareText, shareText } from "./game/share";
import { buildReport, downloadText, type ReplyStat } from "./game/export";
import { parseReply, renderWithActions } from "./ui/reply";
import { el, $, formatCountdown } from "./ui/dom";
import { renderEnd, renderStats, COUNTDOWN_CLASS } from "./ui/results";
import { runDevChecks } from "./dev-checks";

// ---------- Case setup ----------
const info = getCaseInfo();
const { case: theCase, truth } = generateCase(info.seed);
const state = loadGame(info.seed, theCase) ?? createGameState(theCase);
const replyStats: ReplyStat[] = [];

// Keep today's daily save even while playing a practice case
pruneSaves(info.mode === "daily" ? [info.seed] : [info.seed, dailySeed(dayNumber())]);

if (import.meta.env.DEV) {
  runDevChecks();
  console.log("Answer key (dev only):", truth);
}

// ---------- DOM elements ----------
const caseNumberEl = $<HTMLElement>("#case-number");
const dailyLink = $<HTMLAnchorElement>("#daily-link");
const exportBtn = $<HTMLButtonElement>("#export-btn");
const stormLabel = $<HTMLElement>("#storm-label");
const stormFill = $<HTMLElement>("#storm-fill");
const statusEl = $<HTMLParagraphElement>("#status");
const progressEl = $<HTMLProgressElement>("#progress");
const roomListEl = $<HTMLElement>("#room-list");
const roomDetailEl = $<HTMLElement>("#room-detail");
const evidenceListEl = $<HTMLUListElement>("#evidence-list");
const evidenceCountEl = $<HTMLElement>("#evidence-count");
const accuseBtn = $<HTMLButtonElement>("#accuse-btn");
const tabsEl = $<HTMLElement>("#suspect-tabs");
const chatLog = $<HTMLDivElement>("#chat-log");
const form = $<HTMLFormElement>("#chat-form");
const input = $<HTMLInputElement>("#chat-input");
const sendBtn = $<HTMLButtonElement>("#send-btn");
const toastEl = $<HTMLElement>("#toast");

const helpDialog = $<HTMLDialogElement>("#help-dialog");
const accuseDialog = $<HTMLDialogElement>("#accuse-dialog");
const accuseForm = $<HTMLFormElement>("#accuse-form");
const endDialog = $<HTMLDialogElement>("#end-dialog");
const statsDialog = $<HTMLDialogElement>("#stats-dialog");
const settingsDialog = $<HTMLDialogElement>("#settings-dialog");

// ---------- Runtime state ----------
let engine: Engine | null = null;
let engineStatus: "loading" | "ready" | "unsupported" | "failed" | "skipped" = "loading";
let isGenerating = false;
let accuseForced = false;
const newClueIDs = new Set<ClueID>(); // highlighted until the next search

// ---------- Helpers ----------
function setStatus(text: string): void {
  statusEl.textContent = text;
}

let toastTimer = 0;
function toast(text: string): void {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.hidden = true), 2500);
}

function persist(): void {
  // Mid-reply the conversation ends in an unanswered question; the completed turn saves instead
  if (!isGenerating) saveGame(info.seed, state);
}

function scrollToBottom(): void {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const suspectName = (id: SuspectID) => theCase.suspects.find((s) => s.id === id)?.name ?? id;
const roomName = (id: RoomID) => theCase.rooms.find((r) => r.id === id)?.name ?? id;
const clueByID = (id: ClueID) => theCase.clues.find((cl) => cl.id === id);

// Can the player still spend turns?
const canAct = () => !isOver(state) && turnsLeft(state) > 0;
const canTalk = () => engine !== null && !isGenerating && state.activeSuspectID !== null && canAct();

// Narration costs tokens, so it's saved for moments that deserve a visible reaction:
// meeting someone, the player acting (in parentheses), or being confronted with evidence.
function shouldNarrate(suspectID: SuspectID, text: string, kind: ActionKind): boolean {
  return kind === "show" || state.conversations[suspectID].length === 0 || /\(.+\)/.test(text);
}

// ---------- Chat rendering ----------
// A single "Speaker: text" line. (Parenthesized actions) get styled.
function addLine(speaker: string, text: string, className: string): void {
  const line = el("p", className, "", [el("strong", "", `${speaker}: `)]);
  const body = el("span");
  renderWithActions(body, text);
  line.append(body);
  chatLog.append(line);
  scrollToBottom();
}

// Shown evidence is stored as "(The investigator shows you the X: ...)" because that wording works best
// for the model. On screen, the short version reads better.
const SHOW_PREFIX = "(The investigator shows you the ";

function addPlayerLine(text: string, suspectName: string): void {
  if (text.startsWith(SHOW_PREFIX)) {
    const clueName = text.slice(SHOW_PREFIX.length).split(":")[0];
    chatLog.append(el("p", "line-show", `You show ${suspectName} the ${clueName}.`));
    scrollToBottom();
  } else {
    addLine("You", text, "line-you");
  }
}

// A suspect reply block: a narration line plus a speech line.
// Returns an update function that re-renders the block from the raw text so far.
function addSuspectReply(name: string): (raw: string) => void {
  const narrationEl = el("p", "line-narration");
  const speechEl = el("span");
  const speechLine = el("p", "line-suspect", "", [el("strong", "", `${name}: `), speechEl]);
  chatLog.append(el("div", "reply", "", [narrationEl, speechLine]));

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

function renderChatLog(): void {
  chatLog.replaceChildren();
  const id = state.activeSuspectID;

  if (!id) {
    addLine("Briefing", theCase.intro, "line-intro");
    chatLog.append(el("p", "line-hint", "Search the station's rooms for evidence, or pick a crew member above to question them."));
    return;
  }

  const name = suspectName(id);
  const history = state.conversations[id];
  if (history.length === 0) addLine("Briefing", `You begin questioning ${name}.`, "line-intro");
  for (const msg of history) {
    const text = typeof msg.content === "string" ? msg.content : "";
    if (msg.role === "user") addPlayerLine(text, name);
    else if (msg.role === "assistant") addSuspectReply(name)(text);
  }
}

// ---------- Station rendering ----------
function renderStorm(): void {
  const left = turnsLeft(state);
  stormLabel.replaceChildren();
  if (isOver(state)) {
    stormLabel.textContent = `Case closed in ${state.actions.length} turns`;
  } else if (left === 0) {
    stormLabel.textContent = "The storm has cleared";
  } else {
    stormLabel.append("Storm clears in ", el("strong", "", String(left)), left === 1 ? " turn" : " turns");
  }
  stormFill.style.width = `${(left / TURN_LIMIT) * 100}%`;
  stormFill.classList.toggle("low", left <= 5);
}

function renderRooms(): void {
  roomListEl.replaceChildren(
    ...theCase.rooms.map((r) => {
      const searched = state.searchedRoomIDs.has(r.id);
      const found = searched && theCase.clues.some((cl) => cl.roomID === r.id);
      const classes = ["room-chip", searched ? "searched" : "", found ? "found" : "", r.id === state.selectedRoomID ? "selected" : ""];
      const btn = el("button", classes.filter(Boolean).join(" "), r.name);
      btn.type = "button";
      btn.title = searched ? (found ? "Searched: evidence found" : "Searched: nothing found") : "Not searched yet";
      btn.addEventListener("click", () => selectRoom(r.id));
      return btn;
    }),
  );
}

function renderRoomDetail(): void {
  const id = state.selectedRoomID;
  if (!id) {
    roomDetailEl.replaceChildren(el("p", "hint", "Pick a room to look around."));
    return;
  }
  const room = theCase.rooms.find((r) => r.id === id)!;
  const parts: Node[] = [el("h3", "", room.name), el("p", "room-desc", room.description)];

  if (state.searchedRoomIDs.has(id)) {
    const here = theCase.clues.filter((cl) => cl.roomID === id);
    parts.push(
      el("p", "hint", here.length > 0 ? `Searched. Found: ${here.map((cl) => cl.name).join(", ")}.` : "Searched. Nothing of interest here."),
    );
  } else {
    const btn = el("button", "primary-btn", "Search this room (1 turn)");
    btn.type = "button";
    btn.disabled = !canAct() || isGenerating;
    btn.addEventListener("click", () => doSearch(id));
    parts.push(btn);
  }
  roomDetailEl.replaceChildren(...parts);
}

function renderEvidence(): void {
  const found = theCase.clues.filter((cl) => state.foundClueIDs.has(cl.id));
  evidenceCountEl.textContent = found.length > 0 ? `(${found.length})` : "";

  if (found.length === 0) {
    evidenceListEl.replaceChildren(el("li", "hint", "Nothing yet. Search rooms to find evidence."));
    return;
  }

  const active = state.activeSuspectID;
  evidenceListEl.replaceChildren(
    ...found.map((cl) => {
      const shownTo = theCase.suspects.filter((s) => state.shownClues[s.id].has(cl.id)).map((s) => s.name);
      const details = el("details", "", "", [
        el("summary", "", "", [el("span", "", cl.name), el("small", "", roomName(cl.roomID))]),
        el("p", "", cl.description),
      ]);
      if (shownTo.length > 0) details.append(el("p", "hint", `Shown to ${shownTo.join(", ")}.`));

      if (!isOver(state)) {
        const alreadyShown = active !== null && state.shownClues[active].has(cl.id);
        const label = !active ? "Pick a crew member to show this" : alreadyShown ? `Already shown to ${suspectName(active)}` : `Show to ${suspectName(active)} (1 turn)`;
        const btn = el("button", "text-btn", label);
        btn.type = "button";
        btn.disabled = !canTalk() || alreadyShown;
        btn.addEventListener("click", () => showEvidence(cl.id));
        details.append(btn);
      }
      return el("li", newClueIDs.has(cl.id) ? "new" : "", "", [details]);
    }),
  );
}

function renderTabs(): void {
  tabsEl.replaceChildren(
    ...theCase.suspects.map((s) => {
      const btn = el("button", s.id === state.activeSuspectID ? "tab active" : "tab", "", [
        el("strong", "", s.name),
        el("small", "", s.role),
      ]);
      btn.type = "button";
      btn.disabled = isGenerating;
      btn.addEventListener("click", () => selectSuspect(s.id));
      return btn;
    }),
  );
}

function chatPlaceholder(): string {
  if (isOver(state)) return "The case is closed.";
  if (turnsLeft(state) === 0) return "The storm has cleared. Make your accusation.";
  if (engineStatus === "unsupported") return "Questioning needs WebGPU. You can still search and accuse.";
  if (engineStatus === "failed") return "The AI failed to load. You can still search and accuse.";
  if (!engine) return "The crew AI is still loading...";
  return state.activeSuspectID ? `Question ${suspectName(state.activeSuspectID)}...` : "Choose a crew member to question...";
}

function updateControls(): void {
  input.disabled = !canTalk();
  sendBtn.disabled = !canTalk();
  input.placeholder = chatPlaceholder();
  exportBtn.disabled = isGenerating;
  accuseBtn.disabled = isGenerating;
  accuseBtn.textContent = isOver(state) ? "View result" : "Make an accusation";
  renderTabs();
}

function renderStation(): void {
  renderStorm();
  renderRooms();
  renderRoomDetail();
  renderEvidence();
  updateControls();
}

// ---------- Actions ----------
function afterTurn(): void {
  persist();
  renderStation();
  if (!isOver(state) && turnsLeft(state) === 0) openAccuse(true);
}

function selectRoom(id: RoomID): void {
  state.selectedRoomID = id;
  persist();
  renderRooms();
  renderRoomDetail();
}

function doSearch(id: RoomID): void {
  if (!canAct() || isGenerating) return;
  const found = searchRoom(state, theCase, id);
  newClueIDs.clear();
  found.forEach((cl) => newClueIDs.add(cl.id));
  toast(found.length > 0 ? `Found: ${found.map((cl) => cl.name).join(", ")}` : `Nothing of interest in the ${roomName(id)}.`);
  afterTurn();
}

function selectSuspect(id: SuspectID): void {
  if (isGenerating) return;
  state.activeSuspectID = id;
  persist();
  renderChatLog();
  renderEvidence();
  updateControls();
  // Skip on touch screens, where focusing pops up the keyboard over the conversation
  if (matchMedia("(pointer: fine)").matches) input.focus();
}

// Sends one player message to a suspect and streams the reply. Returns false if it failed.
async function ask(suspectID: SuspectID, text: string, kind: ActionKind): Promise<boolean> {
  if (!engine || isGenerating || !canAct()) return false;

  const name = suspectName(suspectID);
  const conversation = state.conversations[suspectID];
  const narrate = shouldNarrate(suspectID, text, kind);

  addPlayerLine(text, name);
  conversation.push({ role: "user", content: text });
  state.actions.push(kind);

  isGenerating = true;
  renderStation();
  setStatus(`${name} is responding...`);

  const update = addSuspectReply(name);
  let shown = "";
  let ok = true;

  try {
    const result = await streamReply(engine, buildMessages(state, theCase, suspectID, narrate), (piece) => {
      shown += piece;
      update(shown);
    });
    conversation.push({ role: "assistant", content: result.text });
    replyStats.push({ suspectID, ...result.stats });
    setStatus(`Questioning ${name}.`);
  } catch (err) {
    console.error(err);
    ok = false;
    conversation.pop(); // remove the unanswered question
    state.actions.pop(); // and refund the turn
    update("(no response)");
    setStatus(`Something went wrong: ${errorMessage(err)}`);
  } finally {
    isGenerating = false;
    afterTurn();
    if (matchMedia("(pointer: fine)").matches && !input.disabled) input.focus();
  }
  return ok;
}

async function showEvidence(clueID: ClueID): Promise<void> {
  const suspectID = state.activeSuspectID;
  const clue = clueByID(clueID);
  if (!suspectID || !clue || !canTalk()) return;
  if (!showClue(state, suspectID, clueID)) return;

  // The suspect learns about the clue through the system prompt (EVIDENCE SHOWN, plus any unlocks).
  // This message is what gives the moment a beat in the conversation to react to.
  const ok = await ask(suspectID, `${SHOW_PREFIX}${clue.name}: ${clue.description})`, "show");
  if (!ok) {
    state.shownClues[suspectID].delete(clueID);
    renderEvidence();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  // Capture the suspect now, so the reply always goes to the right conversation
  const suspectID = state.activeSuspectID;
  const text = input.value.trim();
  if (!text || !suspectID || !canTalk()) return;
  input.value = "";
  void ask(suspectID, text, "question");
});

// ---------- Dialogs ----------
// Clicking the dimmed backdrop closes a dialog, except the accusation when the storm forces it
for (const dialog of [helpDialog, statsDialog, settingsDialog, endDialog, accuseDialog]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && !(dialog === accuseDialog && accuseForced)) dialog.close();
  });
}

accuseDialog.addEventListener("cancel", (event) => {
  if (accuseForced) event.preventDefault();
});

function openAccuse(forced: boolean): void {
  if (isOver(state)) {
    openEnd();
    return;
  }
  accuseForced = forced;
  $<HTMLElement>("#accuse-forced").hidden = !forced;
  $<HTMLButtonElement>("#accuse-cancel").hidden = forced;

  $<HTMLElement>("#accuse-suspects").replaceChildren(
    ...theCase.suspects.map((s) => {
      const radio = el("input");
      radio.type = "radio";
      radio.name = "suspect";
      radio.value = s.id;
      radio.required = true;
      return el("label", "choice", "", [radio, el("span", "", "", [el("strong", "", s.name), el("small", "", s.role)])]);
    }),
  );

  const motiveSelect = $<HTMLSelectElement>("#accuse-motive");
  const placeholder = el("option", "", "Choose a motive");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  // Sorted so the list order doesn't hint at which motive belongs to whom
  const motives = [...theCase.motives].sort((a, b) => a.label.localeCompare(b.label));
  motiveSelect.replaceChildren(
    placeholder,
    ...motives.map((m) => {
      const opt = el("option", "", m.label);
      opt.value = m.id;
      return opt;
    }),
  );

  $<HTMLElement>("#accuse-who").textContent = `Who killed ${theCase.victim}?`;
  $<HTMLElement>("#accuse-evidence-legend").textContent = `Evidence (choose up to ${MAX_ACCUSE_EVIDENCE})`;
  const found = theCase.clues.filter((cl) => state.foundClueIDs.has(cl.id));
  const evidenceEl = $<HTMLElement>("#accuse-evidence");
  if (found.length === 0) {
    evidenceEl.replaceChildren(el("p", "hint", "You haven't found any evidence."));
  } else {
    const boxes = found.map((cl) => {
      const box = el("input");
      box.type = "checkbox";
      box.name = "evidence";
      box.value = cl.id;
      return box;
    });
    // Once the cap is reached, the remaining boxes lock until one is unticked
    const enforceCap = () => {
      const full = boxes.filter((b) => b.checked).length >= MAX_ACCUSE_EVIDENCE;
      boxes.forEach((b) => (b.disabled = full && !b.checked));
    };
    boxes.forEach((b) => b.addEventListener("change", enforceCap));
    evidenceEl.replaceChildren(...found.map((cl, i) => el("label", "check", "", [boxes[i], el("span", "", cl.name)])));
  }

  accuseDialog.showModal();
}

$<HTMLButtonElement>("#accuse-cancel").addEventListener("click", () => accuseDialog.close());
accuseBtn.addEventListener("click", () => openAccuse(false));

accuseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(accuseForm);
  const suspectID = String(data.get("suspect") ?? "");
  const motiveID = String(data.get("motive") ?? "");
  if (!suspectID || !motiveID) return;

  const accusation: Accusation = {
    suspectID,
    motiveID,
    clueIDs: data.getAll("evidence").map(String).slice(0, MAX_ACCUSE_EVIDENCE),
  };
  const verdict = scoreAccusation(theCase, accusation);
  state.accusation = accusation;
  state.verdict = verdict;
  if (info.mode === "daily") recordDailyResult(info.day, verdict);

  accuseForced = false;
  accuseDialog.close();
  persist();
  renderStation();
  renderChatLog();
  setStatus(verdict.correctCulprit ? "Case closed." : "The killer got away.");
  openEnd();
});

function openEnd(): void {
  if (!state.verdict) return;
  renderEnd($<HTMLElement>("#end-content"), theCase, truth, info, state, state.verdict);
  tickCountdowns();
  endDialog.showModal();
}

$<HTMLButtonElement>("#end-close").addEventListener("click", () => endDialog.close());

$<HTMLButtonElement>("#share-btn").addEventListener("click", async () => {
  if (!state.verdict) return;
  const text = buildShareText(info, state, state.verdict);
  const result = await shareText(text);
  if (result !== "failed") {
    toast(result === "copied" ? "Result copied to clipboard" : "Shared");
    return;
  }
  // Clipboard blocked: show the text so the player can copy it by hand
  const box = el("textarea", "share-box");
  box.readOnly = true;
  box.value = text;
  box.rows = text.split("\n").length;
  $<HTMLElement>("#end-content").append(box);
  box.select();
  toast("Couldn't copy automatically. Copy the text below.");
});

$<HTMLButtonElement>("#stats-btn").addEventListener("click", () => {
  renderStats($<HTMLElement>("#stats-content"), loadStats(), dayNumber());
  tickCountdowns();
  statsDialog.showModal();
});

$<HTMLButtonElement>("#help-btn").addEventListener("click", () => helpDialog.showModal());

const fastMode = $<HTMLInputElement>("#fast-mode");
fastMode.checked = getModelChoice() === "fast";
fastMode.addEventListener("change", () => {
  setModelChoice(fastMode.checked ? "fast" : "standard");
  $<HTMLElement>("#settings-reload").hidden = false;
});
$<HTMLAnchorElement>("#practice-link").addEventListener("click", (event) => {
  event.preventDefault();
  window.location.href = practiceURL();
});
$<HTMLButtonElement>("#settings-btn").addEventListener("click", () => settingsDialog.showModal());

// The export holds the answer key, so it's a dev-only tool
exportBtn.hidden = !import.meta.env.DEV;
exportBtn.addEventListener("click", () => {
  const report = buildReport(theCase, truth, state, replyStats);
  downloadText(`dead-orbit-case-${info.seed}.md`, report);
});

// ---------- Countdown to the next daily case ----------
function tickCountdowns(): void {
  const stale = info.mode === "daily" && dayNumber() > info.day;
  const text = stale ? "now. Reload!" : formatCountdown(msUntilNextDay());
  document.querySelectorAll(`.${COUNTDOWN_CLASS}`).forEach((node) => (node.textContent = text));
}
setInterval(tickCountdowns, 1000);

// ---------- Startup ----------
async function init(): Promise<void> {
  caseNumberEl.textContent = caseLabel(info);
  dailyLink.hidden = info.mode === "daily";
  document.title = `Dead Orbit: ${caseLabel(info)}`;
  renderChatLog();
  renderStation();

  if (!readFlag("seen-help")) {
    writeFlag("seen-help", true);
    helpDialog.showModal();
  }

  // Finished or out of turns: no more questions, so skip the large model download entirely
  if (isOver(state)) {
    engineStatus = "skipped";
    progressEl.hidden = true;
    setStatus(info.mode === "daily" ? "You've closed today's case. Come back tomorrow for a new one." : "Case closed.");
    openEnd();
    return;
  }
  if (turnsLeft(state) === 0) {
    engineStatus = "skipped";
    progressEl.hidden = true;
    setStatus("The storm has cleared.");
    openAccuse(true);
    return;
  }

  const gpu = await checkWebGPU();
  if (!gpu.ok) {
    engineStatus = "unsupported";
    setStatus(gpu.reason);
    progressEl.hidden = true;
    updateControls();
    return;
  }

  setStatus("Loading the crew AI. You can search the station while it loads.");
  try {
    engine = await loadEngine((text, progress) => {
      setStatus(text);
      progressEl.value = progress;
    });
  } catch (err) {
    console.error(err);
    engineStatus = "failed";
    progressEl.hidden = true;
    setStatus(`Failed to load the model: ${errorMessage(err)}`);
    updateControls();
    return;
  }

  engineStatus = "ready";
  progressEl.hidden = true;
  setStatus("Systems online. Choose a crew member to question.");
  renderStation();
}

init();
