# Dead Orbit

A daily murder mystery on a space station, where the suspects are played by an AI running entirely in your browser.

Every day there's a new case, and everyone gets the same one. Search the station, question the four crew members, show them evidence to break their stories, and name the killer before the ion storm clears. Then share your result, Wordle-style:

```
Dead Orbit Daily #1 🛰️
🏅 Master Investigator
Killer ✅ Means ✅ Motive ✅ Opportunity ✅
🔦💬🧾💬🔦⬛💬🧾
8/24 turns
```

## How it works

- **Procedural cases.** Each case is generated from a seed: culprit, weapon, motives, every crew member's secret, and a simulated timeline that produces witness sightings. A validator and a 2000-seed fuzz test keep every case solvable.
- **The code owns the truth, the model only performs it.** Suspects are played by `Llama-3.2-3B-Instruct` through [WebLLM](https://github.com/mlc-ai/web-llm) on WebGPU. A suspect's secrets aren't in their prompt until the player has shown them the evidence that unlocks it, so the model can't leak what it was never told.
- **No server.** Static hosting, no API keys, no cost. The model downloads once and is cached by the browser.

## Running locally

Needs a browser with WebGPU (recent Chrome or Edge).

```bash
cd ai_murder_mystery
npm install
npm run dev
```

In dev mode, the answer key and a fuzz test log to the console, and an "Export Log" button downloads a full transcript with each suspect's system prompt.

The home page links to today's case, the training case (`?tutorial`), and the archive (`?day=N`). `?case=N` opens practice case N.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it to GitHub Pages. In the repository settings, set Pages to deploy from GitHub Actions.
