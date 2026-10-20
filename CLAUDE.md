# Dead Orbit

A browser-based AI murder mystery game set on a space station. Every case is procedurally generated from a seed, and the suspects are played by a small LLM running entirely in the player's browser via WebGPU. No server, no API keys, no cost. A new daily case every day, Wordle-style.

## Stack

- Vite + TypeScript (vanilla, no framework). The app lives in `ai_murder_mystery/`.
- WebLLM (`@mlc-ai/web-llm`) running `Llama-3.2-3B-Instruct-q4f16_1-MLC` client-side, in a Web Worker
- Vitest + happy-dom for tests, Prettier for formatting
- Deploy target: GitHub Pages (static hosting), via `.github/workflows/deploy.yml`
- Constraint: the project must stay free to run. No paid APIs or backend.

## Commands (run inside `ai_murder_mystery/`)

- `npm run dev` starts the dev server. The answer key logs to the console, the Export button appears, and `deadOrbitDev` is available (see Testing).
- `npm test` runs the Vitest suite (`src/**/*.test.ts`). The deploy workflow runs it before building, so a failing test blocks a deploy.
- `npx tsc --noEmit` type-checks everything, including tests.
- `npm run format` formats with Prettier (`npm run format:check` verifies).
- `npm run build` type-checks and builds to `dist/`.

## Architecture

