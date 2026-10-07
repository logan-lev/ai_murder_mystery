export type GpuCheck = {ok : true} | {ok  : false; reason : string};

export async function checkWebGPU(): Promise<GpuCheck> {
    if (!("gpu" in navigator)) {
        return {ok: false, reason: "Your browser doesn't support WebGPU. Try the latest Chrome or Edge browser."};
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
        return {ok: false, reason: "WebGPU is available, but no compatible GPU was found."};
    }

    return {ok: true};
}