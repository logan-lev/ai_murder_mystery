import {
    CreateMLCEngine,
    prebuiltAppConfig,
    type MLCEngine,
    type ChatCompletionMessageParam
} from "@mlc-ai/web-llm";

export const MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

export function listModels(): string[] {
    return prebuiltAppConfig.model_list.map((m) => m.model_id);
}

export async function loadEngine(
    onProgress: (text: string, progress: number) => void
): Promise<MLCEngine> {
    return CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => onProgress(report.text, report.progress)
    });
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
  engine: MLCEngine,
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