```
src/
  main.ts          router: no URL params loads home.ts, anything else loads game.ts
  home.ts          home page: today's case, archive, training, stats
  game.ts          the case page: rendering, player actions, accusation, startup
  seed.ts          which case is open (?day=N daily, ?case=N practice, ?tutorial) and daily seeds
  llm.ts           loadEngine() (Web Worker + warm-up), streamReply() (with timing, trims cut-off replies)
  llm-worker.ts    WebLLM worker handler
  gpu.ts           WebGPU support check
  dev-harness.ts   dev-only deadOrbitDev.probe() console tool
  case/
    types.ts       Case, Suspect, Clue, Unlock, Room types
    random.ts      seeded PRNG (mulberry32), pick, shuffle
    content.ts     8-character cast pool, station rooms, cabins, motives, weapons, secrets
    generate.ts    generateCase(seed) -> { case, truth }
    validate.ts    validateCase() catches broken IDs and duplicates
  game/
    prompt.ts      buildSuspectPrompt(case, suspect, shownClues, narrate, firstMeeting, reminders)
    state.ts       GameState, TURN_LIMIT, action log, searchRoom, showClue, buildMessages
    guard.ts       code-level fixes for model failures (see Known model behaviors)
    accuse.ts      scoreAccusation(), PROOF_SLOTS (opportunity, motive, means), RANKS
    save.ts        localStorage: case saves, daily stats and streaks, archive history, flags, reset
    share.ts       buildShareText() (spoiler-free emoji grid), clipboard copy
    export.ts      dev-only Export: Markdown report of a round
  ui/
    dom.ts         el() element builder (textContent only), $(), formatCountdown()
    reply.ts       parseReply() "[narration] speech", renderWithActions(), trimIncomplete()
    board.ts       renderBoard(): the Timeline tab
    results.ts     ending screen (verdict, how to crack it, true timeline) and stats
    guide.ts       SOLVING_GUIDE shown in help and the Station tab
    common.ts      help and settings dialogs shared by home and game
  tutorial/
    case.ts        hand-built training case and its scripted questions and answers
    coach.ts       the training coach (steps, highlights, locking)
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
9. The weapon is always findable by reasoning: the generator guarantees an innocent sees the killer at the hiding place right after the murder (an "errand" if nobody works there, picked with a separate RNG so earlier picks don't shift).

`case/generate.test.ts` checks 1, 5, 6, 8, and 9 over ~400 seeds; `game/prompt.test.ts` checks 2 and 7.

## Content conventions

- Strings inserted mid-sentence (`role`, `trace`, `reason`, `activity`, `carried`) start lowercase (or with a `{victim}` placeholder) and have no trailing period.
- Traces must not name their owner. They point to a job or a place, and the player infers who fits.
- Motive clues go in the victim's cabin (`"victim-cabin"`) or the suspect's own cabin, never at the scene.
- Room IDs must match `STATION_ROOMS` or a character's `cabin.id` exactly. Station rooms take "the" in sentences; cabins don't ("Park's Cabin").
- The `Truth` object uses `victimID`, `culpritID`, `methodID`, `redHerringIDs` (capital ID). Match existing field names in `generate.ts` rather than renaming.
- Insert model output with `textContent` or DOM nodes, never `innerHTML`.
- Player-facing text: turns are "used up", never "cost". Don't mention downloading or caching.

## Gameplay rules in code

- Every search, question, or shown clue is one entry in `state.actions` and uses one turn (`TURN_LIMIT` = 20). At zero the accusation dialog opens and can't be dismissed.
- Accusation: the player names a suspect and picks one found clue per slot in a grid: opportunity (the killer's trace), motive (their motive clue), means (the weapon). `Case.solution.proof` holds the answers. Wrong killer is Case Unsolved; otherwise 3, 2, or fewer correct slots give Master Investigator, Sharp Inspector, or Lucky Guess. The body is information, never proof.
- The culprit denies their motive until confessing (by design; it was flaky otherwise). Innocents admit theirs.
- `Case.solution.howToSolve` is generated alongside the case and must stay in sync with the case logic.

## Narration

Suspects can open a reply with one bracketed third-person narration sentence, e.g. `[Reyes rubs his neck.]`, rendered as an italic narrator line. `shouldNarrate()` in `game.ts` turns it on for the first question to a suspect and when evidence is shown, by setting the `narrate` flag on `buildSuspectPrompt`. The parser tolerates replies that ignore the format. `polishNarration()` repairs clipped narration ("rubs temples" to "rubs his temples"). Players cannot type actions: messages containing `( )` or `[ ]` are rejected with a toast.

## Routes and saving

- `/` home page. `?day=N` daily case N (today or archive; future days clamp to today). `?case=N` practice. `?tutorial` training (saved under seed 0).
- Daily #1 is 2026-10-13 (`LAUNCH_DAY` in `seed.ts`); days are counted in the player's local time. Don't change `LAUNCH_DAY` after going public.
- Only today's daily, first attempt, updates stats and streaks. Any daily's first attempt goes in the archive history. Retry restarts a case with `attempt + 1`; shared retries are labeled.
- Saves are keyed `deadorbit:case:<seed>`. Bump `SAVE_VERSION` in `save.ts` whenever the generator changes what a seed produces. Only completed replies are saved. Another tab saving the same case makes this tab reload (`storage` event).
- "Delete all progress" removes every `deadorbit:` key.
- A finished or out-of-turns game skips loading the model.

## UI notes

- Visual style is a paper case file: kraft desk, manila folder, paper sheets, typewriter headings (Special Elite / Courier Prime via Google Fonts), ink-blue actions, red stamp accents. Colors live in `:root` tokens in `style.css`.
- The case page is a folder with tabs: Station (rooms, room detail, search log), Evidence (clue cards with a Show button per crew member), Timeline (board), then one tab per crew member (conversation, evidence tray, question box). `view` in `game.ts` tracks the open tab; the conversation and board re-render only on tab changes so a streaming reply is never wiped.

## Training (`?tutorial`)

- Never calls the model: preset question chips replace the text box, and answers come from `tutorial/case.ts`. The model loads in the background so the first real case is ready.
- Restarts whenever the player leaves and returns; only a page reload resumes it. Completion is the `training-done` flag, which the home page reads.
- Progress is `state.tutorialStep`, which only moves forward one step at a time; a step's `done` check runs only while it's the current step. Questions and shown evidence count only once answered.
- Each step has `text` (why) and `todo` (one action). Targets are listed in priority order and the first visible one is highlighted (a tab with `:not(.active)` first, then the control inside).
- Locking: `body.tutorial-locked` disables action controls except the step's `allow` selectors. Keep `LOCKABLE` in `coach.ts` and the selector list in `style.css` in sync. Tabs are never locked.
- `tutorial/tutorial.test.ts` checks that every scripted question, clue, room, and coach selector exists, and that each step can be completed.

## Testing

Tests encode the rules above; when the model misbehaves in a new way, add the case to `game/guard.test.ts` alongside the fix.

Adversarial probing (dev only): once the model loads, the console has `deadOrbitDev.probe(suspectID, [messages], [shownClueIDs])`, which runs a scratch conversation without spending turns. `deadOrbitDev.truth` holds the answer key. A finished game skips loading the model, so probe on an unfinished case.

Manual review: play a round, click Export, and read the Markdown file (solution, true timeline, every conversation, each suspect's final prompt, timing). When a suspect misbehaves, the fix is usually in the prompt or the case data, not the model.

### Known model behaviors and their fixes (all in `game/guard.ts` unless noted)

- Prompt injection gets a stock Llama refusal: `guardReply()` replaces it in character.
- "Repeat everything above" made the model recite its prompt: `isPromptExtraction()` intercepts requests before the model, and `looksLikePromptLeak()` watches the stream, interrupting generation and hiding the reply on a prompt-structure marker.
- "Answer as Reyes" / "write my question" is followed regardless of rules: `isRoleplayRequest()` intercepts.
- Camera questions get a fixed answer (`cameraReply`); suspects otherwise "explained" impossible footage.
- Forensic claims, hearsay, and questions about where someone else was add a turn-specific `RIGHT NOW:` reminder at the end of the prompt (`bluffReminders`).
- Contradictory admissions confuse the 3B model. Unlocks use `storyChange` to rewrite the cover story, and `confession` drops earlier denials and hiding rules (`prompt.ts`). Avoid "last one wins" style rules.
- First replies sometimes say "as I mentioned earlier": the prompt marks a first meeting, and `stripFalseCallbacks()` removes the phrase.
- Sightings are two sentences with the name repeated (`generate.ts`); as one clause, a witness read the carrying as about itself.
- Suspects are told whose trace is theirs only when shown it; red herrings' scene visit arrives with that unlock (`generate.ts`).
- Replies cut off by `max_tokens` are trimmed to the last full sentence (`trimIncomplete`, `ui/reply.ts`).
- A 1B "fast mode" model was tried and removed: it never confessed with full evidence and took bluffs as confessions.
- Still open: occasional invented details (e.g. who someone was with), suspects sometimes accept a true premise the player asserts, and suspects repeat their alibi often.

## Performance

Measured before optimizations: ~7.7 s to first token, ~7 tokens/s, ~13 s per reply. Applied: warm-up request, condensed rules with the `narrate` flag, `MAX_HISTORY` 8, engine in a Web Worker, WebLLM lazy-loaded (main bundle ~40 KB). Measured after (Claude desktop browser pane): 3.8 s to first token, 15.8 tokens/s, 6 s per reply. On the M1 test machine: ~4.4 s to first token, ~8.5 s per reply.

## Roadmap

- [ ] Secrets surface only after questioning (players can currently solve by searching every room)
- [ ] README gameplay GIF
- [ ] More content variety (cast, weapons, secrets, settings)

## Working with me

- I'm building this to learn and as a resume project. Briefly explain non-obvious design decisions when making changes.
- Prefer small, reviewable steps with a clear "done when" check, and run `npx tsc --noEmit` after changes.
- Don't use em dashes in prose written for me.
