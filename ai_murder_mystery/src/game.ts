import { checkWebGPU } from "./gpu";
import { loadEngine, streamReply, type Engine } from "./llm";
import { wireHelp, wireSettings, closeOnBackdrop } from "./ui/common";
import { getCaseInfo, caseLabel, dayNumber, dailySeed, msUntilNextDay, dailyURL } from "./seed";
import { TUTORIAL_CASE, TUTORIAL_TRUTH, QUESTIONS, SHOWS, SHOW_FALLBACK, isAsked } from "./tutorial/case";
import { Coach } from "./tutorial/coach";
import { renderBoard } from "./ui/board";
import { SLOTS, STATION_ROOMS } from "./case/content";
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
import { scoreAccusation, PROOF_SLOTS, type Accusation } from "./game/accuse";
import { loadGame, saveGame, pruneSaves, loadStats, recordDailyResult, recordHistory, readFlag, writeFlag } from "./game/save";
import { buildShareText, shareText } from "./game/share";
import { buildReport, downloadText, type ReplyStat } from "./game/export";
import { guardReply, isRoleplayRequest, roleplayRefusal, polishNarration, stripFalseCallbacks, isCameraQuestion, cameraReply } from "./game/guard";
import { parseReply, renderWithActions } from "./ui/reply";
import { el, $, formatCountdown } from "./ui/dom";
import { renderEnd, renderStats, COUNTDOWN_CLASS } from "./ui/results";
import { SOLVING_GUIDE } from "./ui/guide";
import { runDevChecks } from "./dev-checks";

// ---------- Case setup ----------
const info = getCaseInfo();
const isTutorial = info.mode === "tutorial";
const { case: theCase, truth } = isTutorial ? { case: TUTORIAL_CASE, truth: TUTORIAL_TRUTH } : generateCase(info.seed);
// Training restarts whenever the player leaves and comes back. Only a reload of the page resumes it,
// so an accidental refresh doesn't throw away progress.
const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
const resumeTraining = navigation?.type === "reload";
const state = (isTutorial && !resumeTraining ? null : loadGame(info.seed, theCase)) ?? createGameState(theCase);

// Back/forward can restore this page from memory with the old training still on it, so start over
if (isTutorial) {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.replace(window.location.href);
  });
}
const replyStats: ReplyStat[] = [];

// Keep today's daily save even while playing a practice case
pruneSaves([info.seed, dailySeed(dayNumber()), 0]);

if (import.meta.env.DEV) {
  runDevChecks();
  console.log("Answer key (dev only):", truth);
}

// ---------- DOM elements ----------
const caseNumberEl = $<HTMLElement>("#case-number");
const exportBtn = $<HTMLButtonElement>("#export-btn");
const stormLabel = $<HTMLElement>("#storm-label");
const stormFill = $<HTMLElement>("#storm-fill");
const statusEl = $<HTMLParagraphElement>("#status");
const progressEl = $<HTMLProgressElement>("#progress");
const roomListEl = $<HTMLElement>("#room-list");
const roomDetailEl = $<HTMLElement>("#room-detail");
const evidenceListEl = $<HTMLUListElement>("#evidence-list");
const searchLogEl = $<HTMLElement>("#search-log");
const boardEl = $<HTMLElement>("#board");
const trayEl = $<HTMLElement>("#evidence-tray");
const viewEls = {
  station: $<HTMLElement>("#view-station"),
  evidence: $<HTMLElement>("#view-evidence"),
  timeline: $<HTMLElement>("#view-timeline"),
  suspect: $<HTMLElement>("#view-suspect"),
};
const accuseBtn = $<HTMLButtonElement>("#accuse-btn");
const tabsEl = $<HTMLElement>("#suspect-tabs");
const chatLog = $<HTMLDivElement>("#chat-log");
const form = $<HTMLFormElement>("#chat-form");
const input = $<HTMLInputElement>("#chat-input");
const sendBtn = $<HTMLButtonElement>("#send-btn");
const toastEl = $<HTMLElement>("#toast");
const chipsEl = $<HTMLElement>("#question-chips");
const coachEl = $<HTMLElement>("#coach");

