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

export async function streamReply(
    engine: MLCEngine,
    messages: ChatCompletionMessageParam[],
    onToken: (piece: string) => void
): Promise<string> {
    const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.8,
        max_tokens: 150
    });

    let full = "";
    for await (const chunk of stream) {
        const piece = chunk.choices[0]?.delta?.content ?? "";
        full += piece;
        onToken(piece);
    }

    return full;
}