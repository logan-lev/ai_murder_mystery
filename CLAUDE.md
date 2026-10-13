# Dead Orbit

A browser-based AI murder mystery game set on a space station. Every case is procedurally generated from a seed, and the suspects are played by a small LLM running entirely in the player's browser via WebGPU. No server, no API keys, no cost.

## Stack

- Vite + TypeScript (vanilla, no framework). The app lives in `ai_murder_mystery/`.
- WebLLM (`@mlc-ai/web-llm`) running `Llama-3.2-3B-Instruct-q4f16_1-MLC` client-side
- Deploy target: GitHub Pages (static hosting)
- Constraint: the project must stay free to run. No paid APIs or backend.

## Commands (run inside `ai_murder_mystery/`)

- `npm run dev` starts the dev server. Dev checks and the answer key log to the browser console.
- `npx tsc --noEmit` type-checks the project.

## Architecture

```
src/
  case/
    types.ts       Case, Suspect, Clue, Unlock, Room, Motive types
    random.ts      seeded PRNG (mulberry32), pick, shuffle
    content.ts     ingredients: setting, rooms, crew, motives, weapons, secrets
    generate.ts    generateCase(seed) -> { case, truth }
    validate.ts    validateCase() catches broken IDs and duplicates
  game/
    prompt.ts      buildSuspectPrompt(case, suspect, shownClues)
    state.ts       GameState, createGameState, searchRoom, showClue, buildMessages
    accuse.ts      scoreAccusation()
    export.ts      buildReport() + downloadText() for the "Export log" button
  ui/
    reply.ts       parseReply() splits "[narration] speech"; renderWithActions() styles (actions)
  gpu.ts           WebGPU support check
  llm.ts           loadEngine(), streamReply() (returns text + timing stats)
  seed.ts          getSeed() reads ?case=N from the URL or picks one and writes it
  dev-checks.ts    fuzz test (2000 seeds) + prompt lint, dev only
  main.ts          UI wiring and render functions
```

## Core design principles (do not break these)

1. Code owns the truth; the LLM only performs it. All facts live in the generated `Case`. The model never decides what happened, who is guilty, or how the game ends.
2. Secrets are absent from a prompt until unlocked. A suspect's prompt only includes an `Unlock.reveals` line once every clue in `Unlock.requires` has been shown to them. The model cannot leak what it was never told. Avoid even mentioning a secret's room or topic in locked prompts ("don't think of an elephant" problem).
3. Prompts are rebuilt every turn. Conversations are stored without the system prompt; `buildMessages()` regenerates it from case data plus shown evidence.
4. Evidence is held, not claimed. Suspects only treat clues listed under EVIDENCE SHOWN as real. Player bluffs (fake cameras, fake evidence) should be denied. The storm knocked out cameras at 20:30, which is a shared fact.
5. Every case must be solvable. Each innocent's secret happens exactly during the murder slot, so everyone lies about the critical moment and innocents are cleared by uncovering their secret. The culprit's personal trace is at the scene. One random innocent (the red herring) also leaves a trace from a harmless earlier visit.
6. Witnesses are emergent. Same room + same time slot in the simulated timeline produces sightings. Sightings during an innocent's secret slot are only revealed with that secret.
7. The culprit's prompt does not say they are guilty until the final confession unlock.

## Content conventions

- Strings inserted mid-sentence (`role`, `trace`, `reason`, `activity`) start lowercase and have no trailing period. A `clause()` helper may strip trailing punctuation.
- Room IDs must match `ROOMS` exactly. `validateCase()` and the dev-check prompt lint (flags `..`, `.,`, ` ,`, `{`, `}`) must stay clean.
- The `Truth` object uses `culpritID`, `methodID`, `redHerringID` (capital ID). Match existing field names in `generate.ts` rather than renaming.
- Insert model output with `textContent` or DOM nodes, never `innerHTML`.

## Narration

Suspects can open a reply with one bracketed third-person narration sentence, e.g. `[Reyes rubs his neck.]`, which the UI renders as an italic narrator line. The parser tolerates replies that ignore the format.

Current state: the prompt asks for narration on every reply. Planned: a `narrate` flag on `buildSuspectPrompt` driven by `shouldNarrate()` in `main.ts` (first question to a suspect, player message contains an (action), or evidence is shown).

## Performance notes

Test machine: MacBook Pro with an Apple M1 (to confirm). Measured before optimizations: ~7.7 s to first token, ~7 tokens/s, ~13 s per reply. Planned fixes (none applied yet at the checkpoint commit):

- Warm-up request with `max_tokens: 1` after the engine loads
- Condensed rules in `prompt.ts` with the `narrate` flag
- `MAX_HISTORY` lowered from 12 to 8 in `state.ts`
- Fallback option: a "Fast mode" toggle using `Llama-3.2-1B-Instruct-q4f16_1-MLC`

## Status and roadmap

- [x] Step 1: in-browser LLM chat with WebGPU check and streaming
- [x] 2a: procedural case generator with validation and fuzz test
- [x] 2b: prompt builder with unlock system
- [x] 2c: seed in URL, multi-suspect tabs, per-suspect conversations, bracket narration, export log
- [ ] Speed fixes above, then re-measure
- [ ] 2d: room list, room descriptions, search button (`searchRoom`), evidence inventory
- [ ] 2e: "Show" evidence to the active suspect (`showClue`), push a user message like `(The investigator shows you the X: description)`, narrate the reaction
- [ ] 2f: accusation form (suspect, motive, evidence checkboxes), `scoreAccusation`, ending screen with rank and explanation, "New case" button
- [ ] Stretch: leak guard (regenerate if a locked unlock's keywords appear), daily case seed, Web Worker for the engine, deploy to GitHub Pages, README with gameplay GIF
- [ ] Before public deploy: hide the Export log button (`exportBtn.hidden = !import.meta.env.DEV`)

## Testing workflow

Play a round, click Export log, and review the Markdown file. It contains the solution, true timeline, all conversations (raw, including brackets), each suspect's final system prompt, and reply timing averages. When a suspect misbehaves, the fix is usually in the prompt or the case data, not the model.

## Working with me

- I'm building this to learn and as a resume project. Briefly explain non-obvious design decisions when making changes.
- Prefer small, reviewable steps with a clear "done when" check, and run `npx tsc --noEmit` after changes.
- Don't use em dashes in prose written for me.
