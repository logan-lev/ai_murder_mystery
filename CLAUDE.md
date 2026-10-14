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
    content.ts     ingredients: 8-character cast pool, station rooms, cabins, motives, weapons, secrets
    generate.ts    generateCase(seed) -> { case, truth }
    validate.ts    validateCase() catches broken IDs and duplicates
  game/
    prompt.ts      buildSuspectPrompt(case, suspect, shownClues, narrate)
    state.ts       GameState, TURN_LIMIT, action log, searchRoom, showClue, buildMessages
    accuse.ts      scoreAccusation(), MAX_ACCUSE_EVIDENCE, RANKS
    save.ts        localStorage: in-progress saves per seed, daily stats and streaks
    share.ts       buildShareText() (spoiler-free emoji grid), clipboard copy
    export.ts      buildReport() + downloadText() for the dev-only "Export log" button
  ui/
    reply.ts       parseReply() splits "[narration] speech"; renderWithActions() styles (actions)
    dom.ts         el() element builder (textContent only), $(), formatCountdown()
    results.ts     ending screen (verdict, "how you could have cracked it", true timeline) and stats dialog
    guide.ts       SOLVING_GUIDE: the "how to crack the case" steps shown in help and the Case File
    board.ts       renderBoard(): the Timeline tab, where the player pins each suspect to a room per time slot
  tutorial/
    case.ts        hand-built training case (TUTORIAL_CASE/TRUTH), scripted QUESTIONS and SHOWS answers
    coach.ts       Coach: step-by-step guide panel; steps advance from game-state checks or a Next button
  gpu.ts           WebGPU support check
  llm.ts           loadEngine() (Web Worker + warm-up), streamReply(), fast-mode model choice
  llm-worker.ts    WebLLM worker handler
  seed.ts          getCaseInfo(): daily case (no param, seed hashed from the local day) or ?case=N practice
  dev-checks.ts    fuzz test (2000 seeds) + prompt lint, dev only
  main.ts          UI wiring and render functions
