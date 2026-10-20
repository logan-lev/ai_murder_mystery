import { deleteAllProgress } from "../game/save";
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
    $<HTMLButtonElement>(buttonSelector).addEventListener("click", () => settingsDialog.showModal());
    closeOnBackdrop(settingsDialog);

    // Two steps, since this can't be undone: the button reveals a confirmation instead of acting
    const resetBtn = $<HTMLButtonElement>("#reset-btn");
    const confirmRow = $<HTMLElement>("#reset-confirm");
    const hideConfirm = () => {
        confirmRow.hidden = true;
        resetBtn.hidden = false;
    };
    resetBtn.addEventListener("click", () => {
        resetBtn.hidden = true;
        confirmRow.hidden = false;
    });
    $<HTMLButtonElement>("#reset-cancel").addEventListener("click", hideConfirm);
    settingsDialog.addEventListener("close", hideConfirm);
    $<HTMLButtonElement>("#reset-yes").addEventListener("click", () => {
        deleteAllProgress();
        // Back to the home page, which now shows a fresh start. Replace, so Back can't reopen a deleted case.
        window.location.replace(window.location.pathname);
    });
}

export function closeOnBackdrop(dialog: HTMLDialogElement, canClose: () => boolean = () => true): void {
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog && canClose()) dialog.close();
    });
}