const helpDialog = $<HTMLDialogElement>("#help-dialog");
const accuseDialog = $<HTMLDialogElement>("#accuse-dialog");
const accuseForm = $<HTMLFormElement>("#accuse-form");
const endDialog = $<HTMLDialogElement>("#end-dialog");
const statsDialog = $<HTMLDialogElement>("#stats-dialog");

// ---------- Runtime state ----------
let engine: Engine | null = null;
let engineStatus: "loading" | "ready" | "unsupported" | "failed" | "skipped" = "loading";
let isGenerating = false;
let accuseForced = false;
const newClueIDs = new Set<ClueID>(); // highlighted until the next search
// Which folder tab is open. A crew member's tab is "suspect" with state.activeSuspectID set.
type View = keyof typeof viewEls;
let view: View = state.activeSuspectID ? "suspect" : "station";

const coach = isTutorial
  ? new Coach(coachEl, {
      daily: () => (window.location.href = dailyURL(dayNumber())),
      replay: () => retryCase(),
    })
  : null;
// persist() skips saving mid-reply, so coach progress is never saved ahead of the conversation
const coachRender = () => coach?.render({ state, boardOpen: view === "timeline", save: persist });

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
// Station rooms take "the" ("the Galley", "the Commander's Office"); cabins don't ("Park's Cabin")
const theRoom = (id: RoomID) => (STATION_ROOMS.some((r) => r.id === id) ? `the ${roomName(id)}` : roomName(id));
const clueByID = (id: ClueID) => theCase.clues.find((cl) => cl.id === id);

// Can the player still spend turns?
const canAct = () => !isOver(state) && turnsLeft(state) > 0;
// Can any crew member be questioned or shown evidence right now? (The tutorial's answers are scripted,
// so it never waits on the model.) canTalk adds that a crew member's tab is open, for the text box.
const canTalkNow = () => (engine !== null || isTutorial) && !isGenerating && canAct();
const canTalk = () => view === "suspect" && state.activeSuspectID !== null && canTalkNow();

// Narration costs tokens, so it's saved for moments that deserve a visible reaction:
// meeting someone, or being confronted with evidence.
function shouldNarrate(suspectID: SuspectID, kind: ActionKind): boolean {
  return kind === "show" || state.conversations[suspectID].length === 0;
}

// ---------- Chat rendering ----------
// A single "Speaker: text" line. The player's own words are plain text: actions are only for the crew.
function addLine(speaker: string, text: string, className: string, styleActions = false): void {
  const line = el("p", className, "", [el("strong", "", `${speaker}: `)]);
  const body = el("span");
  if (styleActions) renderWithActions(body, text);
  else body.textContent = text;
  line.append(body);
  chatLog.append(line);
  scrollToBottom();
}

// Shown evidence is stored as "(The investigator shows you the X: ...)" because that wording works best
// for the model. On screen, the short version reads better.
const SHOW_PREFIX = "(The investigator shows you the ";

