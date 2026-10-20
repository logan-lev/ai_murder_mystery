// Tiny DOM helpers used everywhere.

// Builds an element with text set via textContent, so model or case text is never parsed as HTML
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    text = "",
    children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    node.append(...children);
    return node;
}

export function $<T extends HTMLElement>(selector: string): T {
    const node = document.querySelector<T>(selector);
    if (!node) throw new Error(`Missing element: ${selector}`);
    return node;
}

export function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
