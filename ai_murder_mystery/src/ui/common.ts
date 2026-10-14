import { getModelChoice, setModelChoice } from "../llm";
import { practiceURL } from "../seed";
import { SOLVING_GUIDE } from "./guide";
import { el, $ } from "./dom";

// Dialogs shared by the home page and the game

// The home page and the game header each have their own buttons, so the caller says which
export function wireHelp(buttonSelector = "#help-btn"): HTMLDialogElement {
  const helpDialog = $<HTMLDialogElement>("#help-dialog");
  $<HTMLElement>("#help-guide").replaceChildren(...SOLVING_GUIDE.map((tip) => el("li", "", tip)));
  $<HTMLButtonElement>(buttonSelector).addEventListener("click", () => helpDialog.showModal());
  closeOnBackdrop(helpDialog);
  return helpDialog;
}

export function wireSettings(buttonSelector = "#settings-btn"): void {
  const settingsDialog = $<HTMLDialogElement>("#settings-dialog");
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
  $<HTMLButtonElement>(buttonSelector).addEventListener("click", () => settingsDialog.showModal());
  closeOnBackdrop(settingsDialog);
}

export function closeOnBackdrop(dialog: HTMLDialogElement, canClose: () => boolean = () => true): void {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && canClose()) dialog.close();
  });
}