```

## Core design principles (do not break these)

1. Code owns the truth; the LLM only performs it. All facts live in the generated `Case`. The model never decides what happened, who is guilty, or how the game ends.
2. Secrets are absent from a prompt until unlocked. A suspect's prompt only includes an `Unlock.reveals` line once every clue in `Unlock.requires` has been shown to them. The model cannot leak what it was never told. Avoid even mentioning a secret's room or topic in locked prompts ("don't think of an elephant" problem).
3. Prompts are rebuilt every turn. Conversations are stored without the system prompt; `buildMessages()` regenerates it from case data plus shown evidence.
4. Evidence is held, not claimed. Suspects only treat clues listed under EVIDENCE SHOWN as real. Player bluffs (fake cameras, fake evidence) should be denied. The storm knocked out cameras at 20:30, which is a shared fact.
5. Every case must be solvable. Each innocent's secret happens exactly during the murder slot, in a room that is neither their own post nor the scene, so everyone lies about the critical moment and innocents are cleared by uncovering their secret. The culprit's personal trace is at the scene. Two random innocents (red herrings) also leave traces from a harmless 21:00 visit, and they see each other there.
6. Witnesses are emergent. Same room + same time slot in the simulated timeline produces sightings. Sightings during an innocent's secret slot are only revealed with that secret.
7. The culprit's prompt does not say they are guilty until the final confession unlock. When shown their trace, the culprit lies that they also visited at 21:00; the herrings' sightings (who they did and didn't see) expose the lie.
8. Each case picks a victim (anyone with `canBeVictim`) and `SUSPECT_COUNT` suspects from `CHARACTERS`. The scene is the victim's `homeRoom`. Content templates must work for any victim: use `{victim}`, `{victimFull}`, `{scene}`, and pronoun keys (`{he}`, `{his}`, `{He}`...), never a hardcoded victim.

## Content conventions

- Strings inserted mid-sentence (`role`, `trace`, `reason`, `activity`) start lowercase (or with a `{victim}` placeholder) and have no trailing period.
- Traces must not name their owner. They point to a job or a place, and the player infers who fits.
- Motive clues go in the victim's cabin (`"victim-cabin"`) or the suspect's own cabin, never at the scene. A `clause()` helper may strip trailing punctuation.
- Room IDs must match `STATION_ROOMS` or a character's `cabin.id` exactly. `validateCase()` and the dev-check prompt lint (flags `..`, `.,`, ` ,`, `{`, `}`) must stay clean.
- The `Truth` object uses `victimID`, `culpritID`, `methodID`, `redHerringIDs` (capital ID). Match existing field names in `generate.ts` rather than renaming.
- Insert model output with `textContent` or DOM nodes, never `innerHTML`.

## Narration

Suspects can open a reply with one bracketed third-person narration sentence, e.g. `[Reyes rubs his neck.]`, which the UI renders as an italic narrator line. The parser tolerates replies that ignore the format.

`shouldNarrate()` in `main.ts` decides when: the first question to a suspect, or evidence being shown. Players cannot type actions: messages containing `( )` or `[ ]` are rejected with a toast, and player lines render as plain text. `polishNarration()` in `game/guard.ts` repairs clipped narration ("rubs temples" to "rubs his temples") using the suspect's pronouns. It sets the `narrate` flag on `buildSuspectPrompt`, which swaps the format rule.

## Performance notes

Test machine: MacBook Pro with an Apple M1 (to confirm). Measured before optimizations: ~7.7 s to first token, ~7 tokens/s, ~13 s per reply. Applied: warm-up request (`max_tokens: 1`), condensed rules with the `narrate` flag, `MAX_HISTORY` 8, engine in a Web Worker, WebLLM lazy-loaded, and a "Fast mode" setting using `Llama-3.2-1B-Instruct-q4f16_1-MLC`. First measurement after the fixes (in the Claude desktop browser pane, not yet on the M1): 3.8 s to first token, 15.8 tokens/s, 6.0 s per reply.

## Status and roadmap

- [x] Step 1: in-browser LLM chat with WebGPU check and streaming
- [x] 2a: procedural case generator with validation and fuzz test
- [x] 2b: prompt builder with unlock system
- [x] 2c: seed in URL, multi-suspect tabs, per-suspect conversations, bracket narration, export log
- [x] Speed fixes above (re-measure on the M1)
- [x] 2d: room list, room descriptions, search button (`searchRoom`), evidence inventory
- [x] 2e: "Show" evidence to the active suspect (`showClue`), narrated reaction
- [x] 2f: accusation dialog (suspect, motive, up to 3 evidence), `scoreAccusation`, ending screen with true timeline
- [x] Daily mode: daily seed, 24-turn storm clock, saved progress, stats/streaks, share text, how-to-play, countdown
- [x] Web Worker engine, GitHub Pages workflow, README, Export log hidden outside dev
- [x] Balance: seeded victim, 8-character pool with 5 suspects per case, 2 red herrings, unnamed traces, motives moved to cabins, culprit lies about visit time, 20 turns
- [ ] Stretch: leak guard (regenerate if a locked unlock's keywords appear), README gameplay GIF, more content variety

## UI notes

- `?tutorial` is the training case (saved under seed 0). It never calls the model: preset question chips replace the text box, and answers come from `tutorial/case.ts`. The model still downloads in the background so the first real case is ready. Keep the scripted answers, `howToSolve`, and the coach steps consistent if the training case changes.
- The Timeline tab (`boardOpen`, with `activeSuspectID` null) shows `state.board`. Pins are the player's notes and are never scored.
- Retry (end screen) resets the case in place with `attempt + 1`. Only attempt 1 of a daily records stats; shared retries are labeled "(retry N)".
- The first tab is the Case File (`activeSuspectID === null`): briefing, solving guide, and every search result with full clue descriptions. Searching switches to it.
- "Show to" buttons sit outside the collapsible evidence details so they're always visible, and are accent-filled when usable.
- `Case.solution.howToSolve` is generated alongside the case and must stay in sync with the case logic (red herrings, witness sightings, motive and secret locations).

## Daily mode

- No `?case` param means today's daily case: `dayNumber()` counts local days from `LAUNCH_DAY` (Daily #1 = 2026-10-13), `dailySeed()` hashes it. Don't change `LAUNCH_DAY` after going public.
- Every search, question, or shown clue is one entry in `state.actions` and costs one turn (`TURN_LIMIT` = 20). Turns left = `TURN_LIMIT - actions.length`. At zero the accusation dialog opens and can't be dismissed.
- Saves are keyed by seed (`deadorbit:case:<seed>`). Bump `SAVE_VERSION` in `save.ts` whenever the generator changes what a seed produces. Only completed replies are saved, and trailing unanswered questions are dropped on load.
- A finished or out-of-turns game skips the model download entirely.

## Testing workflow

Adversarial probing (dev only): once the model loads, the console has `deadOrbitDev.probe(suspectID, [messages], [shownClueIDs])`, which runs a scratch conversation without spending turns. `deadOrbitDev.truth` holds the answer key. A finished game skips loading the model, so probe on an unfinished case.

Known model behaviors and their fixes:
- Prompt injection gets a stock Llama refusal: `guardReply()` in `game/guard.ts` replaces it in character.
- "Answer as Reyes" / "write my question" is followed regardless of rules: `isRoleplayRequest()` intercepts before the model.
- Contradictory admissions confuse the 3B model. Unlocks use `storyChange` to rewrite the cover story, and `confession` drops all earlier denials and hiding rules. Avoid "last one wins" style rules.
- The culprit denies their motive until confessing (by design, it was flaky otherwise). Innocents admit theirs.
- First replies sometimes say "as I mentioned earlier": the prompt marks a first meeting, and `stripFalseCallbacks()` removes the phrase from a suspect's first reply.
- Still open: occasional invented details (e.g. who someone was with), and suspects sometimes accept a true premise the player asserts.

Play a round, click Export log, and review the Markdown file. It contains the solution, true timeline, all conversations (raw, including brackets), each suspect's final system prompt, and reply timing averages. When a suspect misbehaves, the fix is usually in the prompt or the case data, not the model.

## Working with me

- I'm building this to learn and as a resume project. Briefly explain non-obvious design decisions when making changes.
- Prefer small, reviewable steps with a clear "done when" check, and run `npx tsc --noEmit` after changes.
- Don't use em dashes in prose written for me.