function addPlayerLine(text: string, suspectID: SuspectID): void {
  const clueName = text.startsWith(SHOW_PREFIX) ? text.slice(SHOW_PREFIX.length).split(":")[0] : "";
  // A typed imitation of the show format renders as a normal line, not as real evidence
  const reallyShown = theCase.clues.some((cl) => cl.name === clueName && state.shownClues[suspectID].has(cl.id));
  if (reallyShown) {
    chatLog.append(el("p", "line-show", `You show ${suspectName(suspectID)} the ${clueName}.`));
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

// Shows the open folder tab and fills it. The conversation and board are only rebuilt here,
// on a tab change, so a reply that's streaming in is never wiped by other re-renders.
function renderView(): void {
  for (const [name, node] of Object.entries(viewEls)) node.hidden = name !== view;
  if (view === "suspect" && state.activeSuspectID) renderConversation(state.activeSuspectID);
  if (view === "timeline") renderBoardView();
  if (view === "station") scrollLogToBottom();
  coachRender();
}

function renderConversation(id: SuspectID): void {
  chatLog.replaceChildren();
  const name = suspectName(id);
  const history = state.conversations[id];
  if (history.length === 0) chatLog.append(el("p", "line-intro", `You begin questioning ${name}.`));
  for (const msg of history) {
    const text = typeof msg.content === "string" ? msg.content : "";
    if (msg.role === "user") addPlayerLine(text, id);
    else if (msg.role === "assistant") addSuspectReply(name)(text);
  }
  scrollToBottom();
}

// Newest finds are at the bottom; before any search, stay at the top so the briefing reads from the start
function scrollLogToBottom(): void {
  searchLogEl.scrollTop = state.searchedRoomIDs.size > 0 ? searchLogEl.scrollHeight : 0;
}

// The Station tab's log: the briefing, how to solve, and everything found, in the order it was found
function renderSearchLog(): void {
  const parts: Node[] = [el("p", "briefing", "", [el("strong", "", "Briefing. "), theCase.intro])];
  const guide = el("details", "guide", "", [
    el("summary", "", "How to crack the case"),
    el("ol", "", "", SOLVING_GUIDE.map((tip) => el("li", "", tip))),
  ]);
  guide.open = state.searchedRoomIDs.size === 0;
  // In training the coach teaches this step by step, and the full guide mentions secrets training doesn't have
  if (!isTutorial) parts.push(guide);

  if (state.searchedRoomIDs.size === 0) {
    parts.push(el("p", "hint", "Pick a room and search it. What you find is logged here and filed in the Evidence tab."));
  }
  for (const roomID of state.searchedRoomIDs) {
    const found = theCase.clues.filter((cl) => cl.roomID === roomID);
    const block = el("div", "discovery", "", [el("p", "discovery-title", `You search ${theRoom(roomID)}.`)]);
    if (found.length === 0) block.append(el("p", "hint", "Nothing of interest here."));
    for (const cl of found) {
      block.append(el("div", newClueIDs.has(cl.id) ? "clue-card new" : "clue-card", "", [el("strong", "", cl.name), el("p", "", cl.description)]));
    }
    parts.push(block);
  }
  searchLogEl.replaceChildren(...parts);
  scrollLogToBottom();
}

function renderBoardView(): void {
  renderBoard(boardEl, theCase, state, {
    // The body's description gives the time of death, so the column lights up once it's found
    deathSlot: state.foundClueIDs.has("body") ? SLOTS.indexOf(truth.murderTime) : null,
    onPin: (suspectID, slot, roomID) => {
      state.board[suspectID][slot] = roomID;
      persist();
      coachRender();
    },
  });
}

function showButton(clueID: ClueID, suspectID: SuspectID, label: string): HTMLButtonElement {
  const btn = el("button", "show-btn", label);
  btn.type = "button";
  btn.dataset.clue = clueID;
  btn.dataset.for = suspectID;
  btn.disabled = !canTalkNow() || state.shownClues[suspectID].has(clueID);
  btn.title = state.shownClues[suspectID].has(clueID) ? `Already shown to ${suspectName(suspectID)}` : `Show to ${suspectName(suspectID)} (1 turn)`;
  btn.addEventListener("click", () => void showEvidence(clueID, suspectID));
  return btn;
}

// In a crew member's tab: every found clue not yet shown to them, one click away
function renderTray(): void {
  const id = state.activeSuspectID;
  trayEl.hidden = !id || isOver(state);
  if (!id || isOver(state)) return;
  const unshown = theCase.clues.filter((cl) => state.foundClueIDs.has(cl.id) && !state.shownClues[id].has(cl.id));
  trayEl.replaceChildren(
    el("span", "tray-label", unshown.length > 0 ? "Show evidence (1 turn):" : "No new evidence to show. Search rooms to find more."),
    ...unshown.map((cl) => showButton(cl.id, id, cl.name)),
  );
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
      btn.dataset.room = r.id;
      btn.title = searched ? (found ? "Searched: evidence found" : "Searched: nothing found") : "Not searched yet";
      btn.addEventListener("click", () => selectRoom(r.id));
      return btn;
    }),
  );
}

