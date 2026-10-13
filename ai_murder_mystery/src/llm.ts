import type { MLCEngineInterface, ChatCompletionMessageParam } from "@mlc-ai/web-llm";

export type Engine = MLCEngineInterface;

export const MODELS = {
  standard: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  fast: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
} as const;

export type ModelChoice = keyof typeof MODELS;

const MODEL_KEY = "deadorbit:model";

export function getModelChoice(): ModelChoice {
  try {
    return localStorage.getItem(MODEL_KEY) === "fast" ? "fast" : "standard";
  } catch {
    return "standard";
  }
}

export function setModelChoice(choice: ModelChoice): void {
  try {
    localStorage.setItem(MODEL_KEY, choice);
  } catch {
    // Storage blocked: the choice just won't persist
  }
}

export function currentModelID(): string {
  return MODELS[getModelChoice()];
}

export async function loadEngine(
  onProgress: (text: string, progress: number) => void,
): Promise<Engine> {
  // WebLLM is about 6 MB of JavaScript. Loading it lazily lets the page (and searching rooms) start immediately.
  const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
  const worker = new Worker(new URL("./llm-worker.ts", import.meta.url), { type: "module" });
  const engine = await CreateWebWorkerMLCEngine(worker, currentModelID(), {
    initProgressCallback: (report) => onProgress(report.text, report.progress),
  });

  // The first real request pays one-time setup costs (GPU pipeline compilation, buffer allocation).
  // A throwaway 1-token request moves that cost to the loading screen instead of the first question.
  onProgress("Warming up...", 1);
  await engine.chat.completions.create({
    messages: [{ role: "user", content: "Hi" }],
    max_tokens: 1,
  });
  await engine.resetChat();
  return engine;
}

export interface ReplyStats {
  firstTokenMs: number;
  totalMs: number;
  tokens: number;
}

export interface ReplyResult {
  text: string;
  stats: ReplyStats;
}

export async function streamReply(
  engine: Engine,
  messages: ChatCompletionMessageParam[],
  onToken: (piece: string) => void,
): Promise<ReplyResult> {
  const start = performance.now();
  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.8,
    max_tokens: 150,
  });

  let text = "";
  let tokens = 0;
  let firstTokenAt = 0;
  for await (const chunk of stream) {
    const piece = chunk.choices[0]?.delta?.content ?? "";
    if (!piece) continue;
    if (firstTokenAt === 0) firstTokenAt = performance.now();
    tokens++;
    text += piece;
    onToken(piece);
  }

  const end = performance.now();
  const firstAt = firstTokenAt || end;
  const stats: ReplyStats = {
    firstTokenMs: Math.round(firstAt - start),
    totalMs: Math.round(end - start),
    tokens,
  };
  const genSeconds = (end - firstAt) / 1000;
  console.log(
    `[llm] first token after ${stats.firstTokenMs} ms, ${tokens} tokens in ${stats.totalMs} ms` +
      (genSeconds > 0 ? ` (${(tokens / genSeconds).toFixed(1)} tokens/s)` : ""),
  );
  return { text, stats };
}