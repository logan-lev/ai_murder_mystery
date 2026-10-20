# Dead Orbit

**A daily murder mystery aboard a space station, where every suspect is played by an AI running entirely in your browser.**

Commander, doctor, engineer, android: one of the crew is a killer, and the rest are hiding secrets of their own. Search the station, question the crew in your own words, confront them with evidence, and name the killer before the ion storm clears. There's a new case every day, everyone gets the same one, and you can share your result Wordle-style:

```
Dead Orbit Daily #7 🛰️
🏅 Master Investigator
Killer ✅ Means ✅ Motive ✅ Opportunity ✅
🔦💬🧾💬🔦⬛💬🧾
🔦💬🧾
11/20 turns
```

**Play:** https://logan-lev.github.io/ai_murder_mystery/ (needs a browser with WebGPU, such as recent Chrome or Edge on a desktop or laptop)

## How a case plays

1. **Search** the station's rooms. The crime scene holds the body (which gives the time of death) and items left behind by whoever was there tonight.
2. **Question** the crew by typing what you'd say. Everyone lies about where they were at the time of death, but only one of them is lying about murder. The others have secrets.
3. **Show evidence** to a suspect to break their story. Shown their own item from the scene, two innocent visitors admit an earlier visit and vouch for each other; the killer claims the same visit, but nobody saw them there.
4. **Pin** what you learn on the Timeline board.
5. **Accuse**: name the killer and back it up with one piece of evidence each for opportunity, motive, and means.

Every search, question, or piece of evidence you show uses up one of 20 turns. A guided training case teaches the whole loop in about five minutes, without any AI.

## How it works

### The code owns the truth; the AI only performs it

Small language models make things up. The design works around that: everything that happened is decided by code, and the model only ever voices it.

- **Procedural cases.** A seeded generator picks a victim and five suspects from an eight-person cast, then a culprit, weapon, motives, and a secret for each innocent. It simulates where everyone was in four time slots, and any two people in the same room at the same time become witnesses to each other. The same seed always produces the same case, which is what makes a shared daily puzzle possible.
- **Locked prompts.** Each suspect's system prompt is rebuilt every turn from the case data and the evidence shown to them so far. A secret isn't in the prompt at all until the player shows the evidence that unlocks it, so the model can't leak what it was never told. The killer isn't told they're guilty until the final confession unlocks.
- **Guaranteed solvable.** Every innocent's secret puts them somewhere else at the time of death, the killer's trace is always at the scene, and a witness always sees where the weapon was hidden. Tests check these rules over hundreds of seeds.

### Fixing what prompts can't

Playtesting against the model surfaced failures that no prompt wording fixed reliably, so code handles them:

- Requests to "repeat everything above" are intercepted, and if a reply starts reproducing the prompt anyway, generation is stopped and the text is never shown.
- Role-play requests ("answer as Reyes") and camera bluffs get fixed in-character answers instead of reaching the model.
- Bluffs about forensics or what someone else said add a targeted reminder to the end of the prompt for that turn only.
- Stock AI refusals, clipped narration, "as I mentioned earlier" on a first reply, and replies cut off mid-word are repaired before they're shown.

Each of these is a test case in `src/game/guard.test.ts`.

### Running a language model in a web page

- The suspects are `Llama-3.2-3B-Instruct` (4-bit) running through [WebLLM](https://github.com/mlc-ai/web-llm) on WebGPU, inside a Web Worker so the page stays responsive.
- The 6 MB WebLLM library is loaded lazily, so the page and room searching work immediately while the model loads in the background.
- A warm-up request moves one-time GPU setup off the first question, prompts are kept short because they're re-read every turn, and only the last eight messages are sent. Together these took replies from about 13 seconds to about 6.
- A smaller 1B model was tested as a "fast mode" and dropped: it never confessed even with all the evidence shown.

### No server

Static hosting on GitHub Pages, no backend, no API keys, nothing to pay for. Progress, stats, and streaks live in the browser's local storage.

## Tech stack

TypeScript and Vite with no UI framework, WebLLM, Vitest with happy-dom (about 625 tests), Prettier, and GitHub Actions for deployment.

```
ai_murder_mystery/src/
  main.ts, home.ts, game.ts   entry point, home page, case page
  case/                       content and the seeded case generator
  game/                       prompts, game state, guards, scoring, saving, sharing
  ui/                         rendering helpers, Timeline board, results screen
  tutorial/                   the hand-written training case and its coach
```

`CLAUDE.md` describes the design rules and architecture in more detail.

## Running locally

Requires Node 22 or later.

```bash
cd ai_murder_mystery
npm install
npm run dev
```

Open the printed local address in Chrome or Edge. The first visit loads the AI model (about 2 GB), which the browser then keeps for later visits.

In development the console shows the answer key, an Export button saves a full transcript of a round (including each suspect's prompt), and `deadOrbitDev.probe()` lets you question a suspect in a throwaway conversation.

```bash
npm test          # run the test suite
npx tsc --noEmit  # type-check
npm run format    # format with Prettier
npm run build     # production build in dist/
```

URL options: `?day=N` opens daily case N, `?case=N` opens practice case N, and `?tutorial` opens training.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which installs dependencies, runs the tests, builds, and publishes to GitHub Pages. A failing test stops the deploy. In the repository settings, set **Pages > Source** to **GitHub Actions**.

## Known limitations

- Needs WebGPU. Without it you can still search and accuse, but not question anyone.
- A 3B model occasionally invents small details or repeats its alibi. The guards catch the failures that break the game, but not every quirk.
- A thorough player can solve some cases by searching every room without questioning anyone.

## Credits

Built with Llama: the suspects are played by Meta's Llama 3.2, used under the [Llama 3.2 Community License](https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/LICENSE). In-browser inference by [WebLLM](https://github.com/mlc-ai/web-llm) from the MLC team. Fonts: Special Elite, Courier Prime, and Source Sans 3 from Google Fonts.

## License

The code is released under the [MIT License](LICENSE). The Llama 3.2 model is covered by its own license, linked above.