function renderRoomDetail(): void {
  const id = state.selectedRoomID;
  roomDetailEl.dataset.room = id ?? "";
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

// The Evidence tab: every clue found, as file cards with full descriptions and a Show button per crew member
function renderEvidence(): void {
  const found = theCase.clues.filter((cl) => state.foundClueIDs.has(cl.id));
  if (found.length === 0) {
    evidenceListEl.replaceChildren(el("li", "hint", "Nothing yet. Search rooms in the Station tab to find evidence."));
    return;
  }
  evidenceListEl.replaceChildren(
    ...found.map((cl) => {
      const card = el("li", newClueIDs.has(cl.id) ? "evidence-card new" : "evidence-card", "", [
        el("div", "evidence-head", "", [el("strong", "", cl.name), el("small", "", roomName(cl.roomID))]),
        el("p", "", cl.description),
      ]);
      if (!isOver(state)) {
        card.append(
          el("div", "show-row", "", [
            el("span", "tray-label", "Show to:"),
            ...theCase.suspects.map((s) => showButton(cl.id, s.id, s.shortName)),
          ]),
        );
      }
      return card;
    }),
  );
}

function folderTab(id: string, title: string, sub: string, active: boolean, extraClass: string, onClick: () => void): HTMLButtonElement {
  const btn = el("button", `tab ${extraClass}${active ? " active" : ""}`, "", [el("strong", "", title), el("small", "", sub)]);
  btn.type = "button";
  btn.dataset.tab = id;
  btn.disabled = isGenerating;
  btn.setAttribute("aria-pressed", String(active));
  btn.title = `${title}: ${sub}`;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderTabs(): void {
  const found = state.foundClueIDs.size;
  tabsEl.replaceChildren(
    folderTab("station", "Station", `${state.searchedRoomIDs.size} of ${theCase.rooms.length} searched`, view === "station", "tab-file", () => selectView("station")),
    folderTab("evidence", "Evidence", `${found} item${found === 1 ? "" : "s"}`, view === "evidence", "tab-file", () => selectView("evidence")),
    folderTab("timeline", "Timeline", "Pin the crew", view === "timeline", "tab-file", () => selectView("timeline")),
    ...theCase.suspects.map((s) =>
      folderTab(s.id, s.shortName, s.role, view === "suspect" && s.id === state.activeSuspectID, "tab-crew", () => selectView("suspect", s.id)),
    ),
  );
}

function chatPlaceholder(): string {
  if (isOver(state)) return "The case is closed.";
  if (turnsLeft(state) === 0) return "The storm has cleared. Make your accusation.";
  if (engineStatus === "unsupported") return "Questioning needs WebGPU. You can still search and accuse.";
  if (engineStatus === "failed") return "The AI failed to load. You can still search and accuse.";
  if (!engine) return "The crew AI is still loading...";
  return state.activeSuspectID ? `Question ${suspectName(state.activeSuspectID)}...` : "Ask a question...";
}

function updateControls(): void {
  input.disabled = !canTalk();
  sendBtn.disabled = !canTalk();
  input.placeholder = chatPlaceholder();
  exportBtn.disabled = isGenerating;
  accuseBtn.disabled = isGenerating;
  accuseBtn.textContent = isOver(state) ? "View result" : "Accuse";
  renderTabs();
  renderChips();
  coachRender();
}

// Tutorial only: preset questions replace the text box, so every answer is known in advance
function renderChips(): void {
  chipsEl.hidden = !isTutorial;
  form.hidden = isTutorial;
  if (!isTutorial) return;

  const id = state.activeSuspectID;
  if (!id) {
    chipsEl.replaceChildren(el("p", "hint", "Open a crew member's tab to question them."));
    return;
  }
  const shownToThem = state.shownClues[id];
  const available = (QUESTIONS[id] ?? []).filter(
    (q) =>
      !isAsked(state, q.id) &&
      (q.afterShown ?? []).every((clue) => shownToThem.has(clue)) &&
      (q.afterAsked ?? []).every((qid) => isAsked(state, qid)),
  );
  if (available.length === 0) {
    chipsEl.replaceChildren(el("p", "hint", `No more questions for ${suspectName(id)} right now. Try showing evidence.`));
    return;
  }
  chipsEl.replaceChildren(
    ...available.map((q) => {
      const chip = el("button", "chip", q.text);
      chip.type = "button";
      chip.dataset.q = q.id;
      chip.disabled = !canTalk();
      chip.addEventListener("click", () => void ask(id, q.text, "question", q.answer));
      return chip;
    }),
  );
}

function renderStation(): void {
  renderStorm();
  renderRooms();
  renderRoomDetail();
  renderSearchLog();
  renderEvidence();
  renderTray();
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
  coachRender();
}

function doSearch(id: RoomID): void {
  if (!canAct() || isGenerating) return;
  const found = searchRoom(state, theCase, id);
  newClueIDs.clear();
  found.forEach((cl) => newClueIDs.add(cl.id));
  // Searching happens in the Station tab, whose log shows the new evidence and its description
  view = "station";
  renderView();
  afterTurn();
}

function selectView(next: View, suspectID?: SuspectID): void {
  if (isGenerating) return;
  view = next;
  if (next === "suspect" && suspectID) state.activeSuspectID = suspectID;
  persist();
  renderView();
  renderTray();
  updateControls();
  // Skip on touch screens, where focusing pops up the keyboard over the conversation
  if (next === "suspect" && matchMedia("(pointer: fine)").matches) input.focus();
}

// Sends one player message to a suspect and streams the reply. Returns false if it failed.
// In the tutorial, `scripted` is the fixed answer and the model is never called.
async function ask(suspectID: SuspectID, text: string, kind: ActionKind, scripted?: string): Promise<boolean> {
  if ((!engine && scripted === undefined) || isGenerating || !canAct()) return false;

  const name = suspectName(suspectID);
  const conversation = state.conversations[suspectID];
  const narrate = shouldNarrate(suspectID, kind);

  addPlayerLine(text, suspectID);
  conversation.push({ role: "user", content: text });
  state.actions.push(kind);

  isGenerating = true;
  renderStation();
  setStatus(`${name} is responding...`);

  const update = addSuspectReply(name);
  let shown = "";
  let ok = true;

  try {
    const others = theCase.suspects.filter((s) => s.id !== suspectID).map((s) => s.name);
    const noStats = { firstTokenMs: 0, totalMs: 0, tokens: 0 };
    if (scripted !== undefined) await new Promise((r) => setTimeout(r, 500)); // a beat, so it reads like a reply
    const result =
      scripted !== undefined
        ? { text: scripted, stats: noStats }
        : kind === "question" && isRoleplayRequest(text, others)
        ? { text: roleplayRefusal(name, narrate), stats: noStats }
        : kind === "question" && isCameraQuestion(text)
        ? { text: cameraReply(name, narrate), stats: noStats }
        : await streamReply(engine!, buildMessages(state, theCase, suspectID, narrate), (piece) => {
            shown += piece;
            update(shown);
          });
    // Saving the guarded text keeps a broken reply out of the history the model sees next turn
    const suspect = theCase.suspects.find((s) => s.id === suspectID)!;
    const firstReply = !conversation.some((m) => m.role === "assistant");
    const guarded = guardReply(result.text, name, narrate);
    const reply = polishNarration(firstReply ? stripFalseCallbacks(guarded) : guarded, suspect.pronouns.his);
    update(reply);
    conversation.push({ role: "assistant", content: reply });
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

// Works from the Evidence tab or a crew member's tray; either way the conversation opens to show the reaction
async function showEvidence(clueID: ClueID, suspectID: SuspectID): Promise<void> {
  const clue = clueByID(clueID);
  if (!clue || !canTalkNow()) return;
  if (view !== "suspect" || state.activeSuspectID !== suspectID) selectView("suspect", suspectID);
  if (!showClue(state, suspectID, clueID)) return;

  // The suspect learns about the clue through the system prompt (EVIDENCE SHOWN, plus any unlocks).
  // This message is what gives the moment a beat in the conversation to react to.
  const scripted = isTutorial
    ? (SHOWS[suspectID] ?? []).find(
        (s) => s.clueID === clueID && (s.afterShown ?? []).every((id) => state.shownClues[suspectID].has(id)),
      )?.answer ?? SHOW_FALLBACK
    : undefined;
  const ok = await ask(suspectID, `${SHOW_PREFIX}${clue.name}: ${clue.description})`, "show", scripted);
  if (!ok) {
    state.shownClues[suspectID].delete(clueID);
    renderEvidence();
    renderTray();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  // Capture the suspect now, so the reply always goes to the right conversation
  const suspectID = state.activeSuspectID;
  // maxlength only limits typing; a pasted or scripted value can still be longer
  const text = input.value.trim().slice(0, input.maxLength > 0 ? input.maxLength : 300);
  if (!text || !suspectID || !canTalk()) return;
  // Free-form actions let the player narrate things the case never contained, so speech only
  if (/[()[\]]/.test(text)) {
    toast("Just type what you'd say. Actions in ( ) or [ ] aren't supported.");
    return;
  }
  // Describing evidence in a message doesn't count as showing it (only EVIDENCE SHOWN is real to a
  // suspect), and new players miss that. Point them at the Show button, but still send the message.
  const lower = text.toLowerCase();
  const described = theCase.clues.find(
    (cl) =>
      cl.id !== "body" &&
      state.foundClueIDs.has(cl.id) &&
      !state.shownClues[suspectID].has(cl.id) &&
      cl.name.toLowerCase().split(/[\s-]+/).some((word) => word.length >= 5 && lower.includes(word)),
  );
  if (described) toast(`Tip: to confront ${suspectName(suspectID)} with the ${described.name}, use the evidence tray under the conversation.`);

  input.value = "";
  void ask(suspectID, text, "question");
});

// ---------- Dialogs ----------
// Clicking the dimmed backdrop closes a dialog, except the accusation when the storm forces it
closeOnBackdrop(statsDialog);
closeOnBackdrop(endDialog);
closeOnBackdrop(accuseDialog, () => !accuseForced);

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

  $<HTMLElement>("#accuse-who").textContent = `Who killed ${theCase.victim}?`;
  const found = theCase.clues.filter((cl) => state.foundClueIDs.has(cl.id));
  // One row per clue, one radio column per proof slot: every option is visible at once,
  // and each column (a radio group) holds exactly one pick
  const proofEl = $<HTMLElement>("#accuse-proof");
  if (found.length === 0) {
    proofEl.replaceChildren(el("p", "hint", "You haven't found any evidence."));
  } else {
    const head = el("tr", "", "", [
      el("th", "", "Evidence"),
      ...PROOF_SLOTS.map((slot) => {
        const th = el("th", "", "", [el("span", "", slot.label), el("small", "", slot.question)]);
        th.scope = "col";
        return th;
      }),
    ]);
    const rows = found.map((cl) => {
      const label = el("th", "", "", [el("span", "", cl.name), el("small", "", roomName(cl.roomID))]);
      label.scope = "row";
      label.title = cl.description;
      return el("tr", "", "", [
        label,
        ...PROOF_SLOTS.map((slot) => {
          const radio = el("input");
          radio.type = "radio";
          radio.name = slot.key;
          radio.value = cl.id;
          radio.setAttribute("aria-label", `${cl.name} as ${slot.label.toLowerCase()}`);
          return el("td", "", "", [el("label", "proof-cell", "", [radio])]);
        }),
      ]);
    });
    proofEl.replaceChildren(
      el("div", "table-wrap", "", [el("table", "proof-grid", "", [el("thead", "", "", [head]), el("tbody", "", "", rows)])]),
    );
  }

  accuseDialog.showModal();
}

$<HTMLButtonElement>("#accuse-cancel").addEventListener("click", () => accuseDialog.close());
accuseBtn.addEventListener("click", () => openAccuse(false));

accuseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(accuseForm);
  const suspectID = String(data.get("suspect") ?? "");
  if (!suspectID) return;

  const pick = (key: string) => String(data.get(key) ?? "");
  const accusation: Accusation = {
    suspectID,
    proof: { opportunity: pick("opportunity"), motive: pick("motive"), means: pick("means") },
  };
  const verdict = scoreAccusation(theCase, accusation);
  state.accusation = accusation;
  state.verdict = verdict;
  // Remembered separately, since the training save itself is replaced on the next visit
  if (isTutorial) writeFlag("training-done", true);
  // Retries never touch stats (recordDailyResult also ignores a day it has already counted)
  // Archive days go in the history but never touch streaks
  if (info.mode === "daily" && state.attempt === 1) {
    recordHistory(info.day, verdict);
    if (info.isToday) recordDailyResult(info.day, verdict);
  }

  accuseForced = false;
  accuseDialog.close();
  persist();
  renderStation();
  renderView();
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

// Starts the same case over. Stats are untouched, and a shared retry result is labeled as one.
function retryCase(): void {
  const fresh = createGameState(theCase);
  fresh.attempt = state.attempt + 1;
  Object.assign(state, fresh);
  saveGame(info.seed, state);
  // A finished game skipped loading the model, so reload to fetch it (it's cached by now)
  if (!isTutorial && engine === null && engineStatus === "skipped") {
    window.location.reload();
    return;
  }
  newClueIDs.clear();
  view = "station";
  endDialog.close();
  renderView();
  renderStation();
  setStatus(isTutorial ? "Training restarted." : "Case restarted. This try won't count toward your stats.");
}

const retryBtn = $<HTMLButtonElement>("#retry-btn");
retryBtn.textContent = isTutorial ? "Replay training" : "Retry case";
retryBtn.addEventListener("click", retryCase);

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

wireHelp();
wireSettings();

// The export holds the answer key, so it's a dev-only tool
exportBtn.hidden = !import.meta.env.DEV;
exportBtn.addEventListener("click", () => {
  const report = buildReport(theCase, truth, state, replyStats);
  downloadText(`dead-orbit-case-${info.seed}.md`, report);
});

// ---------- Countdown to the next daily case ----------
function tickCountdowns(): void {
  const stale = info.mode === "daily" && info.isToday && dayNumber() > info.day;
  const text = stale ? "now. Reload!" : formatCountdown(msUntilNextDay());
  document.querySelectorAll(`.${COUNTDOWN_CLASS}`).forEach((node) => (node.textContent = text));
}
setInterval(tickCountdowns, 1000);

// ---------- Startup ----------
async function init(): Promise<void> {
  caseNumberEl.textContent = caseLabel(info);
  $<HTMLElement>("#app").hidden = false;
  document.title = `Dead Orbit: ${caseLabel(info)}`;
  renderStation();
  renderView();

  // The coach replaces the help dialog in the tutorial
  if (!isTutorial && !readFlag("seen-help")) {
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

  // Player-facing loading text stays in-world. WebLLM's own progress messages talk about fetching
  // and caching hundreds of megabytes, which reads as a reason to leave.
  const waking = isTutorial ? "The crew is getting ready for your first real case." : "Waking up the crew. You can search the station meanwhile.";
  setStatus(waking);
  try {
    engine = await loadEngine((_text, progress) => {
      if (!isTutorial) setStatus(`${waking} ${Math.round(progress * 100)}%`);
      progressEl.value = progress;
    });
  } catch (err) {
    console.error(err);
    engineStatus = "failed";
    progressEl.hidden = true;
    setStatus(`The crew couldn't be woken up (${errorMessage(err)}). You can still search and accuse.`);
    updateControls();
    return;
  }

  engineStatus = "ready";
  if (import.meta.env.DEV) {
    const { installHarness } = await import("./dev-harness");
    installHarness(() => engine, theCase, truth);
  }
  progressEl.hidden = true;
  setStatus(isTutorial ? "The crew AI is ready for your first real case." : "Systems online. Choose a crew member to question.");
  renderStation();
}

init();
