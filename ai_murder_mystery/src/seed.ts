const MAX_SEED = 99999;

// Reads ?case=N from the URL. If missing, picks a random seed and writes it into the URL.
export function getSeed(): number {
    const params = new URLSearchParams(window.location.search);
    const fromURL = Number(params.get("case"));
    if (Number.isInteger(fromURL) && fromURL > 0) return fromURL;

    const seed = Math.floor(Math.random() * MAX_SEED) + 1;
    params.set("case", String(seed));
    history.replaceState(null, "", `${window.location.pathname}?${params}`);
    return seed;
}